import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Official statistics change at most daily; refetch sources every few hours.
    sources: {
      stale: 60 * 60, // 1 hour
      revalidate: 60 * 60 * 3, // 3 hours
      expire: 60 * 60 * 24 * 2, // 2 days
    },
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
