/**
 * Systemy — كشف وضع standalone
 * الوضع المحلي الكامل (APK أندرويد / WebView بلا خادم) يُفعَّل بأحد ثلاثة:
 * 1) NEXT_PUBLIC_STANDALONE=1 وقت البناء (يُدمج في الحزمة)
 * 2) وجود ?standalone في رابط الصفحة
 * 3) userAgent يحتوي "SystemyWebView" (متصفح التطبيق الأصلي)
 */

/** نسخة البناء — ثابتة تُدمج وقت البناء */
const BUILD_STANDALONE: boolean = process.env.NEXT_PUBLIC_STANDALONE === "1";

/** هل نعمل في وضع standalone؟ (تُقرأ على العميل فقط) */
export function isStandalone(): boolean {
  if (BUILD_STANDALONE) return true;
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("standalone")) return true;
  } catch {
    /* بحث غير صالح — نكمل */
  }
  return window.navigator.userAgent.includes("SystemyWebView");
}

/** لقطة الخادم أثناء الـ SSR — البيئة فقط (لا يوجد location على الخادم) */
export function standaloneServerSnapshot(): boolean {
  return BUILD_STANDALONE;
}

/** اشتراك فارغ لـ useSyncExternalStore — القيمة لا تتغير أثناء الجلسة */
export const subscribeNever = (): (() => void) => () => {};
