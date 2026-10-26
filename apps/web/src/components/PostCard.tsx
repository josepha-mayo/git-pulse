"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShareAndroidIcon, SyncIcon, TrashIcon, KebabHorizontalIcon } from '@primer/octicons-react';
import RepoCard from './RepoCard';
import AiSummary from './AiSummary';
import ReactionPicker from './ReactionPicker';
import CommentSection from './CommentSection';
import TimeDisplay from './TimeDisplay';
import QuoteModal from './QuoteModal';

export type PostType = 'standard' | 'ship';

export interface PostProps {
  id: string;
  type: PostType;
  author: {
    username: string;
    avatar: string;
    statusEmoji?: string | null;
    statusText?: string | null;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reactions?: {emoji: string;count: number;hasReacted: boolean;}[];
  images?: string[];
  hashtags?: string[];
  repoUrl?: string | null;
  score?: number;
  passedBadge?: boolean;
  repoEmbed?: {
    name: string;
    description: string;
    language: string;
    languageColor: string;
    stars: number;
    forks: number;
    lastPush: string;
  };
  shipDetails?: {
    version: string;
    changelog: string;
  };
  quotedPost?: PostProps;
  isNested?: boolean;
  isRepost?: boolean;
  repostedBy?: string;
  isExternalEvent?: boolean;
  externalUrl?: string;
}

export default function PostCard({ post, isNested, currentUsername }: {post: PostProps; isNested?: boolean; currentUsername?: string;}) {
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const [localReactions, setLocalReactions] = useState(post.reactions || []);
  const [isReposting, setIsReposting] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Check if current user is the post author
  const isAuthor = currentUsername === post.author.username;

  // Close repost menu on outside click
  React.useEffect(() => {
    if (!showRepostMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-repost-menu]')) {
        setShowRepostMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRepostMenu]);

  // Close options menu on outside click
  React.useEffect(() => {
    if (!showOptionsMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-options-menu]')) {
        setShowOptionsMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptionsMenu]);

  // Close share menu on outside click
  React.useEffect(() => {
    if (!showShareMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-share-menu]')) {
        setShowShareMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

const handleNavigate = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Prevent routing if clicking interactive elements (links, buttons, icons, or images inside content)
    if (target.closest('a') || target.closest('button') || target.closest('svg') || target.tagName.toLowerCase() === 'img') {
      return;
    }
    // if text selection is occurring, don't navigate
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    
    if (post.isExternalEvent && post.externalUrl) {
      try {
        window.open(post.externalUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        console.error('Error opening external link:', error);
      }
      return;
    }
    
    try {
      router.push(`/post/${post.id}`);
    } catch (error) {
      console.error('Error navigating to post:', error);
    }
  };

const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUsername) { router.push("/login"); return; }
    if (isReposting) return;
    
    setIsReposting(true);
    setShowRepostMenu(false);
    
    try {
      const res = await fetch(`/api/posts/${post.id}/repost`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.action === 'reposted') {
          // Success - just close menu, SSE will update feed
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
        } else {
          // Unreposted
          window.location.reload();
        }
      } else {
        throw new Error(`Repost failed with status ${res.status}`);
      }
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost. Please try again.');
    } finally {
      setIsReposting(false);
    }
  };

const handleReact = async (emoji: string) => {
    if (!currentUsername) { router.push("/login"); return; }
    try {
      const res = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      
      if (res.ok) {
        const data = await res.json();
        const existing = localReactions.find((r) => r.emoji === emoji);
        if (data.action === 'added') {
          if (existing) {
            setLocalReactions(localReactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r));
          } else {
            setLocalReactions([...localReactions, { emoji, count: 1, hasReacted: true }]);
          }
        } else {
          setLocalReactions(localReactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r).filter((r) => r.count > 0));
        }
      } else {
        throw new Error(`Reaction failed with status ${res.status}`);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Display error message to user
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (res.ok) {
        // Reload the page to show updated feed
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
      setShowOptionsMenu(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setShowShareMenu(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShareX = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const handleShareWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  return (
    <>
    {showQuoteModal && <QuoteModal post={post} onClose={() => setShowQuoteModal(false)} />}
    <div 
      onClick={handleNavigate} 
      className={`relative flex flex-col ${isNested ? 'px-3 py-3 border-none hover:bg-transparent' : 'px-4 py-4 border-b border-git-border hover:bg-git-hover'} transition-colors cursor-pointer`}
    >
      
      {/* repost header */}
      {post.isRepost && post.repostedBy && (
        <div className="flex items-center gap-2 text-xs text-git-muted font-bold mb-2 ml-10 relative z-10">
          <SyncIcon size={14} className="fill-git-muted" />
          <span>{post.repostedBy} reposted</span>
        </div>
      )}

      <div className="flex gap-3 relative z-10">
        {/* left column: avatar & thread line */}
      <div className="relative z-10 flex flex-col items-center">
        <Link href={`/profile/${post.author.username}`} className="block">
          <Image
            src={post.author.avatar}
            alt={post.author.username}
            width={40}
            height={40}
            className="rounded-full border border-git-border bg-git-bg shrink-0" />
        </Link>
        
        {showComments && <div className="w-[2px] h-full bg-git-border mt-2 rounded-full"></div>}
      </div>

      {/* right column: content */}
      <div className="flex-1 flex flex-col min-w-0">
          {/* header */}
          <div className="relative z-10 flex items-center gap-2 mb-2 w-full">
            <Link href={`/profile/${post.author.username}`} className="font-semibold text-git-text hover:text-git-accent transition-colors text-[15px]">
              <span className="flex items-center gap-1.5">
                <span>{post.author.username}</span>
                {post.author.statusEmoji && (
                  <span className="text-[14px] leading-none" title={post.author.statusText || "User status"}>
                    {post.author.statusEmoji}
                  </span>
                )}
              </span>
            </Link>
            {post.passedBadge &&
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-git-green/10 border border-git-green/20 text-git-green text-[10px] font-bold uppercase tracking-wider select-none shrink-0" title="Score passed quality threshold">
                    <svg aria-hidden="true" height="12" viewBox="0 0 16 16" width="12" className="fill-current">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                    </svg>
                    Passed
                </div>
          }
            
            {/* badges */}
            {post.type === 'ship' &&
          <span className="text-[10px] bg-git-green text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Shipped {post.shipDetails?.version}
            </span>
          }
          {post.content.startsWith('Opened PR') &&
          <svg height="14" viewBox="0 0 16 16" width="14" className="fill-[#a371f7] shrink-0" aria-label="Pull Request">
              <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
            </svg>
          }
          {post.content.startsWith('Opened issue') &&
          <svg height="14" viewBox="0 0 16 16" width="14" className="fill-[#3fb950] shrink-0" aria-label="Issue">
              <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
            </svg>
          }
          {post.content.startsWith('Pushed') &&
          <svg height="14" viewBox="0 0 16 16" width="14" className="fill-git-muted shrink-0" aria-label="Push">
              <path d="M10.5 7.75a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm1.43.75a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
            </svg>
          }
          <span className="text-xs text-git-muted shrink-0 ml-auto"><TimeDisplay time={post.timestamp} /></span>
          
          {/* Options menu (delete, etc.) */}
          {!isNested && isAuthor && currentUsername && (
            <div className="relative ml-2" data-options-menu>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowOptionsMenu(!showOptionsMenu); }}
                className="text-git-muted hover:text-git-text transition-colors p-1 rounded hover:bg-git-border/30"
                title="Post options">
                <KebabHorizontalIcon size={16} />
              </button>
              
              {showOptionsMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-git-bg border border-git-border rounded-lg shadow-xl overflow-hidden animate-fade-in z-50">
                  <div
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2.5 text-sm text-git-error hover:bg-git-error/10 transition-colors font-medium flex items-center gap-2 cursor-pointer select-none"
                    style={{ pointerEvents: isDeleting ? 'none' : 'auto', opacity: isDeleting ? 0.5 : 1 }}>
                    <TrashIcon size={14} />
                    <span>{isDeleting ? 'Deleting...' : 'Delete post'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* text content (markdown rendered) */}
        <div className="relative z-10 text-sm text-git-text mb-3 leading-relaxed break-words whitespace-pre-wrap markdown-body" style={{ background: 'transparent', padding: 0 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                // turn mentions into profile links if it's not a real url
                if (href?.startsWith('@')) {
                  return <Link href={`/profile/${href.substring(1)}`} className="text-git-accent hover:underline">{children}</Link>;
                }
                if (href?.startsWith('#')) {
                  return <Link href={`/explore/tags/${href.substring(1)}`} className="text-git-accent hover:underline">{children}</Link>;
                }
                return <a href={href} className="text-git-accent hover:underline" target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>;
              },
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
            }}>
            
            {/* simple pre-processor for #tags and @mentions to turn them into markdown links if not already */}
            {(post.content || '').replace(/(^|\s)(#[\w-]+)/g, '$1[$2]($2)').replace(/(^|\s)(@[\w-]+)/g, '$1[$2]($2)')}
          </ReactMarkdown>
        </div>

        {/* images */}
        {post.images && post.images.length > 0 &&
        <div className={`relative z-10 mb-3 grid gap-2 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {post.images.map((img, i) =>
          <div key={i} className="relative aspect-video w-full overflow-hidden rounded-lg border border-git-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="Post attachment" className="object-cover w-full h-full" loading="lazy" />
              </div>
          )}
          </div>
        }

        {/* ship changelog (if applicable) */}
        {post.type === 'ship' && post.shipDetails &&
        <div className="relative z-10 mb-3 p-3 rounded-lg border border-git-green/30 bg-git-green/5 text-sm font-mono text-git-muted">
            <div className="text-git-green font-semibold mb-2">Changelog:</div>
            <div className="whitespace-pre-wrap">{post.shipDetails.changelog}</div>
          </div>
        }

        {/* embedded repo card */}
        {post.repoEmbed &&
        <div className="relative z-10 mb-3 max-w-full">
            <RepoCard {...post.repoEmbed} />
            {post.repoEmbed.name &&
              (() => {
                // repoembed.name stores full_name format (e.g. "facebook/react")
                const parts = post.repoEmbed.name.split('/');
                const repoOwner = parts[0] || post.author.username;
                const repoName = parts.slice(1).join('/') || post.repoEmbed.name;
                return <AiSummary owner={repoOwner} repoName={repoName} />;
              })()
          }
          </div>
        }

        {/* quoted post */}
        {post.quotedPost && (
          <div className="relative z-10 mb-3 border border-git-border rounded-xl overflow-hidden mt-1 bg-git-bg opacity-90 transition-opacity hover:opacity-100">
            <PostCard post={post.quotedPost} isNested={true} currentUsername={currentUsername} />
          </div>
        )}

        {/* action bar */}
        {!isNested && (
        <div className="relative z-10 flex items-center gap-6 mt-1 w-full">
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 text-git-muted hover:text-git-accent transition-colors group ${showComments ? 'text-git-accent' : ''}`}
            title="Comments">
            
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" className="fill-current group-hover:bg-git-accent/10 rounded pb-0.5 px-0.5">
              <path d="M1.75 1.5a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25H1.75ZM0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25v-9.5Z"></path>
            </svg>
            <span className="text-xs">{post.comments}</span>
          </button>
          
          <ReactionPicker
            postId={post.id}
            onReact={handleReact}
            currentReactions={localReactions} />
          
          <div className="flex-1 flex justify-end gap-5 relative">
            
            <div className="relative flex items-center" data-repost-menu>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!currentUsername) { router.push("/login"); return; } setShowRepostMenu(!showRepostMenu); }}
                disabled={isReposting}
                className={`flex items-center gap-1.5 text-git-muted transition-colors group ${isReposting ? 'opacity-50' : 'hover:text-git-success'}`}
                title="Repost menu">
                <SyncIcon size={16} className="group-hover:bg-git-success/10 rounded" />
              </button>
              
              {showRepostMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-git-bg border border-git-border rounded-xl shadow-xl overflow-hidden animate-fade-in z-50">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRepostMenu(false); handleRepost(e); }} className="w-full text-left px-4 py-2.5 text-sm text-git-text hover:bg-white/5 transition-colors font-semibold flex items-center gap-2">
                    <SyncIcon size={14} /> Repost
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRepostMenu(false); setShowQuoteModal(true); }} className="w-full text-left px-4 py-2.5 text-sm text-git-text hover:bg-white/5 transition-colors font-semibold flex items-center gap-2 border-t border-git-border">
                    <svg viewBox="0 0 16 16" width="14" height="14" className="fill-current"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg> Quote
                  </button>
                </div>
              )}
            </div>

            <div className="relative flex items-center" data-share-menu>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowShareMenu(!showShareMenu); }}
                className="flex items-center gap-1.5 text-git-muted hover:text-git-accent transition-colors group"
                title="Share post">
                <ShareAndroidIcon size={16} className="group-hover:bg-git-accent/10 rounded" />
              </button>
              
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-44 bg-git-bg border border-git-border rounded-xl shadow-xl overflow-hidden animate-fade-in z-50">
                  <button 
                    onClick={handleCopyLink}
                    className="w-full text-left px-4 py-2.5 text-sm text-git-text hover:bg-white/5 transition-colors font-semibold flex items-center gap-3">
                    {copySuccess ? (
                      <>
                        <svg viewBox="0 0 16 16" width="16" height="16" className="fill-git-success">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                        </svg>
                        <span className="text-git-success">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 16 16" width="16" height="16" className="fill-current">
                          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                        </svg>
                        Copy link
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleShareX}
                    className="w-full text-left px-4 py-2.5 text-sm text-git-text hover:bg-white/5 transition-colors font-semibold flex items-center gap-3 border-t border-git-border">
                    <svg viewBox="0 0 24 24" width="16" height="16" className="fill-current">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    Share on X
                  </button>
                  <button 
                    onClick={handleShareWhatsApp}
                    className="w-full text-left px-4 py-2.5 text-sm text-git-text hover:bg-white/5 transition-colors font-semibold flex items-center gap-3 border-t border-git-border">
                    <svg viewBox="0 0 24 24" width="16" height="16" className="fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path>
                    </svg>
                    Share on WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* expandable comments */}
        {!isNested && showComments && (
        <div className="relative z-10 mt-3 border-t border-git-border pt-4">
          <CommentSection postId={post.id} />
        </div>
        )}
      </div>
    </div>
  </div>
  </>
  );
}