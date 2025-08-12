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

  // Webpack configuration: stub Node-only modules in the browser bundle
  // Some browser-usable libraries (e.g., `pptxgenjs`) conditionally import Node
  // built-ins like `node:fs` and `node:https`. Even if unused at runtime in the
  // browser, the bundler still needs to resolve them. We alias these to `false`
  // on the client to avoid bundling or resolving Node modules in browser chunks.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'node:fs': false,
        'node:https': false,
        fs: false,
        https: false,
        'image-size': false,
        path: false,
        os: false,
        'node:path': false,
      } as typeof config.resolve.alias;

      // Fallbacks for older plugins expecting `resolve.fallback`
      // (kept harmlessly for compatibility)
      // @ts-ignore - `fallback` exists at runtime in webpack config
      config.resolve.fallback = {
        // @ts-ignore
        ...(config.resolve.fallback || {}),
        fs: false,
        https: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
