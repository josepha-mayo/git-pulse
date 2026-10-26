"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { 
    HomeIcon as PrimerHomeIcon, HomeFillIcon,
    TelescopeIcon, TelescopeFillIcon,
    BellIcon as PrimerBellIcon, BellFillIcon,
    PersonIcon, PersonFillIcon,
    PulseIcon as PrimerPulseIcon
} from "@primer/octicons-react";

// filled octicon svgs matching the sidebar
function HomeIcon({ active }: { active: boolean }) {
    return active ? <HomeFillIcon size={20} className="fill-current" /> : <PrimerHomeIcon size={20} className="fill-current" />;
}

function DiscoverIcon({ active }: { active: boolean }) {
    return active ? <TelescopeFillIcon size={20} className="fill-current" /> : <TelescopeIcon size={20} className="fill-current" />;
}

function BellIcon({ active }: { active: boolean }) {
    return active ? <BellFillIcon size={20} className="fill-current" /> : <PrimerBellIcon size={20} className="fill-current" />;
}

function UserIcon({ active }: { active: boolean }) {
    return active ? <PersonFillIcon size={20} className="fill-current" /> : <PersonIcon size={20} className="fill-current" />;
}

function ActivityIcon({ active }: { active: boolean }) {
    return <PrimerPulseIcon size={20} className={active ? "fill-current stroke-current stroke-[0.5]" : "fill-current"} />;
}

export default function BottomNav({ username }: { username?: string }) {
    const pathname = usePathname();

const navItems = [
        { name: "Home", href: "/", Icon: HomeIcon },
        { name: "Discover", href: "/explore", Icon: DiscoverIcon },
        { name: "Activity", href: "/activity", Icon: ActivityIcon },
        ...(username ? [{ name: "Notifications", href: "/notifications", Icon: BellIcon }] : [{ name: "Sign in", href: "/login", Icon: UserIcon }]),
        ...(username ? [{ name: "Profile", href: `/profile/${encodeURIComponent(username)}`, Icon: UserIcon }] : []),
      ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-git-bg/80 backdrop-blur-md border-t border-git-border px-4 py-3 pb-safe">
            <div className="flex justify-around items-center max-w-md mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                            key={item.name} 
                            href={item.href}
                            className={`flex flex-col items-center gap-1 transition-colors ${
                                isActive ? "text-git-accent" : "text-git-muted hover:text-git-text"
                            }`}
                        >
                            <item.Icon active={isActive} />
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
