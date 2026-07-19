import type { NextConfig } from "next";

/** Privy optional peers we don't use (Solana, Stripe onramp, etc.). */
const PRIVY_OPTIONAL_PEERS = [
  "@abstract-foundation/agw-client",
  "@farcaster/mini-app-solana",
  "@solana/kit",
  "@solana-program/memo",
  "@solana-program/system",
  "@solana-program/token",
  "@stripe/crypto",
  "permissionless",
] as const;

const nextConfig: NextConfig = {
  // Privy is now used exclusively inside @inabit-com/dpm-sdk (<DpmWalletProvider>),
  // so there is a single Privy instance and no duplicate-context aliasing is
  // needed — the app never imports @privy-io/react-auth directly.
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    const alias = config.resolve.alias as Record<string, string | false>;
    for (const pkg of PRIVY_OPTIONAL_PEERS) {
      alias[pkg] = false;
    }
    return config;
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
