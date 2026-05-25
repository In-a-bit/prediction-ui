import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transpilePackages: ["dpm-sdk"],
  // for working locally with the dpm-sdk package use with
  // dpm-sdk": "file:../dpm-sdk" in the package.json

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
