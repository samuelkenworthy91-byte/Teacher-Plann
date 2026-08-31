import type { NextConfig } from "next";

/**
 * MarkFlow ships as an offline Android app: `next build` emits a fully static
 * site into `out/`, which Capacitor packages inside the APK. Nothing is
 * rendered on a server at runtime, so every route must be exportable.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Capacitor serves the bundle from a local file server — directory-style
  // URLs (`/dashboard/`) resolve to `dashboard/index.html`.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
