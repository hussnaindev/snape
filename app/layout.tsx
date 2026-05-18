import { AuthProvider } from '@/components/auth/auth-provider';
import { PlayerControlsProvider } from '@/lib/player-controls-context';
import { FullStoryInit } from '@/components/fullstory-init';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { APP_NAME } from '@/lib/config';
import type { Metadata, Viewport } from 'next';
import { Bungee, Cormorant_Garamond, DM_Sans, Syne } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { GoogleAnalytics } from '@next/third-parties/google';

const bungee = Bungee({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bungee',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
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
    <html
      lang="en"
      className={`${dmSans.variable} ${cormorantGaramond.variable} ${bungee.variable} ${syne.variable}`}
    >
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
        <NextTopLoader color="#ffffff" height={2} showSpinner={false} />
        <FullStoryInit />
        <PwaInstallPrompt />
        <PlayerControlsProvider>
          <AuthProvider>{children}</AuthProvider>
        </PlayerControlsProvider>
      </body>
      <GoogleAnalytics gaId="G-J9LY8F7YKQ" />
    </html>
  );
}
