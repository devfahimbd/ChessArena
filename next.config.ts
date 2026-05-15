import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cPanel shared hosting এ static files হিসেবে deploy করার জন্য
  output: "export",
  // Static export এ images unoptimized রাখতে হয়
  images: {
    unoptimized: true,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
