'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { Topbar } from '@/components/topbar';
import { UserAvatar } from '@/components/user-avatar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const nav = [
    { href: '/profile', label: 'Profile', icon: <PersonIcon /> },
    { href: '/watchlist', label: 'Watchlist', icon: <BookmarkIcon /> },
    { href: '/settings', label: 'Settings', icon: <GearIcon /> },
  ];

  return (
    <>
      <Topbar />

      {/* Mobile-only tab strip — sits directly below the 64px topbar */}
      <div className="md:hidden fixed top-16 inset-x-0 z-40 bg-[#070b08]/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span className={active ? 'text-white' : 'text-white/40'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex pt-16 min-h-screen">
        {/* Desktop sidebar — fixed */}
        <aside className="hidden md:flex flex-col fixed left-0 top-16 bottom-0 w-56 border-r border-white/8 bg-[#070b08] px-3 pt-6 pb-8">
          {/* Avatar + user info */}
          <div className="flex flex-col items-center gap-2.5 px-2 pb-5 mb-4 border-b border-white/8">
            <div className="relative">
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
            </div>
            <div className="text-center w-full min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user.name}</p>
              <p className="text-white/40 text-xs truncate">{user.email}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 md:ml-56">
          {/* Spacer for mobile tab strip (~48px) */}
          <div className="h-[48px] md:hidden" />
          {children}
        </div>
      </div>
    </>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
