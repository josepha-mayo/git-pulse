import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseFeedCursor } from "@/lib/feed-state.mjs";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const publicAuthor = { username: true, name: true, avatar: true, githubId: true, statusEmoji: true, statusText: true } as const;
const counts = { select: { comments: true, reactions: true } } as const;
const postInclude = { author: { select: publicAuthor }, _count: counts,
  repostOf: { include: { author: { select: publicAuthor }, _count: counts,
    repostOf: { include: { author: { select: publicAuthor }, _count: counts } } } } } as const;
type PostRecord = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type DisplayRecord = Omit<PostRecord, "repostOf"> & { repostOf?: DisplayRecord | null };

function serialize(post: DisplayRecord, depth = 0): Record<string, unknown> {
  const authorName = post.author.username ?? post.author.name ?? "developer";
  const original = post.repostOf;
  const plainRepost = Boolean(original && post.content.startsWith("Reposted by @"));
  if (plainRepost && original && depth < 2) {
    return { ...serialize(original, depth + 1), isRepost: true, repostedBy: authorName };
  }
  return {
    id: post.id, type: post.type, content: post.content,
    author: { username: authorName, avatar: post.author.avatar || (post.author.githubId ? `https://avatars.githubusercontent.com/u/${post.author.githubId}?v=4` : "/default-avatar.svg"), statusEmoji: post.author.statusEmoji, statusText: post.author.statusText },
    timestamp: post.createdAt.toISOString(), likes: post._count.reactions, comments: post._count.comments,
    images: post.images, hashtags: post.hashtags, repoUrl: post.repoUrl,
    repoEmbed: post.repoEmbed, shipDetails: post.shipDetails,
    ...(original && depth < 2 ? { quotedPost: serialize(original, depth + 1) } : {}),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.login) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cutoff = new Date();
  const since = parseFeedCursor(req.nextUrl.searchParams.get("since"), cutoff);
  const after = req.nextUrl.searchParams.get("after");
  if (!since || (after && !/^[a-zA-Z0-9_-]{1,128}$/.test(after))) return NextResponse.json({ error: "Invalid feed cursor" }, { status: 400 });
  try {
    const currentUser = await prisma.user.findUnique({
      where: session.user.id ? { id: session.user.id } : { username: session.user.login },
      select: { id: true, following: { select: { followingId: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 401 });
    const followingIds = new Set([currentUser.id, ...currentUser.following.map(follow => follow.followingId)]);
    // Read the public community stream, not just follows. A separate id list updates Following.
    // Ascending composite pagination prevents gaps when a busy window contains over 100 posts.
    const records = await prisma.post.findMany({
      where: { createdAt: { lte: cutoff }, OR: [
        { createdAt: { gt: since } },
        { createdAt: since, ...(after ? { id: { gt: after } } : {}) },
      ] },
      include: postInclude, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 101,
    });
    const hasMore = records.length > 100;
    const page = records.slice(0, 100);
    const last = page[page.length - 1];
    const serialized = page.map(record => ({ record, display: serialize(record as DisplayRecord) }));
    return NextResponse.json({
      posts: serialized.map(entry => entry.display).reverse(),
      followingPostIds: serialized.filter(entry => followingIds.has(entry.record.authorId)).map(entry => entry.display.id),
      timestamp: hasMore && last ? last.createdAt.toISOString() : cutoff.toISOString(),
      cursorId: hasMore && last ? last.id : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Feed] Update failed:", error);
    return NextResponse.json({ error: "Feed temporarily unavailable" }, { status: 503 });
  }
}
