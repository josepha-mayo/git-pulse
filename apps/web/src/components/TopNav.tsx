"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, HomeIcon } from "@primer/octicons-react";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
const ROUTE_CONFIGS = [
  { path: '/', title: 'gitPulse', matchType: 'exact' },
  { path: '/profile', title: 'Profile', matchType: 'dynamicProfile' },
  { path: '/explore', title: 'Explore', matchType: 'startsWith' },
  { path: '/notifications', title: 'Notifications', matchType: 'startsWith' },
  { path: '/post', title: 'Post', matchType: 'startsWith' },
];
const getPageTitle = (pathname: string) => {
  for (const config of ROUTE_CONFIGS) {
    if (config.matchType === 'exact' && pathname === config.path) return config.title;
    if (config.matchType === 'startsWith' && pathname.startsWith(config.path)) return config.title;
    if (config.matchType === 'dynamicProfile' && pathname.startsWith(config.path)) {
      const lastSegment = pathname.split('/').pop();
      return lastSegment === '' ? config.title : lastSegment;
    }
  }
  return 'GitPulse';
};

  // Don't show on desktop where sidebar is present, just mobile
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-git-border bg-git-bg/90 backdrop-blur-md lg:hidden">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-git-text hover:text-git-accent transition-colors p-1"
        aria-label="Go back"
      >
        <ArrowLeftIcon size={20} />
      </button>

      <span className="font-bold text-[15px] truncate max-w-[150px]">
        {getPageTitle(pathname)}
      </span>

      <Link 
        href="/"
        className="flex items-center gap-2 text-git-text hover:text-git-accent transition-colors p-1"
        aria-label="Go home"
      >
        <HomeIcon size={20} />
      </Link>
    </div>
  );
}
