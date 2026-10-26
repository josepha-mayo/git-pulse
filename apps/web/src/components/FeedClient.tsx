"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  GitBranch,
  MessageSquare,
  Plus,
  RefreshCw,
  Rocket,
  Users,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import ComposeFeed from "@/components/ComposeFeed";
import ShipItForm from "@/components/ShipItForm";
import PostCard, { type PostProps } from "@/components/PostCard";
import { hasPassedBadge } from "@/lib/badges";
import { mergeFeedPosts } from "@/lib/feed-state.mjs";

type Tab = "discover" | "following" | "releases" | "activity";
interface Props {
  discoverPosts: PostProps[];
  followingPosts: PostProps[];
  activityPosts: PostProps[];
  userName: string;
  userAvatar: string;
  isAuthenticated?: boolean;
  feedUnavailable?: boolean;
  initialCursor?: string;
}
const tabs: { key: Tab; label: string }[] = [
  { key: "discover", label: "For you" },
  { key: "following", label: "Following" },
  { key: "releases", label: "Releases" },
  { key: "activity", label: "GitHub" },
];
export default function FeedClient({
  discoverPosts,
  followingPosts,
  activityPosts,
  userName,
  isAuthenticated = false,
  feedUnavailable = false,
  initialCursor,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [composeMode, setComposeMode] = useState<"standard" | "ship">(
    "standard",
  );
  const [liveDiscover, setLiveDiscover] = useState(discoverPosts);
  const [liveFollowing, setLiveFollowing] = useState(followingPosts);
  const since = useRef(
    initialCursor ?? new Date(Date.now() - 30000).toISOString(),
  );
  const cursorId = useRef<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState(false);
  useEffect(() => {
    setLiveDiscover(discoverPosts);
  }, [discoverPosts]);
  useEffect(() => {
    setLiveFollowing(followingPosts);
  }, [followingPosts]);
  // One cancellable request at a time. Do not poll hidden tabs or guest sessions.
  useEffect(() => {
    if (!isAuthenticated) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        controller = new AbortController();
        const deadline = setTimeout(() => controller?.abort(), 10000);
        try {
          const response = await fetch(
            `/api/feed/stream?since=${encodeURIComponent(since.current)}${cursorId.current ? `&after=${encodeURIComponent(cursorId.current)}` : ""}`,
            { signal: controller.signal, cache: "no-store" },
          );
          if (response.status === 401) {
            stopped = true;
            return;
          }
          if (!response.ok) throw new Error("Feed update unavailable");
          const data = await response.json();
          if (!stopped && Array.isArray(data.posts)) {
            setLiveDiscover((previous) => mergeFeedPosts(data.posts, previous));
            const followingIds = new Set<string>(data.followingPostIds ?? []);
            setLiveFollowing((previous) =>
              mergeFeedPosts(
                data.posts.filter((post: PostProps) =>
                  followingIds.has(post.id),
                ),
                previous,
              ),
            );
            if (typeof data.timestamp === "string")
              since.current = data.timestamp;
            cursorId.current =
              typeof data.cursorId === "string" ? data.cursorId : null;
            setConnectionIssue(false);
          }
        } catch (error) {
          if (
            !stopped &&
            !(error instanceof DOMException && error.name === "AbortError")
          )
            setConnectionIssue(true);
        } finally {
          clearTimeout(deadline);
        }
      }
      if (!stopped) timer = setTimeout(poll, 20000);
    };
    timer = setTimeout(poll, 20000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [isAuthenticated]);
  const handlePostCreated = (raw: any) => {
    if (!raw?.id) return;
    const post: PostProps = {
      id: raw.id,
      type: raw.type ?? "standard",
      content: raw.content ?? "",
      author: {
        username: raw.author?.username ?? raw.author?.name ?? userName,
        avatar: raw.author?.avatar || "/default-avatar.svg",
        statusEmoji: raw.author?.statusEmoji,
        statusText: raw.author?.statusText,
      },
      timestamp: raw.createdAt ?? new Date().toISOString(),
      likes: raw._count?.reactions ?? 0,
      comments: raw._count?.comments ?? 0,
      repoEmbed: raw.repoEmbed,
      shipDetails: raw.shipDetails,
      images: raw.images,
      hashtags: raw.hashtags,
      repoUrl: raw.repoUrl,
      score: raw.score ?? 0,
      passedBadge: hasPassedBadge(raw.score ?? 0),
    };
    setLiveDiscover((previous) => mergeFeedPosts([post], previous));
    setLiveFollowing((previous) => mergeFeedPosts([post], previous));
  };
  const posts =
    activeTab === "following"
      ? liveFollowing
      : activeTab === "activity"
        ? activityPosts
        : activeTab === "releases"
          ? liveDiscover.filter((post) => post.type === "ship")
          : liveDiscover;
  const needsSignIn =
    !isAuthenticated && (activeTab === "following" || activeTab === "activity");
  const emptyTitle = needsSignIn
    ? "Make this feed yours"
    : activeTab === "releases"
      ? "The next release starts here"
      : activeTab === "following"
        ? "Your circle starts with a follow"
        : activeTab === "activity"
          ? "Your GitHub activity, together"
          : "Start a conversation";
  const emptyDescription = needsSignIn
    ? "Sign in to follow developers and bring your GitHub network into the feed."
    : activeTab === "releases"
      ? "Ship a release to share what changed and the work behind it."
      : activeTab === "following"
        ? "Discover a few builders in Explore. Their updates will appear here."
        : activeTab === "activity"
          ? "Connect GitHub to see meaningful activity from the people you follow."
          : "Share an idea, a work in progress, or something you just shipped.";
  return (
    <section
      className="min-w-0 pb-24 lg:pb-10"
      aria-label="Community social feed"
    >
      <header className="px-5 sm:px-7 pt-7 pb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[25px] font-bold tracking-tight">Home feed</h1>
          <span className="inline-flex items-center gap-2 rounded-full border border-git-border px-3 py-1.5 text-[11px] text-git-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Public community
          </span>
        </div>
        <p className="mt-1.5 text-sm text-git-muted">
          The people, ideas, and projects behind the code.
        </p>
        <div className="mt-5">
          <SearchBar />
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Feed filters"
        className="feed-tabs sticky top-[53px] lg:top-0 z-20 flex border-y border-git-border px-2 sm:px-4"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 px-1 py-4 text-[13px] font-semibold transition-colors ${activeTab === tab.key ? "text-git-text" : "text-git-muted hover:text-git-text"}`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-5 bottom-0 h-[3px] rounded-t-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>
      {isAuthenticated && activeTab !== "activity" ? (
        <div
          id="compose"
          className="scroll-mt-20 border-b border-git-border px-5 py-5 sm:px-6"
        >
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setComposeMode("standard")}
              aria-pressed={composeMode === "standard"}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${composeMode === "standard" ? "bg-git-card text-git-text ring-1 ring-git-border" : "text-git-muted"}`}
            >
              <MessageSquare size={14} />
              Update
            </button>
            <button
              onClick={() => setComposeMode("ship")}
              aria-pressed={composeMode === "ship"}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${composeMode === "ship" ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25" : "text-git-muted"}`}
            >
              <Rocket size={14} />
              Ship a release
            </button>
          </div>
          {composeMode === "standard" ? (
            <ComposeFeed onPostCreated={handlePostCreated} />
          ) : (
            <ShipItForm onPostCreated={handlePostCreated} />
          )}
        </div>
      ) : !isAuthenticated && !needsSignIn ? (
        <div
          id="compose"
          className="border-b border-git-border px-5 py-5 sm:px-7"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-git-border bg-git-card text-emerald-300">
              <Plus size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-[15px]">
                What are you building?
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-git-muted">
                A small win. A new release. A question worth asking.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-[#07130d] transition hover:bg-emerald-300"
                >
                  Join the conversation
                  <ArrowUpRight size={14} />
                </Link>
                <Link
                  href="/login"
                  className="text-xs font-semibold text-git-muted hover:text-git-text"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {connectionIssue && (
        <p role="status" className="px-6 py-3 text-xs text-amber-300">
          Updates are temporarily paused. Your feed is still here; reconnecting
          automatically.
        </p>
      )}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="min-w-0"
      >
        {feedUnavailable && !needsSignIn ? (
          <div className="p-10 text-center">
            <RefreshCw className="mx-auto mb-4 text-git-muted" size={24} />
            <h2 className="font-semibold">
              The feed is temporarily unavailable
            </h2>
            <p className="mt-2 text-sm text-git-muted">
              We could not load community posts. Please try again.
            </p>
            <button
              onClick={() => router.refresh()}
              className="mt-5 rounded-full border border-git-border px-5 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : needsSignIn || posts.length === 0 ? (
          <div className="flex min-h-[270px] flex-col items-center px-8 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-git-border bg-git-card text-emerald-300">
              {activeTab === "releases" ? (
                <Rocket size={22} />
              ) : activeTab === "activity" ? (
                <GitBranch size={22} />
              ) : (
                <Users size={22} />
              )}
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              {emptyTitle}
            </h2>
            <p className="mt-2 max-w-[330px] text-sm leading-relaxed text-git-muted">
              {emptyDescription}
            </p>
            <Link
              href={needsSignIn ? "/login" : "/explore"}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              {needsSignIn ? "Sign in" : "Explore the community"}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="social-post-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUsername={userName} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
