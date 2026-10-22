import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ocean/ui", "@ocean/contracts", "@ocean/core"],
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
};

export default nextConfig;
