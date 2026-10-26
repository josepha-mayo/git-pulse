"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Compass,
  GitBranch,
  Bell,
  UserRound,
  Settings2,
} from "lucide-react";
export default function FeedNavigation({ username }: { username?: string }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home feed", Icon: House },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/activity", label: "GitHub activity", Icon: GitBranch },
    ...(username
      ? [
          { href: "/notifications", label: "Notifications", Icon: Bell },
          {
            href: `/profile/${encodeURIComponent(username)}`,
            label: "Profile",
            Icon: UserRound,
          },
          { href: "/settings", label: "Settings", Icon: Settings2 },
        ]
      : []),
  ];
  return (
    <div className="space-y-1">
      {links.map(({ href, label, Icon }) => {
        const active =
          href === "/"
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[14px] transition ${active ? "bg-emerald-400/10 font-semibold text-emerald-300" : "font-medium text-git-muted hover:bg-git-card hover:text-git-text"}`}
          >
            <Icon size={19} strokeWidth={active ? 2 : 1.7} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
