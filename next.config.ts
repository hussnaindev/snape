import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['wrangler', 'miniflare', '@miniflare/core', '@cloudflare/next-on-pages'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // Keep the SW away from the start URL entirely. With `dynamicStartUrl` (the
  // default), next-pwa injects a NetworkFirst route on `/` with a
  // `cacheWillUpdate` handler that is transpiled to SWC helpers
  // (`_async_to_generator`/`_ts_generator`) which are NOT bundled into sw.js —
  // so it throws `ReferenceError` on every load of `/`, tearing down the RSC
  // stream ("Connection closed") and surfacing as a client-side exception.
  // The homepage is dynamic/personalized and must come from the network, so we
  // neither dynamically nor statically cache it.
  dynamicStartUrl: false,
  cacheStartUrl: false,
  workboxOptions: {
    // Avoid rollup terser hangs/early-exits on some Node/tooling combos.
    // This keeps SW generation reliable; it only impacts SW bundle minification.
    mode: 'development',
  },
})(nextConfig);
