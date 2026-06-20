import type { NextConfig } from "next";

const defaultSecurityHeaders = [
  // Allow embedding only within the same origin (enables in-app previews without clickjacking exposure).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Razorpay checkout uses device-motion fingerprinting; blocking sensors breaks card/UPI flows.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), accelerometer=*, gyroscope=*, payment=(self \"https://api.razorpay.com\" \"https://checkout.razorpay.com\")",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  experimental: {
    // Default in Next 16 is true; persistent Turbopack dev cache is flaky on some Windows setups.
    turbopackFileSystemCacheForDev: false,
    /** Tree-shake icon imports in dev/prod — large pages with many `lucide-react` icons compile faster. */
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: defaultSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
