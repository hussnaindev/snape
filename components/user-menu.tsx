'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { UserAvatar } from '@/components/user-avatar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function UserMenu() {
  const { user, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click (desktop)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (isLoading) {
    return <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
      >
        Sign in
      </Link>
    );
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="User menu"
        aria-expanded={open}
      >
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
      </button>

      {open && (
        <>
          {/* ── Mobile: full-screen backdrop ── */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* ── Mobile: right-side drawer ── */}
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-72 bg-[#0f0f10] z-[61] border-l border-white/10 flex flex-col shadow-2xl animate-slide-in-right">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 pt-12 pb-5 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-white/40 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-2 flex-none w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 py-3 px-3 space-y-0.5">
              <DrawerItem href="/profile" onClick={() => setOpen(false)}>
                <ProfileIcon /> Profile
              </DrawerItem>
              <DrawerItem href="/watchlist" onClick={() => setOpen(false)}>
                <BookmarkIcon /> My Watchlist
              </DrawerItem>
              <DrawerItem href="/settings" onClick={() => setOpen(false)}>
                <SettingsIcon /> Settings
              </DrawerItem>
            </nav>

            {/* Drawer sign out */}
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <SignOutIcon /> Sign out
              </button>
            </div>
          </div>

          {/* ── Desktop: dropdown ── */}
          <div className="hidden md:block absolute top-full right-0 mt-2 w-52 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-white text-sm font-semibold truncate">{user.name}</p>
              <p className="text-white/40 text-xs truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <DropdownItem href="/profile" onClick={() => setOpen(false)}>
                <ProfileIcon /> Profile
              </DropdownItem>
              <DropdownItem href="/watchlist" onClick={() => setOpen(false)}>
                <BookmarkIcon /> My Watchlist
              </DropdownItem>
              <DropdownItem href="/settings" onClick={() => setOpen(false)}>
                <SettingsIcon /> Settings
              </DropdownItem>
            </div>
            <div className="border-t border-white/10 py-1">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors text-left"
              >
                <SignOutIcon /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DrawerItem({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
    >
      {children}
    </Link>
  );
}

function DropdownItem({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
