import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Next infer the wrong
  // workspace root, which in turn breaks Tailwind's source detection. Pin it.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
