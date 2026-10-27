"use client";

/**
 * Systemy — جسر OAuth للتطبيق المثبّت (APK)
 * ------------------------------------------------------------
 * مشكلة v5.2: رحلة Google كانت تفتح المتصفح الخارجي ثم تعود إلى
 * window.location.origin (file:// داخل WebView) — فتسقط في Supabase
 * إلى Site URL الافتراضي (http://localhost:3000) على الجهاز → فشل الاتصال.
 *
 * الحل (نمط Supabase الرسمي لتطبيقات الجوال):
 * 1) زر Google داخل التطبيق يطلب رابط الترخيص بـ redirectTo = systemy://auth/callback
 *    مع skipBrowserRedirect — ثم يسلّمه للجسر الأصلي SystemyNative.openExternal()
 *    ليفتح متصفح النظام (موافقة Google تتم هناك).
 * 2) بعد الموافقة، Supabase يعيد التوجيه إلى systemy://auth/callback?code=…
 *    وأندرويد يوجّه الرابط للتطبيق (intent-filter في Manifest).
 * 3) MainActivity يستلم الرابط (بارداً أو حياً) ويغرزه في WebView عبر
 *    window.__systemyOAuthCallback(url) — وهو المعالج هنا.
 * 4) المعالج يستهلك الكود عبر exchangeCodeForSession (PKCE — المُحقِن
 *    محفوظ في localStorage نفسها منذ الخطوة 1) → جلسة Supabase فعلية
 *    → onAuthStateChange(SIGNED_IN) → البوابة تُفتح تلقائياً.
 *
 * ملاحظة أمان: code_verifier لا يغادر الجهاز أبداً، والكود نفسه عديم
 * الفائدة بدونه. لا توكن يُمرَّر عبر الرابط.
 */
import { create } from "zustand";
import { supabase, authErrorToArabic } from "@/lib/supabase";

/** عنوان عودة OAuth للتطبيق — يجب إضافته في لوحة Supabase (Auth → URL Configuration → Redirect URLs) */
export const SYSTEMY_OAUTH_REDIRECT = "systemy://auth/callback";

/** واجهة الجسر الأصلي الذي يعرضه MainActivity كـ window.SystemyNative */
interface SystemyNative {
  /** فتح رابط في متصفح النظام (موافقة Google تتم خارج WebView) */
  openExternal(url: string): void;
  /** سحب رابط العودة المعلّق (وصول بارد: الرابط وصل قبل اكتمال تحميل الصفحة) */
  takePendingOAuth(): string;
}

declare global {
  interface Window {
    SystemyNative?: SystemyNative;
    __systemyOAuthCallback?: (url: string) => Promise<{ ok: boolean; error?: string }>;
    __systemyOAuthCallbackInstalled?: boolean;
  }
}

export type OAuthPhase = "idle" | "pending" | "ok" | "error";

interface OAuthBridgeState {
  phase: OAuthPhase;
  message: string;
  setPhase: (phase: OAuthPhase, message?: string) => void;
}

/** حالة العودة من Google — تُعرض في شاشة الدخول (انتظار/نجاح/خطأ) */
export const useOAuthBridge = create<OAuthBridgeState>((set) => ({
  phase: "idle",
  message: "",
  setPhase: (phase, message = "") => set({ phase, message }),
}));

/** هل جسر Android الأصلي متوفر داخل WebView؟ (يُقرأ على العميل فقط) */
export function hasNativeBridge(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.SystemyNative?.openExternal === "function";
}

/** فتح رابط الترخيص في متصفح النظام عبر الجسر الأصلي — هل نجح؟ */
export function openExternalAuthUrl(url: string): boolean {
  if (!hasNativeBridge()) return false;
  try {
    window.SystemyNative?.openExternal(url);
    return true;
  } catch {
    return false;
  }
}

/** الروابط التي عولجت — مفتاح Android يسلّم الرابط مرتين أحياناً (بارداً + دفعاً) */
const handledUrls = new Set<string>();
/** محاولة جارية — يمنع سباق الدفع/السحب على الكود نفسه */
let inFlight: Promise<{ ok: boolean; error?: string }> | null = null;

/** ترجمة خاصة بأخطاء تبادل الكود (غير موجودة في authErrorToArabic العام) */
function exchangeErrorToArabic(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("code verifier") || msg.includes("non-empty"))
    return "انتهت صلاحية محاولة الدخول — اضغط زر Google مرة أخرى وأكمل الدخول من جديد";
  return authErrorToArabic(err);
}

/** معالجة رابط العودة systemy://auth/callback?code=… (أو tokens في الـ hash كاحتياط) */
async function runCallback(rawUrl: string): Promise<{ ok: boolean; error?: string }> {
  const { setPhase } = useOAuthBridge.getState();
  if (!supabase) {
    setPhase("error", "الدخول السحابي غير مهيّأ في هذا البناء");
    return { ok: false, error: "الدخول السحابي غير مهيّأ في هذا البناء" };
  }
  setPhase("pending", "نُكمل تسجيل Google…");
  try {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("رابط العودة من Google غير صالح");
    }

    const q = parsed.searchParams;
    const fragParams = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const frag = new URLSearchParams(fragParams || "");

    // عودة بخطأ من المزوّد (رفض صلاحيات / إلغاء)؟ اعرضه بصدق
    const errCode = q.get("error") || frag.get("error");
    const errDesc = q.get("error_description") || frag.get("error_description");
    if (errCode) throw new Error(errDesc || errCode);

    const code = q.get("code");
    const accessToken = frag.get("access_token");
    const refreshToken = frag.get("refresh_token");

    if (code) {
      // المسار الأساسي: PKCE — تبادل الكود بمُحقِن محفوظ محلياً منذ بدء الرحلة
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      // احتياط: tokens في الـ hash (تدفق implicit)
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else {
      throw new Error("رابط العودة لا يحمل بيانات دخول — ابدأ تسجيل Google من جديد");
    }

    setPhase("ok", "أكملنا تسجيل Google بنجاح");
    // لا نغلق البوابة يدوياً — onAuthStateChange(SIGNED_IN) يتكفل بذلك
    return { ok: true };
  } catch (err) {
    const msg = exchangeErrorToArabic(err);
    setPhase("error", msg);
    return { ok: false, error: msg };
  }
}

/**
 * تركيب الجسر — يُستدعى مرة واحدة من auth-store.init() عند كل تحميل.
 * يعمل فقط داخل التطبيق المثبّت (يتطلب SystemyNative من MainActivity).
 */
export function installOAuthBridge(): void {
  if (typeof window === "undefined") return;
  const w = window;
  if (w.__systemyOAuthCallbackInstalled) return;
  w.__systemyOAuthCallbackInstalled = true;

  w.__systemyOAuthCallback = async (rawUrl: string): Promise<{ ok: boolean; error?: string }> => {
    if (!rawUrl) return { ok: false, error: "رابط عودة فارغ" };
    // مفتاح الأصلي قد يدفع الرابط مرتين (بارداً ثم دفعاً) — نفس الكود يُعالج مرة واحدة
    if (handledUrls.has(rawUrl)) return { ok: true };
    handledUrls.add(rawUrl);
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        /* المحاولة السابقة انتهت بخطأ — نكمل بالحالية */
      }
    }
    const run = runCallback(rawUrl);
    inFlight = run;
    try {
      return await run;
    } finally {
      inFlight = null;
    }
  };

  // وصول بارد: الرابط وصل والتطبيق كان مغلقاً — MainActivity احتفظ به حتى نسأل عنه
  try {
    const pending = w.SystemyNative?.takePendingOAuth?.();
    if (typeof pending === "string" && pending) void w.__systemyOAuthCallback(pending);
  } catch {
    /* لا جسر أصلي — نسخة الويب */
  }
}
