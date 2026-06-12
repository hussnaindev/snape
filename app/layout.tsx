import { AuthProvider } from '@/components/auth/auth-provider';
import { FullStoryInit } from '@/components/fullstory-init';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { Toaster } from '@/components/toaster';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { PlayerControlsProvider } from '@/lib/player-controls-context';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { Suspense } from 'react';
import './globals.css';
import { GoogleAnalytics } from '@next/third-parties/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: 'Stream movies instantly. No sign-up required.',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <head>
        <meta name="theme-color" content="#000000" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
      </head>
      <body className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
        <NextTopLoader color="#ffffff" height={2} showSpinner={false} />
        <FullStoryInit />
        <PwaInstallPrompt />
        <PlayerControlsProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <Topbar />
            </Suspense>
            {children}
          </AuthProvider>
          <Toaster />
        </PlayerControlsProvider>
      </body>
      <GoogleAnalytics gaId="G-J9LY8F7YKQ" />
    </html>
  );
}
