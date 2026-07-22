import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@rpm/ui', '@rpm/contracts'],
  eslint: {
    // Workspace ESLint runs via `pnpm lint`; Next plugin is optional for foundation.
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['@rpm/ui'],
  },
};

export default nextConfig;
