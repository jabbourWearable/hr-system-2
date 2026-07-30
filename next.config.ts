import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Next.js can
  // infer the wrong root from a lockfile elsewhere on the machine (e.g. in
  // a parent/home directory outside this repo).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
