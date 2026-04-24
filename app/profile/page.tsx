'use client';

import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { AvatarChoice } from '@/components/avatar-choice';
import { AvatarUploader } from '@/components/avatar-uploader';
import { useEffect, useRef, useState } from 'react';

function Toast({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl border animate-fade-in pointer-events-none ${
        msg.type === 'ok'
          ? 'bg-zinc-900 border-green-500/30 text-green-400'
          : 'bg-zinc-900 border-red-500/30 text-red-400'
      }`}
    >
      {msg.text}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function show(type: 'ok' | 'err', text: string) {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ type, text });
    timer.current = setTimeout(() => setMsg(null), 2800);
  }
  return { msg, show };
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (!user) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.show('err', json.error ?? 'Failed to save');
        return;
      }
      await refresh();
      toast.show('ok', 'Profile updated');
    } catch {
      toast.show('err', 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountLayout>
      <Toast msg={toast.msg} />
      <div className="px-4 md:px-8 py-6 md:py-8 pb-20 max-w-2xl">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-none">
            <PersonIcon />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold leading-tight">Profile</h1>
            <p className="text-white/40 text-xs">Manage your public info</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
          {/* Avatar with upload */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <AvatarUploader
              size="lg"
              onSuccess={() => toast.show('ok', 'Avatar updated')}
              onError={(m) => toast.show('err', m)}
            />
            <p className="text-white/40 text-xs flex items-center gap-1.5">
              <CameraIcon /> Click to change photo
            </p>
          </div>

          <div className="mb-8">
            <AvatarChoice
              value={user?.avatarUrl ?? null}
              onChange={async (next) => {
                try {
                  const res = await fetch('/api/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatarUrl: next }),
                  });
                  const json = await res.json();
                  if (!json.ok) {
                    toast.show('err', json.error ?? 'Failed to update avatar');
                    return;
                  }
                  await refresh();
                  toast.show('ok', next ? 'Avatar updated' : 'Avatar removed');
                } catch {
                  toast.show('err', 'Network error');
                }
              }}
              label="Or pick a preset avatar"
            />
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-1.5"
              >
                <UserIcon size={12} /> Display name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                  <UserIcon size={15} />
                </span>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-1.5">
                <MailIcon size={12} /> Email
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
                  <MailIcon size={15} />
                </span>
                <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white/40 text-sm select-none">
                  {user.email}
                </div>
              </div>
              <p className="mt-1 text-white/25 text-xs pl-1">
                Email cannot be changed at this time
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || name.trim() === user.name}
              className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <SpinnerIcon /> Saving…
                </>
              ) : (
                <>
                  <CheckIcon /> Save changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </AccountLayout>
  );
}

function PersonIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-white/60"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function UserIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function MailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
