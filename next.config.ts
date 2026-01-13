import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static optimization for pages that use Socket.IO
  // This ensures proper hydration with dynamic content
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
