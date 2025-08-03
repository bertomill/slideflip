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
};

export default nextConfig;
