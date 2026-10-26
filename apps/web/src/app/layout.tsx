import type { Metadata } from "next";

import { Suspense } from "react";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { SidebarSkeleton } from "@/components/Skeletons";
import "./globals.css";


import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};


export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hubfeed.netlify.app"),
    title: {
        default: "GitPulse | GitHub's Social Layer",
        template: "%s | GitPulse",
    },
    description: "The social network for developers. Share your ships, engage with your network, and pulse with the heartbeat of GitHub.",
    manifest: "/manifest.json",
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "256x256" },
            { url: "/icon.png", sizes: "512x512", type: "image/png" },
            { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
        ],
        shortcut: "/favicon.ico",
        apple: "/icon.png",
    },
    openGraph: {
        title: "GitPulse",
        description: "GitHub's Social Layer",
        url: "https://hubfeed.netlify.app",
        siteName: "GitPulse",
        images: [
            {
                url: "/logo.png",
                width: 1024,
                height: 1024,
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "GitPulse",
        description: "GitHub's Social Layer",
        images: ["/logo.png"],
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth().catch((error) => {
        console.error("[Auth] Failed to resolve layout session:", error);
        return null;
    });



    return (
        <html lang="en" data-theme="github">
            <body className="antialiased min-h-screen bg-git-bg text-git-text overflow-x-hidden font-sans">
                <ThemeProvider>
                    <AppShell sidebar={<Suspense fallback={<div className="w-[224px]"><SidebarSkeleton /></div>}><Sidebar /></Suspense>} bottomNav={<BottomNav username={session?.user?.login} />}>
                        {children}
                    </AppShell>
                </ThemeProvider>
            </body>
        </html>
    );
}

