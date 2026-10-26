import { auth } from "@/lib/auth";
import { getServerSideToken } from "@/lib/serverToken";
import { getGitHubReceivedEvents, type GitHubEvent } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import FeedClient from "@/components/FeedClient";
import { type PostProps } from "@/components/PostCard";
import { calculatePostScore } from "@/lib/algo";
import { hasPassedBadge } from "@/lib/badges";

import RightSidebar from "@/components/RightSidebar";
import { Suspense } from "react";
import { SidebarSkeleton } from "@/components/Skeletons";

import { redirect } from "next/navigation";
import Link from "next/link";

// known bot patterns to filter out
const BOT_PATTERNS = [
/bot$/i, /\[bot\]$/i, /^dependabot/i, /^renovate/i, /^copilot/i,
/^github-actions/i, /^dmca/i, /^snyk/i, /^greenkeeper/i, /^imgbot/i,
/^codecov/i, /^stale/i, /^mergify/i, /^allcontributors/i];


function isBot(login: string): boolean {
  return BOT_PATTERNS.some((pattern) => pattern.test(login));
}

/**
 * smart feed: filter out noise (stars, forks, minor pushes) and bots.
 * keep meaningful events: prs, issues, releases, new repos, big pushes.
 */
function isWorthShowing(event: GitHubEvent): boolean {
  if (!event || !event.actor || !event.actor.login) return false;
  if (!event.payload) return false;
  
  // filter bots first
  if (isBot(event.actor.login)) return false;
  
  switch (event.type) {
    case "PullRequestEvent":{
        if (event.payload.action === "opened") return true;
        const comments = (event.payload.pull_request as any)?.comments ?? 0;
        return comments >= 40;
      }
    case "IssuesEvent":{
        if (event.payload.action === "opened") return true;
        const comments = event.payload.issue?.comments ?? 0;
        return comments >= 40;
      }
    case "DiscussionEvent":{
        const comments = (event.payload as any).discussion?.comments ?? 0;
        return comments >= 25;
      }
    case "ReleaseEvent":
      return true;
    case "CreateEvent":
      return event.payload.ref_type === "repository";
    case "PushEvent":
      return (event.payload.size ?? event.payload.commits?.length ?? 0) >= 10;
    default:
      return false;
  }
}

function mapEventToPost(event: GitHubEvent): PostProps | null {
  if (!event || !event.repo || !event.actor || !event.created_at) return null;
  const repoUrl = `https://github.com/${event.repo.name}`;
  
  const basePost = {
    id: event.id,
    isExternalEvent: true,
    externalUrl: repoUrl,
    author: {
      username: event.actor.login,
      avatar: event.actor.avatar_url
    },
    timestamp: new Date(event.created_at).toISOString(),
    likes: 0,
    comments: 0
  };

  let isTrending = false;
  if (event.type === "PullRequestEvent" && (event.payload.pull_request as any)?.comments >= 40) isTrending = true;
  if (event.type === "IssuesEvent" && (event.payload.issue?.comments ?? 0) >= 40) isTrending = true;
  if (event.type === "DiscussionEvent" && (event.payload as any).discussion?.comments >= 25) isTrending = true;

  const trendingTag = isTrending ? "\n\n#trending" : "";

  if (!event.payload) return null;

  switch (event.type) {
    case "PushEvent":
      if (!event.payload.commits) return null;
      return {
        ...basePost,
        type: "standard",
        content: `Pushed ${event.payload.commits.length} commits to [${event.repo.name}](${repoUrl})`
      };
    case "CreateEvent":
      return {
        ...basePost,
        type: "standard",
        content: `🚀 Created new repository [${event.repo.name}](${repoUrl})`
      };
case "PullRequestEvent":
      if (!event.payload || !event.payload.pull_request) return null;
      const action = event.payload.action === "opened" ? "Opened" : "Updated";
      const prUrl = event.payload.pull_request.html_url ?? repoUrl;
      return {
        ...basePost,
        externalUrl: prUrl,
        type: "standard",
        content: `${action} PR #${event.payload.pull_request.number}: [${event.payload.pull_request.title ?? "Untitled"}](${prUrl}) in ${event.repo.name}${trendingTag}`
      };
case "IssuesEvent":
      if (!event.payload || !event.payload.issue) return null;
      const issueAction = event.payload.action === "opened" ? "Opened" : "Updated";
      const issueUrl = event.payload.issue.html_url ?? repoUrl;
      return {
        ...basePost,
        externalUrl: issueUrl,
        type: "standard",
        content: `${issueAction} issue #${event.payload.issue.number}: [${event.payload.issue.title ?? "Untitled"}](${issueUrl}) in ${event.repo.name}${trendingTag}`
      };
case "DiscussionEvent":
      if (!event.payload || !(event.payload as any).discussion) return null;
      return {
        ...basePost,
        type: "standard",
        content: `Active discussion: ${(event.payload as any).discussion.title ?? "Untitled"} in ${event.repo.name}${trendingTag}`
      };
case "ReleaseEvent":
      if (!event.payload || !event.payload.release) return null;
      const releaseUrl = event.payload.release.html_url ?? repoUrl;
      return {
        ...basePost,
        externalUrl: releaseUrl,
        type: "ship",
        content: `Released [${event.payload.release.tag_name ?? "new version"}](${releaseUrl}) of ${event.repo.name}`,
        shipDetails: {
          version: event.payload.release.tag_name ?? "v0.0.0",
          changelog: event.payload.release.body ?? "No changelog provided."
        }
      };
    default:
      return null;
  }
}

function mapPrismaPostToProps(p: {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  repoEmbed: unknown;
  shipDetails: unknown;
  images?: string[];
  hashtags?: string[];
  repoUrl?: string | null;
  author: {username: string | null;name?: string | null;email?: string | null;avatar: string | null; statusEmoji?: string | null; statusText?: string | null;};
  _count: {comments: number;reactions: number;};
  repostOf?: any;
}): PostProps {
  const authorUsername = p.author.username ?? p.author.name ?? "developer";

  if (p.repostOf) {
    const isQuoteRepost = !p.content.startsWith("Reposted by @");
    
    if (!isQuoteRepost) {
      return {
        ...mapPrismaPostToProps(p.repostOf),
        isRepost: true,
        repostedBy: authorUsername,
      };
    }
  }

  let score = 0;

  // calculate algorithmic score for the post
  if (p.repoEmbed) {
    const r = p.repoEmbed as Record<string, any>;
    const daysSincePost = Math.max((Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24), 1);
    const pushDate = r.lastPush ? new Date(r.lastPush) : p.createdAt;
    const daysSincePush = Math.max((Date.now() - pushDate.getTime()) / (1000 * 60 * 60 * 24), 0);

    score = calculatePostScore({
      language: r.language,
      stars: r.stars || 0,
      forks: r.forks || 0,
      daysSincePush,
      hasDescription: !!r.description,
      daysSincePost,
      commitCount: r.commitCount,
      pushConsistency: r.pushConsistency
    });
  } else {
    // base score for non-repo posts (images, text) decaying over time
    const daysSincePost = Math.max((Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24), 1);
    score = 15 / Math.pow(daysSincePost, 1.2);

    // boost score if has images or hashtags
    if (p.images && p.images.length > 0) score += 5;
    if (p.hashtags && p.hashtags.length > 0) score += 2;
  }

  return {
    id: p.id,
    type: p.type as "standard" | "ship",
    author: {
      username: authorUsername,
      avatar: p.author.avatar || "/default-avatar.svg",
      statusEmoji: p.author.statusEmoji,
      statusText: p.author.statusText
    },
    content: p.content,
    timestamp: p.createdAt.toISOString(),
    likes: p._count.reactions,
    comments: p._count.comments,
    repoEmbed: p.repoEmbed as PostProps["repoEmbed"],
    shipDetails: p.shipDetails as PostProps["shipDetails"],
    images: p.images,
    hashtags: p.hashtags,
    repoUrl: p.repoUrl,
    score,
    passedBadge: hasPassedBadge(score),
    quotedPost: p.repostOf && !p.content.startsWith("Reposted by @") ? mapPrismaPostToProps(p.repostOf) : undefined
  };
}

function mergeRepostHeaders(posts: PostProps[]) {
  const byId = new Map<string, PostProps>();

  for (const post of posts) {
    const existing = byId.get(post.id);
    if (!existing) {
      byId.set(post.id, post);
      continue;
    }

    if (post.isRepost && post.repostedBy && !existing.isRepost) {
      byId.set(post.id, { ...existing, isRepost: true, repostedBy: post.repostedBy, timestamp: post.timestamp });
    }
  }

  return Array.from(byId.values());
}

export default async function HomePage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const oauthCode = searchParams?.code;
  const oauthState = searchParams?.state;

  if (typeof oauthCode === "string") {
    const callbackSearchParams = new URLSearchParams({ code: oauthCode });
    if (typeof oauthState === "string") callbackSearchParams.set("state", oauthState);
    redirect(`/api/auth/callback/github?${callbackSearchParams.toString()}`);
  }

  try {

  const session = await auth().catch((error) => {
    console.error("[Auth] Failed to resolve home session:", error);
    return null;
  });

  // The public product is the social feed. Authentication protects writes, not reading.
  const isAuthenticated = Boolean(session?.user?.login);
  let feedUnavailable = false;

  // ═══════════════════════════════════════════════════════════════════════
  // discover: user-created posts only. scored via algo.
  // ═══════════════════════════════════════════════════════════════════════
  let discoverPosts: PostProps[] = [];
  {
    try {
      const posts = await prisma.post.findMany({
        include: {
          author: true,
          _count: { select: { comments: true, reactions: true } },
          repostOf: {
            include: {
              author: true,
              _count: { select: { comments: true, reactions: true } },
              repostOf: {
                include: {
                  author: true,
                  _count: { select: { comments: true, reactions: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 100
      });
      const mapped = posts.map(mapPrismaPostToProps);
      const deduped = mergeRepostHeaders(mapped);
      discoverPosts = deduped.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 30);
    } catch (error) {
      feedUnavailable = true;
      console.error("[HomePage] Failed to load discover posts:", error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // following: posts from people you follow + your own posts
  // ═══════════════════════════════════════════════════════════════════════
  let followingPosts: PostProps[] = [];
  if (session?.user?.login) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: session.user.id ? { id: session.user.id } : { username: session.user.login },
        select: { id: true }
      });
      if (dbUser) {
        const followedIds = await prisma.follow.findMany({
          where: { followerId: dbUser.id },
          select: { followingId: true }
        });
        const ids = [dbUser.id, ...followedIds.map((f) => f.followingId)];
        const filteredPosts = await prisma.post.findMany({
          where: { authorId: { in: ids } },
          include: {
            author: true,
            _count: { select: { comments: true, reactions: true } },
            repostOf: {
              include: {
                author: true,
                _count: { select: { comments: true, reactions: true } },
                repostOf: {
                  include: {
                    author: true,
                    _count: { select: { comments: true, reactions: true } }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        });
        const mapped = filteredPosts.map(mapPrismaPostToProps);
        followingPosts = mergeRepostHeaders(mapped);
      }
    } catch (error) {
      console.error("[HomePage] Failed to load following posts:", error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // activity: real github events, bot-filtered, from followed users
  // ═══════════════════════════════════════════════════════════════════════
  let activityPosts: PostProps[] = [];
  if (session?.user?.login && session.user.githubId) {
    try {
      const token = await getServerSideToken(session.user.login);
      if (token) {
        const events = await getGitHubReceivedEvents(session.user.login, token);
        activityPosts = events.
        filter(isWorthShowing).
        map(mapEventToPost).
        filter((p): p is PostProps => p !== null).
        slice(0, 20);
      }
    } catch (error) {
      console.error("[HomePage] Failed to load GitHub activity:", error);
    }
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 w-full min-h-screen xl:border-r border-git-border">
                <FeedClient
          discoverPosts={discoverPosts}
          followingPosts={followingPosts}
          activityPosts={activityPosts}
          userName={session?.user?.login ?? ""}
          userAvatar={session?.user?.image ?? ""}
          isAuthenticated={isAuthenticated}
          feedUnavailable={feedUnavailable} />
        
            </div>
            <Suspense fallback={<div className="hidden w-[300px] shrink-0 xl:block"><SidebarSkeleton /></div>}>
                <RightSidebar />
            </Suspense>
        </div>);
  } catch (error) {
    console.error("[HomePage] Fatal error rendering home:", error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117] text-white px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Unable to load feed</h1>
          <p className="text-gray-400">Something went wrong while loading your feed. Please refresh or try again later.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-md text-sm font-medium transition-colors">
            Refresh
          </Link>
        </div>
      </div>
    );
  }
}
