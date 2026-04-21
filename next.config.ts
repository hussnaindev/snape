import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
  workboxOptions: {
    // Avoid rollup terser hangs/early-exits on some Node/tooling combos.
    // This keeps SW generation reliable; it only impacts SW bundle minification.
    mode: 'development',
  },
})(nextConfig);
