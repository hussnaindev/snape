import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['webtorrent'],
  turbopack: {
    resolveAlias: {
      os: 'os-browserify',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...(config.resolve?.fallback ?? {}),
          fs: false,
          net: false,
          tls: false,
          dns: false,
          dgram: false,
          child_process: false,
          os: 'os-browserify/browser',
          path: false,
          crypto: false,
          stream: false,
          http: false,
          https: false,
          zlib: false,
          buffer: false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
