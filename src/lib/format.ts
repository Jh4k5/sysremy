/**
 * Systemy v2 — تنسيقات موحدة (عملة، تواريخ ISO، أرقام، تقويم)
 * كل الشاشات تستهلك من هنا — تغيير العملة في الإعدادات ينعكس فوراً.
 */

// ═══════════════════════ الأرقام والعملة ═══════════════════════

const NUM_LT = "ar-SA-u-nu-latn";

/** عملة العرض الحالية — تُضبط من الإعدادات عند الإقلاع */
let activeCurrency = "ر.س";

export function setCurrency(c: string): void {
  activeCurrency = c || "ر.س";
}

export function getCurrency(): string {
  return activeCurrency;
}

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat(NUM_LT, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatMoney(n: number, currency = activeCurrency, decimals = 0): string {
  const formatted = formatNumber(Math.abs(n), decimals);
  const sign = n < 0 ? "−" : "";
  const cur = currency === "SAR" ? "ر.س" : currency;
  return `${sign}${formatted} ${cur}`;
}

/** رقم مضغوط للمساحات الصغيرة: 1.2k */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return `${formatNumber(v, v % 1 === 0 ? 0 : 1)}k`;
  }
  return formatNumber(n);
}

export function maskMoney(): string {
  return "••••";
}

// ═══════════════════════ تواريخ ISO ═══════════════════════

export type ISODate = string; // 'YYYY-MM-DD'

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** قراءة ISO إلى تاريخ محلي (ظهراً لتفادي انزياح التوقيت) */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** الفرق بالأيام (date − base) */
export function diffDays(base: ISODate, date: ISODate): number {
  const b = fromISODate(base).getTime();
  const t = fromISODate(date).getTime();
  return Math.round((t - b) / 86400000);
}

// ═══════════════════════ الأسبوع والشهر المالي ═══════════════════════

export type WeekStart = "sat" | "sun" | "mon";

const WEEK_OFFSET: Record<WeekStart, (day: number) => number> = {
  sat: (day) => (day + 1) % 7, // السبت بداية
  sun: (day) => day, // الأحد بداية
  mon: (day) => (day + 6) % 7, // الاثنين بداية
};

/** بداية الأسبوع حسب إعداد المستخدم */
export function startOfWeekISO(iso: ISODate, weekStart: WeekStart = "sat"): ISODate {
  const d = fromISODate(iso);
  const offset = WEEK_OFFSET[weekStart](d.getDay());
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

export function endOfWeekISO(iso: ISODate, weekStart: WeekStart = "sat"): ISODate {
  return addDaysISO(startOfWeekISO(iso, weekStart), 6);
}

/** أيام الأسبوع السبعة من البداية حسب الإعداد */
export function weekDays(iso: ISODate, weekStart: WeekStart = "sat"): ISODate[] {
  const start = startOfWeekISO(iso, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

/** بداية الشهر المالي حسب dayStart */
export function financeMonthStart(iso: ISODate, dayStart = 1): ISODate {
  const d = fromISODate(iso);
  if (d.getDate() >= dayStart) return toISODate(new Date(d.getFullYear(), d.getMonth(), dayStart));
  return toISODate(new Date(d.getFullYear(), d.getMonth() - 1, dayStart));
}

/** نهاية الشهر المالي الحالي */
export function financeMonthEnd(iso: ISODate, dayStart = 1): ISODate {
  const d = fromISODate(iso);
  const end = d.getDate() >= dayStart
    ? new Date(d.getFullYear(), d.getMonth() + 1, dayStart)
    : new Date(d.getFullYear(), d.getMonth(), dayStart);
  end.setDate(end.getDate() - 1);
  return toISODate(end);
}

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function dayName(d: Date | string): string {
  const date = typeof d === "string" ? fromISODate(d.slice(0, 10)) : d;
  return AR_DAYS[date.getDay()];
}

export function dayNameShort(iso: ISODate): string {
  const map: Record<string, string> = {
    "الأحد": "أحد", "الاثنين": "إثنين", "الثلاثاء": "ثلاثاء", "الأربعاء": "أربعاء",
    "الخميس": "خميس", "الجمعة": "جمعة", "السبت": "سبت",
  };
  return map[dayName(iso)] ?? dayName(iso);
}

export function formatDate(d: Date | string, withYear = false): string {
  const date = typeof d === "string" ? fromISODate(d.slice(0, 10)) : d;
  const base = `${date.getDate()} ${AR_MONTHS[date.getMonth()]}`;
  return withYear ? `${base} ${date.getFullYear()}` : base;
}

export function formatFullDate(d: Date | string): string {
  return `${dayName(d)} ${formatDate(d)}`;
}

/** عنوان الشهر المالي */
export function financeMonthLabel(iso: ISODate, dayStart = 1): string {
  const start = fromISODate(financeMonthStart(iso, dayStart));
  return `${AR_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
}

/** التاريخ النسبي: اليوم / غداً / أمس / بعد 3 أيام / متأخر بيومين */
export function relativeDay(iso: ISODate, base: ISODate = todayISO()): string {
  const n = diffDays(base, iso);
  if (n === 0) return "اليوم";
  if (n === 1) return "غداً";
  if (n === -1) return "أمس";
  if (n > 1 && n <= 7) return `بعد ${formatNumber(n)} أيام`;
  if (n < -1 && n >= -7) return `متأخر ${formatNumber(Math.abs(n))} أيام`;
  if (n > 7) return formatDate(iso);
  return `متأخر — ${formatDate(iso)}`;
}

// ═══════════════════════ الوقت ═══════════════════════

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d.length <= 16 ? d + ":00" : d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const h = date.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h12}:${m} ${h < 12 ? "ص" : "م"}`;
}

/** تنسيق وقت "2:30 م" من "HH:mm" */
export function formatTimeAr(hhmm: string): string {
  return formatTime(`2000-01-01T${hhmm}`);
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** تنسيق مدة: "ساعتان و15 د" / "45 د" */
export function formatDurationAr(minutes: number): string {
  if (minutes < 1) return "أقل من دقيقة";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${formatNumber(m)} دقيقة`;
  if (m === 0) {
    if (h === 1) return "ساعة";
    if (h === 2) return "ساعتان";
    return `${formatNumber(h)} ساعات`;
  }
  const hText = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${formatNumber(h)} ساعات`;
  return `${hText} و${formatNumber(m)} دقيقة`;
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${formatNumber(mins)} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${formatNumber(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${formatNumber(days)} يوم`;
  return formatDate(date);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ═══════════════════════ الهجري والتحية والمزاج ═══════════════════════

/** التقويم الهجري (أم القرى) */
export function hijriDate(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
      day: "numeric",
      month: "long",
    }).format(d);
  } catch {
    return "";
  }
}

/** تحية ذكية حسب الوقت */
export function smartGreeting(name = ""): { text: string; sub: string } {
  const h = new Date().getHours();
  let text = "مساء الخير";
  if (h < 5) text = "ليلة هادئة";
  else if (h < 12) text = "صباح الخير";
  else if (h < 17) text = "نهارك سعيد";
  const hijri = hijriDate();
  return {
    text: name ? `${text}، ${name}` : text,
    sub: hijri
      ? `${dayName(new Date())} · ${formatDate(new Date())} · ${hijri}`
      : `${dayName(new Date())} · ${formatDate(new Date())}`,
  };
}

export const MOOD_FACES = ["😖", "🙁", "😐", "🙂", "😄"];
export const MOOD_LABELS = ["صعب", "منخفض", "عادي", "جيد", "ممتاز"];
