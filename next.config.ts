import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    ignoreIssue: [
      {
        path: "**/favicon.ico",
      },
      {
        path: "**/*favicon*",
      },
      {
        path: "**/*icon*",
      },
    ],
  },
};

export default nextConfig;
