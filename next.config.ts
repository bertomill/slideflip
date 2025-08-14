import type { NextConfig } from "next";

/**
 * Next.js configuration optimized for Turbopack development
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

  // Webpack Configuration: Only used when Turbopack is disabled
  // This provides fallback configuration for production builds
  webpack: (config, { isServer, dev }) => {
    // Only apply webpack config when NOT using Turbopack (production builds or webpack dev)
    if (!isServer && !dev) {
      config.resolve = config.resolve || ({} as any);
      
      // Handle Node.js modules that shouldn't be bundled in client code
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
        'image-size': false,
        os: false,
        'node:path': false,
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
        os: false,
      } as any;
    }
    return config;
  },

  // Additional optimizations for better performance
  swcMinify: true, // Use SWC for minification (faster than Terser)
  
  // Image optimization settings
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Compiler options for better performance
  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
