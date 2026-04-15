import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.86.44"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Disable the client-side router cache for dynamic routes so navigating
    // back to a page always fetches a fresh server render. Without this,
    // Next.js caches the RSC payload for 30 s and can serve stale block state
    // even when force-dynamic is set on the page.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
