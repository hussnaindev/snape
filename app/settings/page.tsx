'use client';

import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { AvatarChoice } from '@/components/avatar-choice';
import { AvatarUploader } from '@/components/avatar-uploader';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Tab = 'preferences' | 'account';

type Prefs = {
  autoplayNext: boolean;
  subtitlesEnabled: boolean;
  subtitlesLanguage: string;
  preferredLanguage: string;
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
];

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

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('preferences');

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <AccountLayout>
      <div className="px-4 md:px-8 py-6 md:py-8 pb-20 max-w-2xl">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-none">
            <GearIcon size={17} />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold leading-tight">Settings</h1>
            <p className="text-white/40 text-xs">Preferences &amp; account</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          {(['preferences', 'account'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'preferences' ? <SlidersIcon size={13} /> : <ShieldIcon size={13} />}
              {t}
            </button>
          ))}
        </div>

        {tab === 'preferences' && <PreferencesSettings />}
        {tab === 'account' && <AccountSettings />}
      </div>
    </AccountLayout>
  );
}

function PreferencesSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const { msg, show } = useToast();

  useEffect(() => {
    fetch('/api/preferences')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setPrefs(json.data as Prefs);
      })
      .catch(() => {});
  }, []);

  async function save(updates: Partial<Prefs>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...updates });
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!json.ok) {
        show('err', 'Failed to save');
        return;
      }
      show('ok', 'Saved');
    } catch {
      show('err', 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Toast msg={msg} />
      <div className="space-y-4">
        {/* Playback */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
              <PlayIcon />
            </div>
            <h2 className="text-white font-semibold text-sm">Playback</h2>
          </div>
          <div className="space-y-5">
            <Toggle
              label="Autoplay next episode"
              description="Automatically start the next episode in a series"
              checked={prefs.autoplayNext}
              onChange={(v) => save({ autoplayNext: v })}
              disabled={saving}
            />
            <Toggle
              label="Show subtitles when available"
              description="Display subtitles by default when the video has them"
              checked={prefs.subtitlesEnabled}
              onChange={(v) => save({ subtitlesEnabled: v })}
              disabled={saving}
            />
            {prefs.subtitlesEnabled && (
              <Field label="Subtitle language" icon={<SubtitlesIcon />}>
                <select
                  value={prefs.subtitlesLanguage}
                  onChange={(e) => save({ subtitlesLanguage: e.target.value })}
                  className={SELECT_CLASS}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </section>

        {/* Content */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
              <GlobeIcon />
            </div>
            <h2 className="text-white font-semibold text-sm">Content</h2>
          </div>
          <div className="space-y-5">
            <Field label="Preferred language" icon={<GlobeIcon />}>
              <select
                value={prefs.preferredLanguage}
                onChange={(e) => save({ preferredLanguage: e.target.value })}
                className={SELECT_CLASS}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      </div>
    </>
  );
}

function AccountSettings() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const { msg, show } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        show('err', json.error ?? 'Failed to save');
        return;
      }
      await refresh();
      show('ok', 'Name updated');
    } catch {
      show('err', 'Network error');
    } finally {
      setProfileSaving(false);
    }
  }

  const [newPw, setNewPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) {
      show('err', 'New password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const json = await res.json();
      if (!json.ok) {
        show('err', json.error ?? 'Failed');
        return;
      }
      show('ok', 'Password changed');
      setNewPw('');
    } catch {
      show('err', 'Network error');
    } finally {
      setPwSaving(false);
    }
  }

  const [deleteStage, setDeleteStage] = useState<'idle' | 'confirm'>('idle');
  const [deletePw, setDeletePw] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePw }),
      });
      const json = await res.json();
      if (!json.ok) {
        show('err', json.error ?? 'Failed');
        return;
      }
      await logout();
      router.push('/');
    } catch {
      show('err', 'Network error');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Toast msg={msg} />
      <div className="space-y-6">
        {/* Profile info */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
              <PersonIcon />
            </div>
            <h2 className="text-white font-semibold text-sm">Profile</h2>
          </div>

          <div className="flex flex-col items-center gap-2 mb-6">
            <AvatarUploader
              size="lg"
              onSuccess={() => show('ok', 'Avatar updated')}
              onError={(m) => show('err', m)}
            />
            <p className="text-white/40 text-xs flex items-center gap-1.5">
              <CameraIcon /> Click to change photo
            </p>
          </div>

          <div className="mb-6">
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
                    show('err', json.error ?? 'Failed to update avatar');
                    return;
                  }
                  await refresh();
                  show('ok', next ? 'Avatar updated' : 'Avatar removed');
                } catch {
                  show('err', 'Network error');
                }
              }}
              label="Or pick a preset avatar"
            />
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Display name">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                  <UserIcon size={15} />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  placeholder="Enter your display name"
                  onChange={(e) => setName(e.target.value)}
                  className={`${INPUT_CLASS} pl-10`}
                />
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
                  <MailIcon size={15} />
                </span>
                <div className={`${INPUT_CLASS} pl-10 text-white/40 cursor-not-allowed`}>
                  {user?.email}
                </div>
              </div>
            </Field>
            <button
              type="submit"
              disabled={profileSaving || name.trim() === user?.name}
              className={`${SUBMIT_BTN} flex items-center gap-2`}
            >
              {profileSaving ? (
                <>
                  <SpinnerIcon /> Saving…
                </>
              ) : (
                <>
                  <CheckIcon /> Save
                </>
              )}
            </button>
          </form>
        </section>

        {/* Change password */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
              <LockIcon size={14} />
            </div>
            <h2 className="text-white font-semibold text-sm">Change password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="New password">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                  <KeyIcon />
                </span>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className={`${INPUT_CLASS} pl-10 pr-10`}
                  placeholder="Enter new password (min. 8 chars)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
            <button
              type="submit"
              disabled={pwSaving}
              className={`${SUBMIT_BTN} flex items-center gap-2`}
            >
              {pwSaving ? (
                <>
                  <SpinnerIcon /> Saving…
                </>
              ) : (
                <>
                  <CheckIcon /> Change password
                </>
              )}
            </button>
          </form>
        </section>

        {/* Danger zone */}
        <section className="bg-red-950/30 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangleIcon />
            </div>
            <h2 className="text-red-400 font-semibold text-sm">Danger zone</h2>
          </div>
          <p className="text-white/40 text-sm mb-5 pl-9">
            Permanently delete your account and all data. This cannot be undone.
          </p>

          {deleteStage === 'idle' ? (
            <button
              type="button"
              onClick={() => setDeleteStage('confirm')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <TrashIcon /> Delete account
            </button>
          ) : (
            <form onSubmit={deleteAccount} className="space-y-4">
              <p className="text-white/70 text-sm">
                Enter your password to confirm account deletion.
              </p>
              <Field label="Password">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                    <LockIcon size={15} />
                  </span>
                  <input
                    type="password"
                    required
                    value={deletePw}
                    onChange={(e) => setDeletePw(e.target.value)}
                    className={`${INPUT_CLASS} pl-10 border-red-500/30 focus:border-red-400/60`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
              </Field>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deleteLoading || !deletePw}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading ? (
                    <>
                      <SpinnerIcon /> Deleting…
                    </>
                  ) : (
                    <>
                      <TrashIcon /> Permanently delete
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStage('idle');
                    setDeletePw('');
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-white/40 text-xs mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative flex-none w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-white' : 'bg-white/20'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-1.5">
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Icons ── */

function PersonIcon() {
  return (
    <svg
      width="15"
      height="15"
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

function LockIcon({ size = 16 }: { size?: number }) {
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5 17 6l3 3-1.5 1.5" />
    </svg>
  );
}

function GearIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-white/60"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SlidersIcon({ size = 15 }: { size?: number }) {
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
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function ShieldIcon({ size = 15 }: { size?: number }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="text-white/50 ml-0.5"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-white/50"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SubtitlesIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-red-400"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

function EyeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="13"
      height="13"
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

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 transition-colors';

const SELECT_CLASS =
  "w-full bg-[#111] border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-white/40 transition-colors appearance-none bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] bg-[position:right_12px_center] bg-no-repeat";

const SUBMIT_BTN =
  'px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
