"use client";

/**
 * شعار Systemy — مصدر حقيقة واحد لكل استخدامات الشعار في التطبيق.
 *
 * جذر مشكلة «الشعار المكسور» في 5.0: المسارات المطلقة (/brand/…) تنكسر
 * في تصدير الويب الثابت داخل WebView (file:///android_asset/index.html)
 * لأن assetPrefix يكون "./". الاستيراد عبر ESM يجعل المُجمِّع يصدر الأصل
 * بمسار يعمل في كل الأوضاع: dev · standalone · export/WebView.
 * الشعار المتوسط يرسم SVG مضمّناً (Sys S) فلا ينكسر أبداً كطبقة احتياط.
 */
import Image, { type ImageProps } from "next/image";
import logo128 from "@/assets/brand/logo-128.png";
import systemyLogo from "@/assets/brand/systemy-logo.png";

export { logo128, systemyLogo };

type LogoSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { w: number; h: number; radius: string }> = {
  xs: { w: 24, h: 24, radius: "rounded-[8px]" },
  sm: { w: 32, h: 32, radius: "rounded-[10px]" },
  md: { w: 40, h: 40, radius: "rounded-[13px]" },
  lg: { w: 96, h: 96, radius: "rounded-[1.7rem]" },
};

/** شعار الترويسة — روبوت Sys بشريط الهوية */
export function Logo({
  size = "md",
  className,
  priority,
}: {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
}) {
  const s = SIZES[size];
  return (
    <Image
      src={logo128}
      alt="شعار Systemy — روبوت Sys يلتف حوله شريط الهوية"
      width={s.w}
      height={s.h}
      priority={priority}
      draggable={false}
      className={`shrink-0 select-none pointer-events-none ${s.radius} ${className ?? ""}`}
    />
  );
}

/** الشعار الكبير — شاشات الترحيب والإعداد الأولي */
export function LogoHero({ className }: { className?: string }) {
  return (
    <Image
      src={systemyLogo}
      alt="شعار Systemy — روبوت Sys بعينين سعيدتين يحمل لوحة بيانات، يلتف حوله شريط الهوية المتدرج"
      width={96}
      height={96}
      priority
      draggable={false}
      className={`shrink-0 select-none ${className ?? ""}`}
    />
  );
}

/** حرف S بروح Sys — بديل نباتي (inline SVG) لا ينكسر أبداً */
export function SysMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id="sysmark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16B8B0" />
          <stop offset="55%" stopColor="#F2B347" />
          <stop offset="100%" stopColor="#D99026" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#sysmark-grad)" />
      <path
        d="M31.5 18.5c-1-2.6-3.8-4.3-7.6-4.3-4.4 0-7.4 2.2-7.4 5.5 0 2.8 2 4.4 6.4 5.3l2.9.6c2.9.6 4.1 1.5 4.1 3.1 0 2-2.2 3.4-5.6 3.4-3.2 0-5.4-1.3-6.2-3.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="21" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

/** عناصر إضافية مشتركة لصورة عامة بأصل مستورد */
export function BrandImage({ src, alt, ...rest }: { src: string; alt: string } & Omit<ImageProps, "src" | "alt">) {
  return <Image src={src} alt={alt} {...rest} />;
}
