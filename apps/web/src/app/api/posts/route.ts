import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerSideToken } from "@/lib/serverToken";
import { prisma } from "@/lib/prisma";
import rateLimit from "@/lib/rateLimit";
import { getRepoCommitCount, getRepoConsistency } from "@/lib/github";
import { z } from "zod";

const PostPayloadSchema = z.object({
  content: z.string().min(1).max(500),
  type: z.enum(["standard", "ship"]),
  images: z.array(z.string().url().or(z.string().startsWith("data:image/"))).max(4).optional(),
  repoUrl: z.string().url().regex(new RegExp('^https://github.com/([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)(?:/([a-zA-Z0-9-_/]+))?$')).optional(),
  shipDetails: z.object({
    repoFullName: z.string().max(100),
    version: z.string().max(50),
    changelog: z.string().max(2000)
  }).refine((data) => data.repoFullName !== '', { message: 'Repository full name is required' }).optional(),
  repostOfId: z.string().cuid().optional().nullable()
});

export const dynamic = "force-dynamic";

const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500
});

export async function POST(req: Request) {
  const session = await auth();
  let username: string | null = session?.user?.login || null;
  let userInDb: any = null; // Variable to store user if found via API key

  // fallback: bearer token auth for programmatic access (github action)
  if (!username) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ") && authHeader.slice(7).startsWith("gp_")) {
      const rawApiKey = authHeader.slice(7); // remove "bearer "
      // hash the incoming key to compare against the stored hash
      const { hashApiKey } = await import("@/lib/security");
      const hashedKey = await hashApiKey(rawApiKey);
      const tokenUser = await prisma.user.findUnique({
        where: { apiKey: hashedKey },
      });
      if (tokenUser) {
        username = tokenUser.username;
        userInDb = tokenUser;
      }
    }
  }

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await limiter.check(10, username);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const result = PostPayloadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation Failed", details: result.error.format() }, { status: 400 });
    }

    const { content, type, shipDetails, images, repoUrl, repostOfId } = result.data;

    if (images && (!Array.isArray(images) || images.length > 4)) {
      return NextResponse.json({ error: "Maximum 4 images allowed" }, { status: 400 });
    }

    const user = userInDb || await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found in DB" }, { status: 404 });
    }

    // extract hashtags and store as lowercase for case-insensitive exact matching
    const matchedTags: string[] = content.match(/#[\w-]+/g) || [];
    const hashtags = Array.from(new Set(matchedTags)).map((tag) => tag.substring(1).toLowerCase());

    let repoEmbed: any = null;

    // extract repourl from content if not explicitly provided
    let finalRepoUrl = repoUrl;
    if (!finalRepoUrl) {
      const urlMatch = content.match(/https?:\/\/(www\.)?github\.com\/([^\s]+)\/([^\s]+)/);
      if (urlMatch) {
        finalRepoUrl = urlMatch[0];
      }
    }

    // populate repoembed if finalrepourl is provided
    if (finalRepoUrl) {
      try {
        // parse github.com/owner/name
        const match = finalRepoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          const owner = match[1];
          const repoName = match[2];

          const headers: Record<string, string> = {
            "Accept": "application/vnd.github.v3+json"
          };
          // use session token if available for higher rate limits
          if (session?.user?.login) {
            const repoFetchToken = await getServerSideToken(session.user.login);
            if (repoFetchToken) {
              headers["Authorization"] = `Bearer ${repoFetchToken}`;
            }
          }

          const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
          if (res.ok) {
            const data = await res.json();
            const token = session?.user?.login ? (await getServerSideToken(session.user.login) || "") : "";

            // fetch additional metrics for the algo
            const [commitCount, pushConsistency] = await Promise.all([
              getRepoCommitCount(owner, repoName, token),
              getRepoConsistency(owner, repoName, token)
            ]);

            repoEmbed = {
              name: data.full_name,
              description: data.description,
              language: data.language,
              languageColor: "", // rendered dynamically on client
              stars: data.stargazers_count,
              forks: data.forks_count,
              lastPush: data.pushed_at || data.updated_at || new Date().toISOString(),
              url: data.html_url,
              commitCount,
              pushConsistency
            };
          }
        }
      } catch (err) {
        console.error("Failed to fetch repo embed data:", err);
      }
    }

    const post = await prisma.post.create({
      data: {
        content,
        type: type || "standard",
        authorId: user.id,
        shipDetails: shipDetails || undefined,
        images: images || [],
        repoUrl: finalRepoUrl || null,
        repoEmbed,
        hashtags,
        repostOfId: repostOfId || null
      },
      include: {
        author: { select: { username: true, name: true, avatar: true, statusEmoji: true, statusText: true } },
        _count: { select: { comments: true, reactions: true } }
      }
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
