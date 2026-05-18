'use client';

import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';

type UserChoiceOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: UserChoiceOutcome; platform: string }>;
}

const DISMISSED_KEY = 'pwa_install_prompt_dismissed_v1';
const INSTALLED_KEY = 'pwa_installed_v1';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /safari/i.test(ua);
  const isOther = /crios|fxios|opios|edgios|chrome|android/i.test(ua);
  return isSafari && !isOther;
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if (
    'standalone' in window.navigator &&
    typeof (window.navigator as { standalone?: unknown }).standalone === 'boolean'
  ) {
    return Boolean((window.navigator as { standalone: boolean }).standalone);
  }
  // Other browsers
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [iosA2hs, setIosA2hs] = useState(false);

  const dismissed = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  }, []);

  useEffect(() => {
    setReady(true);

    const installed = isInStandaloneMode() || window.localStorage.getItem(INSTALLED_KEY) === '1';
    setIsInstalled(installed);
    if (installed) return;
    if (dismissed) return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Chromium: capture the event so we can show a custom UI.
      e.preventDefault?.();
      const event = e as BeforeInstallPromptEvent;
      setDeferred(event);
      deferredRef.current = event;
      setShow(true);
    };

    const onAppInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, '1');
      setIsInstalled(true);
      setShow(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);

    // Listen for external trigger from banner
    const onExternalTrigger = async () => {
      if (deferredRef.current) {
        try {
          await deferredRef.current.prompt();
          const { outcome } = await deferredRef.current.userChoice;
          if (outcome === 'accepted') {
            window.localStorage.setItem(INSTALLED_KEY, '1');
            setIsInstalled(true);
          }
        } catch {}
      }
    };
    window.addEventListener('pwa-install-trigger', onExternalTrigger);

    // iOS Safari: no `beforeinstallprompt`, so show A2HS hint once.
    if (isIos() && isIosSafari() && !isInStandaloneMode()) {
      setIosA2hs(true);
      setShow(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('pwa-install-trigger', onExternalTrigger);
    };
  }, [dismissed]);

  if (!ready) return null;
  if (isInstalled) return null;
  if (!show) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        window.localStorage.setItem(INSTALLED_KEY, '1');
        setIsInstalled(true);
      } else {
        window.localStorage.setItem(DISMISSED_KEY, '1');
      }
    } finally {
      setDeferred(null);
      setShow(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/85 backdrop-blur px-4 py-3',
        'supports-[backdrop-filter]:bg-black/60',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">Install Snape</div>
          {iosA2hs && !deferred ? (
            <div className="mt-1 text-xs text-white/70">
              On iPhone/iPad: tap <span className="font-semibold text-white/90">Share</span> then{' '}
              <span className="font-semibold text-white/90">Add to Home Screen</span>.
            </div>
          ) : (
            <div className="mt-1 text-xs text-white/70">
              Get faster access and an app-like experience.
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={deferred ? install : dismiss}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 cursor-pointer"
          >
            {deferred ? 'Install' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
