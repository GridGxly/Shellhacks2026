import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone testing through a Cloudflare quick tunnel.
  allowedDevOrigins: ['*.trycloudflare.com'],
};

export default nextConfig;
