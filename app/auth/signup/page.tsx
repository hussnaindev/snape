'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { FloatingAuthBg } from '@/components/auth/floating-bg';
import { AvatarChoice } from '@/components/avatar-choice';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>('/avatar1.png');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, avatarUrl }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Something went wrong');
        return;
      }
      await refresh();
      router.push('/');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-black flex flex-col">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1a2e_0%,_#000_70%)] pointer-events-none" />
      <FloatingAuthBg />
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      {/* Logo */}
      <div className="relative z-10 px-8 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Logo className="w-7 h-7 text-white" />
        </Link>
      </div>

      {/* Form card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm">
          <div className="bg-black/70 backdrop-blur-md border border-white/12 rounded-2xl px-8 py-10 shadow-2xl">
            {/* Heading */}
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-none">
                <Logo className="w-5 h-5 text-white/80" />
              </div>
              <h1 className="text-white text-2xl font-bold">Create account</h1>
            </div>
            <p className="text-white/40 text-sm mb-8 pl-12">Start watching in seconds</p>

            {error && (
              <div className="mb-6 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar */}
              <div className="pt-1">
                <AvatarChoice value={avatarUrl} onChange={setAvatarUrl} label="Profile avatar" />
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          setError('Please select an image file');
                          return;
                        }
                        try {
                          const dataUrl = await resizeImage(file, 200);
                          setAvatarUrl(dataUrl);
                        } catch {
                          setError('Failed to load image');
                        }
                      }}
                    />
                    Upload custom photo instead
                  </label>
                  {avatarUrl?.startsWith('data:') && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('/avatar1.png')}
                      className="text-xs text-white/35 hover:text-white/60 transition-colors"
                    >
                      Reset to presets
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="text-white/60 text-xs font-medium mb-1.5 block">
                  Display name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <UserIcon size={16} />
                  </span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="text-white/60 text-xs font-medium mb-1.5 block">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <MailIcon size={16} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="text-white/60 text-xs font-medium mb-1.5 block"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <LockIcon size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors"
                    placeholder="Enter your password (min. 8 chars)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="mt-1.5 text-xs text-amber-400/80">
                    {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''}{' '}
                    needed
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-semibold text-sm py-3 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <SpinnerIcon /> Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-white/40 text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-white hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
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

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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

function AlertIcon() {
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
      className="flex-none mt-0.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

function resizeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}
