import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/ui"],
  poweredByHeader: false,
};

export default nextConfig;
