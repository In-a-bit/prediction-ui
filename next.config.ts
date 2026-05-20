import type { NextConfig } from "next";

import {
  goWsMarketRewriteDestination,
  goWsUserRewriteDestination,
} from "./lib/server/prediction-ws-upstream";

const nextConfig: NextConfig = {
  // transpilePackages: ["dpm-sdk"],
  // for working locally with the dpm-sdk package use with
  // dpm-sdk": "file:../dpm-sdk" in the package.json

  async rewrites() {
    const market = goWsMarketRewriteDestination();
    const user = goWsUserRewriteDestination();
    if (!market || !user) return [];
    return [
      { source: "/__/go-ws/market", destination: market },
      { source: "/__/go-ws/user", destination: user },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "polymarket-upload.s3.us-east-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.polymarket.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
