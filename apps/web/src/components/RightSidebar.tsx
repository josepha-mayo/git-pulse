import Link from "next/link";
import { auth } from "@/lib/auth";
import { getServerSideToken } from "@/lib/serverToken";
import { 
  getGitHubTrendingRepos, getGitHubTrendingDevelopers, 
  getSuggestedGitHubUsers, getTopReposToStar,
  getUpcomingGitHubProjects, getUpcomingGitHubDevs,
  getTopReposByDailyCommits, getTopDevsByDailyCommits,
  getDevelopersLikeYou
} from "@/lib/github";
import CollabWidget from "./CollabWidget";
import TrendingCard from "./TrendingCard";
import ToggleSidebarCard from "./ToggleSidebarCard";
import { Suspense } from "react";
import { SidebarSkeleton } from "./Skeletons";

async function TrendingSection({ token }: { token: string }) {
  if (!token) throw new Error('Invalid input');
  const [repos, devs] = await Promise.all([
    getGitHubTrendingRepos(token, 5),
    getGitHubTrendingDevelopers(token, 5)
  ]);
  return <TrendingCard repos={repos} devs={devs} />;
}

async function UpcomingSection({ token }: { token: string }) {
  if (!token) throw new Error('Invalid input');
  const [projects, devs] = await Promise.all([
    getUpcomingGitHubProjects(token, 5),
    getUpcomingGitHubDevs(token, 5)
  ]);
  if (projects.length === 0 && devs.length === 0) return null;
  return (
    <ToggleSidebarCard
      title="Upcoming"
      tab1="Projects"
      tab2="Devs"
      items1={projects}
      items2={devs}
      type1="repo"
      type2="dev"
      emptyMessage1="No active upcoming projects found."
      emptyMessage2="No fast-growing devs found."
    />
  );
}

async function ActiveTodaySection({ token }: { token: string }) {
  if (!token) throw new Error('Invalid input');
  const [projects, devs] = await Promise.all([
    getTopReposByDailyCommits(token, 5),
    getTopDevsByDailyCommits(token, 5)
  ]);
  if (projects.length === 0 && devs.length === 0) return null;
  return (
    <ToggleSidebarCard
      title="Active Today"
      tab1="Repos"
      tab2="Devs"
      items1={projects}
      items2={devs}
      type1="repo"
      type2="dev"
      emptyMessage1="No heavily pushed repos found."
      emptyMessage2="No highly active devs found today."
    />
  );
}

async function DevelopersLikeYouSection({ token, login }: { token: string; login: string }) {
  if (!token || !login) throw new Error('Invalid input');
  const devs = await getDevelopersLikeYou(login, token, 10);
  if (devs.length === 0) return null;
  return (
    <ToggleSidebarCard
      title="Developers Like You"
      tab1="Matches"
      tab2="Ecosystem"
      items1={devs.slice(0, 5)}
      items2={devs.slice(5, 10)}
      type1="dev"
      type2="dev"
      hideCommitCount={true}
      emptyMessage1="No matching developers found."
      emptyMessage2="Ecosystem peers will appear here soon."
    />
  );
}

async function ExploreSection({ token }: { token: string }) {
  if (!token) throw new Error('Invalid input');
  const [users, repos] = await Promise.all([
    getSuggestedGitHubUsers(token, undefined, 5),
    getTopReposToStar(token, 5)
  ]);
  return (
    <ToggleSidebarCard
      title="Explore"
      tab1="Who to follow"
      tab2="What to star"
      items1={users}
      items2={repos}
      type1="dev"
      type2="repo"
      hideCommitCount={true}
      emptyMessage1="No suggestions found."
      emptyMessage2="No big repositories found."
    />
  );
}

export default async function RightSidebar() {
  const session = await auth().catch((error) => {
    console.error("[RightSidebar] Failed to resolve session:", error);
    return null;
  });
  const token = session?.user?.login
    ? await getServerSideToken(session.user.login).catch((error) => {
        console.error("[RightSidebar] Failed to resolve GitHub token:", error);
        return null;
      })
    : null;

  if (!token) {
    return <aside aria-label="Community discovery" className="hidden min-w-0 xl:block p-5">
      <div className="sticky top-5 space-y-5">
        <section className="rounded-2xl border border-git-border bg-git-card/40 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Build in good company</p>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">Find your people.</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-git-muted">Follow the developers behind the projects. Share the process, not just the finished product.</p>
          <Link href="/signup" className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-git-text px-4 py-2.5 text-xs font-bold text-git-bg hover:opacity-90">Create your account</Link>
        </section>
        <section className="rounded-2xl border border-git-border p-5">
          <h2 className="text-sm font-semibold">Explore a topic</h2>
          <div className="mt-4 space-y-4">{[{tag:"buildinpublic",description:"The work between releases"},{tag:"opensource",description:"Built together, shared openly"},{tag:"machinelearning",description:"Models, experiments, and lessons"},{tag:"webdev",description:"From first commit to shipped"}].map(({tag,description})=><Link key={tag} href={`/explore/tags/${tag}`} className="block group"><span className="text-[13px] font-medium text-git-text group-hover:text-emerald-300">#{tag}</span><span className="mt-0.5 block text-[11px] text-git-muted">{description}</span></Link>)}</div>
        </section>
        <div className="px-1"><h2 className="text-xs font-semibold">Small updates count.</h2><p className="mt-2 text-xs leading-relaxed text-git-muted">Ask a good question. Share a useful discovery. Give another builder thoughtful feedback.</p></div>
        <p className="px-1 text-[10px] text-git-muted">gitPulse · Community, not a commit log.</p>
      </div>
    </aside>;
  }

  return (
    <aside className="hidden w-[300px] shrink-0 xl:block px-4">
      <div className="sticky top-0 pt-3 flex flex-col gap-4">
        <Suspense fallback={<SidebarSkeleton />}>
          <TrendingSection token={token} />
        </Suspense>

        <Suspense fallback={<SidebarSkeleton />}>
          <UpcomingSection token={token} />
        </Suspense>

        <Suspense fallback={<SidebarSkeleton />}>
          <ActiveTodaySection token={token} />
        </Suspense>

        {session?.user && <CollabWidget />}

        {session?.user?.login && (
          <Suspense fallback={<SidebarSkeleton />}>
            <DevelopersLikeYouSection token={token} login={session.user.login} />
          </Suspense>
        )}

        <Suspense fallback={<SidebarSkeleton />}>
          <ExploreSection token={token} />
        </Suspense>

        <div className="px-4 text-[13px] text-git-muted flex flex-wrap gap-x-3 gap-y-1 pb-4">
          <Link href="#" className="hover:underline">About</Link>
          <Link href="#" className="hover:underline">Terms</Link>
          <Link href="#" className="hover:underline">Privacy</Link>
          <span>© 2026 GitPulse</span>
        </div>
      </div>
    </aside>
  );
}