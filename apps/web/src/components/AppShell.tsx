"use client";
import { usePathname } from "next/navigation";
import TopNav from "./TopNav";
export default function AppShell({children,sidebar,bottomNav}:{children:React.ReactNode;sidebar:React.ReactNode;bottomNav:React.ReactNode}) {
  const pathname=usePathname();
  if(["/login","/signup","/signout","/auth/"].some(path=>pathname===path || pathname.startsWith(path.endsWith("/") ? path : path+"/"))) return <main id="main-content" className="min-h-screen w-full">{children}</main>;
  return <><a href="#main-content" className="skip-link">Skip to feed</a><div className="mx-auto flex min-h-screen w-full max-w-[1280px] justify-center"><div className="hidden lg:block">{sidebar}</div><main id="main-content" className="min-w-0 flex-1 border-x border-git-border"><TopNav/>{children}</main></div>{bottomNav}</>;
}
