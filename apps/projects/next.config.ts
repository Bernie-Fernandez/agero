import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    staleTimes: {
      dynamic: 0,
    },
  },
  transpilePackages: ["@agero/ui"],
};

export default nextConfig;
