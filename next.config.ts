import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // الوضع الافتراضي: standalone — تتوقعه سكربتات البناء/التشغيل لدى المنصة
  // (نسخ .next/static إلى .next/standalone). وضع export فقط عند BUILD_EXPORT=1
  // (تصدير الويب الثابت لبناء APK عبر scripts/build-web-export.sh).
  output: process.env.BUILD_EXPORT === "1" ? "export" : "standalone",
  assetPrefix: process.env.BUILD_EXPORT === "1" ? "./" : undefined,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space.zhipuaidemo.cn", "localhost"],
};

export default nextConfig;
