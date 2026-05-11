import type { NextConfig } from "next";

const appKey = process.env.APP_API_KEY;
const publicWsPort = process.env.PUBLIC_WS_PORT ?? "8090";
const userWsPort = process.env.USER_WS_PORT ?? "8088";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!appKey) return [];
    const q = encodeURIComponent(appKey);
    return [
      {
        source: "/__/go-ws/market",
        destination: `http://127.0.0.1:${publicWsPort}/ws/market?api_key=${q}`,
      },
      {
        source: "/__/go-ws/user",
        destination: `http://127.0.0.1:${userWsPort}/ws/user?api_key=${q}`,
      },
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
