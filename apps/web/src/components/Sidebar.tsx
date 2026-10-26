import {auth,signOut} from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import {Activity,ArrowUpRight,Plus,LogOut} from "lucide-react";
import FeedNavigation from "./FeedNavigation";
export default async function Sidebar() {
  const session=await auth().catch(()=>null);
  const username=session?.user?.login;
  return <aside className="w-[224px] shrink-0"><nav aria-label="Main navigation" className="sticky top-0 flex h-dvh flex-col px-4 py-7">
    <Link href="/" aria-label="gitPulse home" className="mb-9 flex items-center gap-2.5 px-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-[#07130d]"><Activity size={23} strokeWidth={2.2}/></span><span className="text-[23px] font-bold tracking-[-1px]">git<span className="font-medium text-git-muted">Pulse</span></span></Link>
    <p className="mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-[.2em] text-git-muted">Your community</p>
    <FeedNavigation username={username}/>
    <Link href={username?"/#compose":"/signup"} className="mt-7 flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-[13px] font-bold text-[#07130d] transition hover:bg-emerald-300"><Plus size={17}/>{username?"Share an update":"Start building in public"}</Link>
    <div className="mt-8 rounded-xl border border-git-border px-4 py-4"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-300">Made for builders</span><p className="mt-2 text-xs leading-relaxed text-git-muted">Less noise. More work worth sharing.</p><a href="https://github.com/josepha-mayo/git-pulse" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-git-text">Open source<ArrowUpRight size={13}/></a></div>
    <div className="mt-auto pt-7">{username?<div className="border-t border-git-border pt-4"><Link href={`/profile/${encodeURIComponent(username)}`} className="flex min-w-0 items-center gap-2.5"><Image src={session?.user?.image || "/default-avatar.svg"} alt="" width={34} height={34} className="rounded-full"/><div className="min-w-0"><p className="truncate text-xs font-semibold">{session?.user?.name || username}</p><p className="truncate text-[11px] text-git-muted">@{username}</p></div></Link><form className="mt-3" action={async()=>{"use server";await signOut({redirectTo:"/"});}}><button className="inline-flex items-center gap-2 text-xs text-git-muted hover:text-git-text" type="submit"><LogOut size={13}/>Sign out</button></form></div>:<div className="border-t border-git-border pt-4"><p className="text-xs text-git-muted">Already part of the community?</p><Link href="/login" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-git-text">Sign in<ArrowUpRight size={14}/></Link></div>}<p className="mt-5 text-[10px] text-git-muted">gitPulse / open source, open conversation.</p></div>
  </nav></aside>;
}
