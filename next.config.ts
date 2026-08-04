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
      "camera=(), microphone=(), geolocation=(), accelerometer=*, gyroscope=*, magnetometer=*, payment=(self \"https://api.razorpay.com\" \"https://checkout.razorpay.com\")",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  experimental: {
    // Default in Next 16 is true; persistent Turbopack dev cache is flaky on some Windows setups.
    turbopackFileSystemCacheForDev: false,
    /**
     * Rewrites barrel imports to deep per-symbol imports so a page only pulls what it
     * names. `framer-motion` matters most here: ~55 client files import it, and most use
     * only `motion` and `AnimatePresence`. `recharts` is admin-dashboard-only but its
     * barrel is large, and `date-fns` is imported widely for one or two helpers.
     */
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "date-fns"],
  },
  images: {
    // Prefer modern codecs: the curriculum diagrams in `public/images` are 200KB–1MB PNGs,
    // and AVIF/WebP conversion is where most of that goes away for students on mobile data.
    formats: ["image/avif", "image/webp"],
    // Trimmed from the default ladder to the widths this UI actually renders at, so the
    // optimizer caches fewer variants of the same diagram.
    deviceSizes: [360, 640, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
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
