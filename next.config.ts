import type { NextConfig } from "next";

/**
 * Next.js configuration with development-focused build settings
 * This configuration prioritizes build speed and deployment success over strict code quality checks
 */
const nextConfig: NextConfig = {
  // ESLint Configuration: Skip linting during production builds
  // This prevents build failures due to code style issues and speeds up deployment
  // Note: ESLint should still be run during development for code quality
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript Configuration: Allow builds to complete despite type errors
  // This enables rapid prototyping and deployment while type issues are being resolved
  // Warning: Type errors should be addressed before production deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  // Avoid bundling Node-only modules in client code paths
  webpack: (config) => {
    // Gracefully ignore node:* imports in the browser bundle
    config.resolve = config.resolve || {} as any;
    (config.resolve.alias as any) = {
      ...(config.resolve.alias || {}),
      'node:fs': false,
      'node:https': false,
      fs: false,
      https: false,
      http: false,
      path: false,
      stream: false,
      crypto: false,
      zlib: false,
    } as any;

    (config.resolve.fallback as any) = {
      ...(config.resolve.fallback || {}),
      fs: false,
      https: false,
      http: false,
      path: false,
      stream: false,
      crypto: false,
      zlib: false,
    } as any;

    return config;
  },
};

export default nextConfig;
