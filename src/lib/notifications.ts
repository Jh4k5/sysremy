/**
 * Systemy v2 — إشعارات المتصفح + جدولة التذكيرات
 * غلاف آمن: يتحقق من الدعم والصلاحية ويصمت بأدب عند الرفض.
 */

/** هل المتصفح/الـ WebView يدعم الإشعارات؟ */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** حالة الصلاحية الحالية */
export function notificationPermission(): "unsupported" | "default" | "granted" | "denied" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** طلب صلاحية الإشعارات — يعيد الحالة النهائية */
export async function requestNotificationPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** عرض إشعار (إن سُمح) — صامت تماماً عند الفشل */
export function showAppNotification(
  title: string,
  options?: { body?: string; tag?: string },
): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(title, {
      body: options?.body,
      tag: options?.tag, // يستبدل السابقة بنفس الوسم
      icon: "/icons/icon-192.png",
      lang: "ar",
      dir: "rtl",
    });
    setTimeout(() => n.close(), 12_000);
    return true;
  } catch {
    return false;
  }
}

/** تتبع ما أُشعِر عنه اليوم (يمنع التكرار كل دقيقة) */
const NOTIFIED_KEY = "systemy-notified-v1";

export function getNotifiedToday(now: string): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
    if (parsed.date === now && Array.isArray(parsed.ids)) return new Set(parsed.ids);
  } catch {
    /* تخزين تالف */
  }
  return new Set();
}

export function markNotified(now: string, id: string): void {
  try {
    const current = getNotifiedToday(now);
    current.add(id);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ date: now, ids: Array.from(current) }));
  } catch {
    /* تجاهل */
  }
}

/** هل حان وقت تذكير HH:mm الآن؟ (خلال نافذة الدقيقة) */
export function isReminderTime(remindAt: string, nowHHMM: string): boolean {
  return remindAt === nowHHMM;
}
