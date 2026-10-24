"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import {
  Download,
  LayoutGrid,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Target,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemyApp } from "@/components/systemy/app";
import { PhoneFrame } from "@/components/systemy/phone-frame";
import { isStandalone, standaloneServerSnapshot, subscribeNever } from "@/lib/standalone";

const APK_URL = "/downloads/Systemy-v5.0.apk";
const APK_SIZE = "3.3MB";
const APK_VERSION = "Systemy-v5.0";
const APK_NAME = "Systemy-v5.0.apk";

/**
 * عالم الصفحة النهاري V5 «الشريط»:
 * أبيض دافئ #FAF8F2 مع وهج شريطي خافت — النظير الفاتح لقوقعة التطبيق الداكنة
 * (نهار/ليل: الصفحة تقنع، والتطبيق داخل الهاتف يشغّل).
 */
const PAGE_LIGHT_BG = {
  backgroundColor: "#FAF8F2",
  backgroundImage: [
    "radial-gradient(56% 42% at 84% 0%, rgba(0, 205, 254, 0.07), transparent 62%)",
    "radial-gradient(48% 40% at 6% 94%, rgba(254, 187, 24, 0.08), transparent 64%)",
    "radial-gradient(36% 28% at 55% 58%, rgba(62, 155, 246, 0.045), transparent 70%)",
  ].join(", "),
} as const;

/** ظل البطاقة الفاتحة: حلقة 1px + لمسة تلامس + رفع ناعم (النسخة النهارية من --shadow-border) */
const CARD_SHADOW =
  "shadow-[0_0_0_1px_rgba(16,20,35,0.06),0_1px_2px_rgba(16,20,35,0.05),0_14px_30px_-18px_rgba(16,20,35,0.16)]";

/** متغيرا دخول ribbon-enter — يُقرآن من عنصر الدخول نفسه */
const ENTER_VARS = { "--distance-medium": "12px", "--blur-small": "2px" } as CSSProperties;

/** دخول متدرج: كتلة × 40ms كحد أقصى في أول تحميل فقط */
const enterStyle = (delay: number): CSSProperties => ({
  ...ENTER_VARS,
  animationDelay: `${delay}ms`,
});

const FEATURES: { t: string; d: string; icon: LucideIcon; wide?: boolean }[] = [
  {
    t: "إضافة في ثانيتين",
    d: "لوحة أرقام كبيرة + «في أيش انصرف؟» — البقية اختيارية، والإضافة متاحة من أي شاشة",
    icon: Zap,
    wide: true,
  },
  { t: "ميزانية بالفلس", d: "حد أسبوعي ويومي حي — والتجاوز يظهر بالسالب", icon: Target },
  { t: "ادخار تلقائي", d: "فائض الشهر يُكنس للادخار نهاية كل شهر مالي", icon: PiggyBank },
  { t: "15 نظاماً", d: "رتبها بالسحب — كل نظام شاشة كاملة المميزات", icon: LayoutGrid },
];

/** كلمة مفتاحية يلفّها الشريط — تظليل شريطي خافت بدل تلوين النص */
function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="ribbon-soft rounded-md px-1.5 font-bold text-[#101423] box-decoration-clone">
      {children}
    </span>
  );
}

function HeroBranding() {
  return (
    <div className="hidden lg:flex flex-col items-start gap-5 max-w-md text-[#101423]">
      {/* رأس البطل — شعار الشريط + اسم العلامة */}
      <div className="flex items-center gap-5 ribbon-enter" style={enterStyle(0)}>
        <Image
          src="/brand/systemy-logo.png"
          alt="شعار Systemy v5.0 — روبوت Sys بعينين سعيدتين يحمل لوحة بيانات، يلتف حوله شريط متدرج من السماوي إلى الأزرق فالذهبي فالبرتقالي"
          width={96}
          height={96}
          priority
          className="rounded-[1.75rem] shrink-0 shadow-[0_2px_4px_rgba(16,20,35,0.08),0_18px_44px_-16px_rgba(16,20,35,0.28)]"
        />
        <div className="min-w-0">
          <h1 className="text-[2.5rem] font-extrabold tracking-tight leading-none">Systemy</h1>
          <p className="text-[15px] font-semibold text-[#101423]/70 mt-2">«ابنِ حياتك كنظام»</p>
        </div>
      </div>

      {/* لحظة الشريط — خط الهوية ينساب بهدوء تحت رأس البطل */}
      <div
        className="ribbon-shimmer h-[3px] w-full rounded-full ribbon-enter"
        style={enterStyle(40)}
        aria-hidden="true"
      />

      <p className="text-[15px] leading-7 text-[#101423]/80 ribbon-enter" style={enterStyle(80)}>
        نظام تشغيل شخصي يجمع <Mark>المال</Mark> و <Mark>التقويم</Mark> و <Mark>العادات</Mark> و{" "}
        <Mark>الأهداف</Mark> في تدفق واحد مترابط. لا تستهلك أدوات جاهزة — ابنِ أنظمتك، خصّص كل
        شيء، ويتولى Sys تحليلها واقتراح تحسينها.
      </p>

      {/* شبكة المزايا — بطاقة واسعة واحدة تفتح التنويع */}
      <div className="grid grid-cols-2 gap-3 w-full ribbon-enter" style={enterStyle(120)}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.t}
              className={cn("bg-white rounded-2xl p-4", CARD_SHADOW, f.wide && "col-span-2")}
            >
              {f.wide ? (
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl ribbon-soft flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#101423]" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold">{f.t}</div>
                    <div className="text-[12px] text-[#101423]/70 leading-6 mt-0.5">{f.d}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-xl ribbon-soft flex items-center justify-center mb-2.5">
                    <Icon className="w-5 h-5 text-[#101423]" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="text-[13px] font-bold">{f.t}</div>
                  <div className="text-[11.5px] text-[#101423]/70 leading-5 mt-0.5">{f.d}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "bg-white rounded-full px-4 py-2.5 text-[12px] text-[#101423]/70 flex items-center gap-2.5 w-fit ribbon-enter",
          CARD_SHADOW
        )}
        style={enterStyle(160)}
      >
        <span className="w-2 h-2 rounded-full bg-[#6EE7A8] animate-pulse" aria-hidden="true" />
        معاينة تفاعلية حية — جرّب زر الإضافة أو اضغط Ctrl K
      </div>

      {/* بطاقة تحميل التطبيق */}
      <div className="w-full ribbon-enter" style={enterStyle(200)}>
        <DownloadCard />
      </div>
    </div>
  );
}

/** بطاقة تحميل تطبيق أندرويد — إطار شريطي، APK موقّع يعمل دون اتصال */
function DownloadCard() {
  return (
    <section
      aria-label="تحميل التطبيق"
      className="ribbon-frame rounded-2xl p-4 w-full shadow-[0_12px_32px_-16px_rgba(16,20,35,0.2)]"
      /* بطاقة بيضاء بإطار شريطي على العالم الفاتح: طبقة padding-box في .ribbon-frame
         شبه شفافة (مصممة للأسطح الداكنة) — نستبدلها inline بأبيض مصمت فلا يبقى من
         التدرّج إلا حلقة الإطار 1px */
      style={{
        background: "linear-gradient(#FFFFFF, #FFFFFF) padding-box, var(--grad-ribbon) border-box",
      }}
    >
      <div className="flex items-center gap-4">
        <Image
          src="/icons/icon-96.png"
          alt="أيقونة تطبيق Systemy — روبوت Sys يلتف حوله شريط الهوية المتدرج"
          width={64}
          height={64}
          priority
          className="rounded-[18px] shrink-0 shadow-[0_1px_2px_rgba(16,20,35,0.12),0_10px_24px_-12px_rgba(16,20,35,0.35)]"
        />
        <div className="min-w-0">
          <div className="text-[14px] font-bold">تطبيق أندرويد — Systemy v5.0</div>
          <div className="text-[11px] text-[#101423]/70 mt-1 leading-5">
            {APK_SIZE} · أندرويد 7.0+ · موقّع وموثوق · بقاعدة بيانات على جهازك
          </div>
          <div className="text-[10px] text-[#92400E] mt-1.5 leading-5">
            جديد v5.0: هوية الشريط الجديدة — شعار روبوت Sys، حركة أكثر سلاسة، ومظهر مطوّق
            بالكامل
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#101423]/70">
            <span className="flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-[#047857]" aria-hidden="true" /> دون اتصال
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#0E7490]" aria-hidden="true" /> بياناتك على
              جهازك
            </span>
          </div>
        </div>
        <a
          href={APK_URL}
          download={APK_NAME}
          className="press mr-auto shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13px] font-bold text-[#1c1204] hover:bg-[#F7C577] shadow-[0_1px_2px_rgba(16,20,35,0.16),0_10px_22px_-10px_rgba(184,113,26,0.5)]"
          aria-label="تحميل ملف APK لتطبيق Systemy لأندرويد"
        >
          <Download className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
          تحميل APK
        </a>
      </div>
      <p className="text-[10px] text-[#101423]/70 mt-3 leading-5 border-t border-[#101423]/[0.07] pt-2.5">
        بعد التنزيل: افتح الملف واسمح بـ«التثبيت من مصادر غير معروفة» إن طُلب — التطبيق لا يحتاج
        إنترنت ويعمل فوراً.
        <span className="hidden xl:inline">
          {" "}
          آيفون؟ افتح الموقع في Safari ثم «إضافة إلى الشاشة الرئيسية».
        </span>
      </p>
    </section>
  );
}

export default function Page() {
  // وضع standalone (APK/بلا خادم): التطبيق فقط يملأ الشاشة — بلا إطار الهاتف
  // أو الترويج أو التذييل (للتطبيق mesh خاصته). نسخة العرض آمنة للـ hydration:
  // الخادم يرى متغير البناء، والعميل يضيف ?standalone و userAgent.
  const standalone = useSyncExternalStore(subscribeNever, isStandalone, standaloneServerSnapshot);

  if (standalone) {
    return (
      <div className="h-dvh w-full overflow-hidden">
        <SystemyApp />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={PAGE_LIGHT_BG}>
      {/* بقع ضوئية من ألوان الشريط */}
      <div
        className="blob blob-a w-[420px] h-[420px] bg-[#00CDFE]/10 -top-32 -right-24"
        aria-hidden="true"
      />
      <div
        className="blob blob-b w-[380px] h-[380px] bg-[#FEBB18]/[0.12] bottom-0 -left-24"
        aria-hidden="true"
      />

      <main className="flex-1 flex items-center justify-center gap-20 py-0 px-0 sm:py-8 sm:px-4">
        <HeroBranding />
        <PhoneFrame>
          <SystemyApp />
        </PhoneFrame>
      </main>

      <footer className="mt-auto shrink-0 py-[2px] lg:py-3.5 border-t border-[#101423]/[0.08] text-center text-[11px] text-[#101423]/70">
        <a
          href={APK_URL}
          download={APK_NAME}
          className="press lg:hidden inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-full bg-primary text-[#1c1204] text-[13px] font-bold shadow-[0_1px_2px_rgba(16,20,35,0.14),0_8px_18px_-8px_rgba(184,113,26,0.45)]"
          aria-label="تحميل تطبيق Systemy لأندرويد"
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          تحميل تطبيق Systemy — APK · {APK_SIZE} · أندرويد 7+
        </a>
        <span className="hidden lg:inline">
          {APK_VERSION} — نظام تشغيلك الشخصي بهوية «الشريط» الجديدة · 15 نظاماً مرتبة بالسحب ·
          ميزانية بالفلس: حد أسبوعي ويومي حي وادخار تلقائي · إضافة سريعة بلوحة أرقام · بياناتك على
          جهازك دائماً ·{" "}
          <a
            href={APK_URL}
            download={APK_NAME}
            className="text-[#92400E] font-bold hover:underline underline-offset-4"
          >
            تحميل APK
          </a>
        </span>
      </footer>
    </div>
  );
}
