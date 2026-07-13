import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Privy is now used exclusively inside @inabit-com/dpm-sdk (<DpmWalletProvider>),
  // so there is a single Privy instance and no duplicate-context aliasing is
  // needed — the app never imports @privy-io/react-auth directly.
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
