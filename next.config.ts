import type { NextConfig } from "next";

// Hardening headers that cannot break gameplay: no script/style/media CSP
// (inline styles, blob audio and Next's inline bootstrap would all need
// allowances), only framing, plugin and base-URL limits. The microphone stays
// allowed for this origin; fullscreen keeps its default.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
