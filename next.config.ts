import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow higher quality when you need it
    qualities: [75, 85, 90, 100],

    // Prefer modern formats (smaller, sharper)
    formats: ["image/avif", "image/webp"],

    // Good sizes for full-screen + grids
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512, 768, 1024],
  },
};

export default nextConfig;