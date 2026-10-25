import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    optimizePackageImports: [
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@inkbar/react",
      "docx",
      "pdf-lib",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
