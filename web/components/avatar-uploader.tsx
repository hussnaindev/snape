'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { UserAvatar } from '@/components/user-avatar';
import { useRef } from 'react';

interface Props {
  onSuccess?: (avatarUrl: string) => void;
  onError?: (msg: string) => void;
  size?: 'md' | 'lg';
}

export function AvatarUploader({ onSuccess, onError, size = 'lg' }: Props) {
  const { user, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  function handleClick() {
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file');
      return;
    }

    try {
      const dataUrl = await resizeImage(file, 200);
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      const json = await res.json();
      if (!json.ok) {
        onError?.(json.error ?? 'Upload failed');
        return;
      }
      await refresh();
      onSuccess?.(dataUrl);
    } catch {
      onError?.('Failed to upload avatar');
    }
  }

  const wrapSize = size === 'lg' ? 'w-20 h-20' : 'w-9 h-9';
  const iconSize = size === 'lg' ? 14 : 10;

  return (
    <div className="relative group cursor-pointer" onClick={handleClick} onKeyDown={() => {}}>
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={size} />
      {/* Edit overlay */}
      <div
        className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${wrapSize}`}
      >
        <CameraIcon size={iconSize} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
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

function CameraIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
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
