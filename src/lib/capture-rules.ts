/**
 * Systemy v2 — محرك الالتقاط الذكي (قواعد عربية بلا LLM)
 * يفهم: المبالغ (عربية/فارسية/مفصولة)، التواريخ النسبية، الوسوم #،
 * الأشخاص (من/لـ/إلى)، نوع الإدخال (مصروف/دخل/مهمة/مزاج/ملاحظة)،
 * والفئة عبر الكلمات المفتاحية. يعمل محلياً 100% — نفسه في الويب والـAPK.
 *
 * (تكامل Life-os): دُمجت قواعد التاريخ من Life-os `services/dateResolve.ts`
 * بأسلوب capture-rules الإضافي — جدول أيام اللهجات (الاتنين/تلاتا/خميس…)،
 * علامات القادم (الجاي/القادم/اللي بييجي) لليوم، «باجر بعد» المعكوس،
 * الأسبوع/الشهر القادم، و بعد/قبل N أسابيع/شهور. كل قاعدة قديمة نتيجتها
 * كما كانت حرفياً — الإضافات توسّع التغطية فقط.
 */
import type { Category } from "./types";
import type { ISODate } from "./format";
import { todayISO } from "./format";

export interface CaptureParsed {
  kind: "expense" | "income" | "note" | "task" | "mood";
  amount: number | null;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  date: ISODate;
  time: string | null;
  tags: string[];
  person: string | null;
  confidence: "high" | "medium" | "low";
  engine: "rules";
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const DAY_WORDS: Record<string, number> = {
  // الأشكال الفصحى بـ«ال» أولاً (أولوية المطابقة — كما كانت)
  الأحد: 0, الاحد: 0, الإثنين: 1, الاثنين: 1, الثلاثاء: 2, الأربعاء: 3, الاربعاء: 3,
  الخميس: 4, الجمعة: 5, السبت: 6,
  // جدول لهجات Life-os (dateResolve.ts:14-22): خليجي/مصري/شامي
  الاتنين: 1, اثنين: 1, الثلاثا: 2, ثلاثاء: 2, تلاتا: 2,
  اربعاء: 3, أربعاء: 3, احد: 0, خميس: 4, جمعة: 5, سبت: 6,
};

const WORD_UNITS: Record<string, number> = {
  اسبوعين: 14, أسبوعين: 14, شهرين: 60, يومين: 2, يومان: 2,
  اسبوع: 7, أسبوع: 7, شهر: 30, يوم: 1,
};

/** وحدات العدد الرقمي — أيام/أسابيع/شهور (بعد/قبل N …) */
const NUM_UNITS = "أيام|ايام|يوم|أسابيع|اسابيع|أسبوع|اسبوع|شهور|شهر";
const WEEK_UNIT_RE = /^(?:أسابيع|اسابيع|أسبوع|اسبوع)$/;
const MONTH_UNIT_RE = /^(?:شهور|شهر)$/;

/** يحول «٣ أسابيع»/«٢ شهر» إلى أيام (الشهر ≈ ٣٠ يوماً كعلامة WORD_UNITS القائمة) */
function unitDays(unit: string, n: number): number {
  if (WEEK_UNIT_RE.test(unit)) return n * 7;
  if (MONTH_UNIT_RE.test(unit)) return n * 30;
  return n;
}

/** سقف النتيجة بالأيام — الأيام ٣٦٥ (كما كانت)، الأسابيع/الشهور أوسع */
const unitCap = (unit: string) => (WEEK_UNIT_RE.test(unit) || MONTH_UNIT_RE.test(unit) ? 3650 : 365);

function addDaysISO(base: ISODate, days: number): ISODate {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastPastWeekday(target: number): ISODate {
  const now = new Date();
  const diff = (now.getDay() - target + 7) % 7;
  return addDaysISO(todayISO(), -diff);
}

/** القادم من يوم الأسبوع — «السبت الجاي» (اليوم نفسه يتجاوز للأسبوع القادم) */
function nextWeekday(target: number): ISODate {
  const now = new Date();
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysISO(todayISO(), diff);
}

/** الشهر القادم بنفس يوم الشهر — مع تثبيت نهاية الشهر (٣١ ← ٢٨/٣٠) */
function addMonthsISO(base: ISODate, months: number): ISODate {
  const d = new Date(base + "T12:00:00");
  const day = d.getDate();
  d.setDate(1); // منع التدحرج التلقائي للشهور القصيرة
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** علامات «القادم» اللهجية الملتصقة بيوم الأسبوع — من جدول Life-os */
const NEXT_MARKER_RE =
  /(?<![\u0621-\u064A])(?:القادمة|القادم|اللي\s+بييجي|اللي\s+جاي|الجايلة|الجاية|الجايل|الجاي)(?![\u0621-\u064A])/;

/** «الأسبوع/الشهر القادم» — علامات القادم نفسها */
const NEXT_WORD = "القادمة|القادم|الجايلة|الجاية|الجايل|الجاي";

interface DateExtract {
  text: string;
  date: ISODate;
  matched: boolean;
}

function extractRelativeDate(text: string): DateExtract {
  const now = todayISO();
  let date = now;
  let matched = false;
  let out = text;

  // قبل/منذ N أيام/أسابيع/شهور — تُحذف أولاً كي لا يُقرأ رقمها مبلغاً
  const relNum = out.match(new RegExp(`(?:قبل|منذ)\\s*(\\d+)\\s*(${NUM_UNITS})`));
  if (relNum) {
    out = out.replace(new RegExp(`(?:قبل|منذ)\\s*\\d+\\s*(?:${NUM_UNITS})`), " ");
    const n = parseInt(relNum[1], 10);
    date = addDaysISO(now, -Math.min(unitCap(relNum[2]), unitDays(relNum[2], n)));
    matched = true;
  } else {
    for (const [word, days] of Object.entries(WORD_UNITS)) {
      const re = new RegExp(`(?:قبل|منذ)\\s*${word}(?![\\u0621-\\u064A])`);
      if (re.test(out)) {
        out = out.replace(re, " ");
        date = addDaysISO(now, -days);
        matched = true;
        break;
      }
    }
  }

  // بعد N أيام/أسابيع/شهور
  const aftNum = out.match(new RegExp(`بعد\\s*(\\d+)\\s*(${NUM_UNITS})`));
  if (aftNum) {
    out = out.replace(new RegExp(`بعد\\s*\\d+\\s*(?:${NUM_UNITS})`), " ");
    const n = parseInt(aftNum[1], 10);
    date = addDaysISO(now, Math.min(unitCap(aftNum[2]), unitDays(aftNum[2], n)));
    matched = true;
  } else {
    for (const [word, days] of Object.entries(WORD_UNITS)) {
      const re = new RegExp(`بعد\\s*${word}(?![\\u0621-\\u064A])`);
      if (re.test(out)) {
        out = out.replace(re, " ");
        date = addDaysISO(now, days);
        matched = true;
        break;
      }
    }
  }

  if (out.match(/بعد\s*غد(?![\u0621-\u064A])|بعد\s*بكرة|بعد\s*باجر/)) {
    out = out.replace(/بعد\s*غد(?![\u0621-\u064A])|بعد\s*بكرة|بعد\s*باجر/, " ");
    date = addDaysISO(now, 2);
    matched = true;
  }
  // «باجر بعد» / «بكرة بعد» — بعد غد بترتيب معكوس (لهجات الخليج)
  if (out.match(/(?<![\u0621-\u064A])(?:بكرة|بكره|باجر|غداً|غدا|غد)\s+بعد(?![\u0621-\u064A])/)) {
    out = out.replace(/(?<![\u0621-\u064A])(?:بكرة|بكره|باجر|غداً|غدا|غد)\s+بعد(?![\u0621-\u064A])/, " ");
    date = addDaysISO(now, 2);
    matched = true;
  }
  if (out.match(/(?<![\u0621-\u064A])(?:البارحة|البارحه|البارح|الأمس|الامس|أمس|امس)(?![\u0621-\u064A])/)) {
    out = out.replace(/(?<![\u0621-\u064A])(?:البارحة|البارحه|البارح|الأمس|الامس|أمس|امس)(?![\u0621-\u064A])/, " ");
    date = addDaysISO(now, -1);
    matched = true;
  }
  if (out.match(/(?<![\u0621-\u064A])(?:غداً|غدا|غد|بكرة|بكره|باجر)(?![\u0621-\u064A])/)) {
    out = out.replace(/(?<![\u0621-\u064A])(?:غداً|غدا|غد|بكرة|بكره|باجر)(?![\u0621-\u064A])/, " ");
    date = addDaysISO(now, 1);
    matched = true;
  }

  // «الأسبوع القادم/الجاي/الجايل» — الأسبوع القادم بنفس يوم الأسبوع
  if (out.match(new RegExp(`(?:الأسبوع|الاسبوع)\\s*(?:${NEXT_WORD})(?![\\u0621-\\u064A])`))) {
    out = out.replace(new RegExp(`(?:الأسبوع|الاسبوع)\\s*(?:${NEXT_WORD})(?![\\u0621-\\u064A])`), " ");
    date = addDaysISO(now, 7);
    matched = true;
  }
  // «الشهر القادم/الجاي» — الشهر القادم بنفس يوم الشهر ("بعد شهر" يبقى ٣٠ يوماً كما كان)
  if (out.match(new RegExp(`(?<![\\u0621-\\u064A])(?:الشهر|شهر)\\s*(?:${NEXT_WORD})(?![\\u0621-\\u064A])`))) {
    out = out.replace(new RegExp(`(?<![\\u0621-\\u064A])(?:الشهر|شهر)\\s*(?:${NEXT_WORD})(?![\\u0621-\\u064A])`), " ");
    date = addMonthsISO(now, 1);
    matched = true;
  }

  // أسماء الأيام (فصحى + لهجات Life-os) → آخر ماضٍ من ذلك اليوم،
  // ومع «الجاي/القادم/اللي بييجي» → القادم حتماً (اليوم نفسه يتخطى أسبوعاً)
  for (const [word, wd] of Object.entries(DAY_WORDS)) {
    const bare = !word.startsWith("ال"); // الأشكال القصيرة تحتاج حماية من كلمات أطول (كـ«كسبت»)
    const re = new RegExp(`${bare ? "(?<![\\u0621-\\u064A])" : ""}${word}(?![\\u0621-\\u064A])`);
    if (re.test(out)) {
      out = out.replace(re, " ");
      if (NEXT_MARKER_RE.test(out)) {
        out = out.replace(NEXT_MARKER_RE, " ");
        date = nextWeekday(wd);
      } else {
        date = lastPastWeekday(wd);
      }
      matched = true;
      break;
    }
  }

  return { text: collapseSpaces(out), date, matched };
}

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?)|(\d+(?:\.\d+)?)/;

function extractAmount(text: string): { text: string; amount: number | null } {
  const m = text.match(AMOUNT_RE);
  if (!m) return { text, amount: null };
  const raw = m[1] ?? m[2] ?? "";
  const value = parseFloat(raw.replace(/,/g, ""));
  if (!isFinite(value) || value <= 0) return { text, amount: null };
  return { text: text.replace(raw, " "), amount: Math.round(value * 100) / 100 };
}

/** الوقت: 3م / 15:30 / ٩ صباحاً → HH:mm */
function extractTime(text: string): { text: string; time: string | null } {
  let out = text;
  let time: string | null = null;
  const m = out.match(/\b(\d{1,2}):(\d{2})\s*(ص|صباحا|م|مساء)?/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    if (m[3] === "م" || m[3] === "مساء") {
      if (h < 12) h += 12;
    } else if ((m[3] === "ص" || m[3] === "صباحا") && h === 12) {
      h = 0;
    }
    time = `${String(h).padStart(2, "0")}:${min}`;
    out = out.replace(m[0], " ");
  } else {
    const m2 = out.match(/\b(\d{1,2})\s*(ص|صباحا|م|مساء)(?![\u0621-\u064A])/);
    if (m2) {
      let h = parseInt(m2[1], 10);
      if (m2[2] === "م" || m2[2] === "مساء") {
        if (h < 12) h += 12;
      } else if (h === 12) {
        h = 0;
      }
      time = `${String(h).padStart(2, "0")}:00`;
      out = out.replace(m2[0], " ");
    }
  }
  return { text: collapseSpaces(out), time };
}

const TASK_RE = /(?<![\u0621-\u064A])(?:ذكّرني|ذكرني|تذكير|مهم[ةه]|مهام|لاحقاً|لاحقا|فوتر|todo)(?![\u0621-\u064A])/i;
const MOOD_RE = /(مزاج|شعور|إحساس|احساس|حاس[ةه]ي|حاسّ?ة)/;
const INCOME_RE = /(استلمت|استلم|قبضت|قبض|دخل|راتب|مرتب|بيعت|بعت|بيع|حول\s*لي|حوللي|تحويل\s*وارد|ربح|أرباح|مكاف[اا]ء|مكافاة)/;
const BLOCK_RE = /(?<![\u0621-\u064A])(?:موعد|اجتماع|حجز|جلسة|محاضرة|مقابلة)(?![\u0621-\u064A])/;

type Kind = CaptureParsed["kind"];

function detectKind(text: string, hasAmount: boolean): { kind: Kind; explicit: boolean } {
  if (TASK_RE.test(text)) return { kind: "task", explicit: true };
  if (MOOD_RE.test(text)) return { kind: "mood", explicit: true };
  if (INCOME_RE.test(text)) return { kind: "income", explicit: true };
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!hasAmount && (words >= 6 || text.length >= 35)) return { kind: "note", explicit: true };
  return { kind: "expense", explicit: false };
}

const PERSON_RE = /(?:^|\s)(من|لـ|الى|إلى)\s+([\u0621-\u064A]{2,})/;
const PERSON_STOP = new Set([
  "اليوم", "الان", "الآن", "امس", "أمس", "البارحة", "غدا", "غداً", "بكرة", "باجر",
  "المصروف", "الميزانية", "الحساب", "البنك", "الراتب", "الفاتورة", "اشتراك",
]);

function extractPerson(text: string): string | null {
  const m = text.match(PERSON_RE);
  if (!m) return null;
  const word = m[2];
  if (PERSON_STOP.has(word) || word in DAY_WORDS) return null;
  return word;
}

function extractTags(text: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const out = text.replace(/#([^\s#،,]+)/g, (_all, tag: string) => {
    if (tag.trim()) tags.push(tag.trim());
    return " ";
  });
  return { text: collapseSpaces(out), tags };
}

function matchCategory(text: string, kind: Kind, cats: Category[]): { id: string; name: string } | null {
  const wanted = kind === "income" ? "income" : "expense";
  const ordered = [
    ...cats.filter((c) => c.kind === wanted && !c.archived),
    ...cats.filter((c) => c.kind !== wanted && !c.archived),
  ];
  const haystack = normalizeDigits(text).toLowerCase();
  for (const c of ordered) {
    const candidates = [
      // دفاعي: صف قديم/مستورد قد يفتقد keywords — لا يُسقط التطبيق كله
      ...(c.keywords ?? "").split(",").map((k) => k.trim()).filter((k) => k.length >= 2),
      c.name,
    ];
    for (const kw of candidates) {
      if (kw.length >= 2 && haystack.includes(kw.toLowerCase())) {
        return { id: c.id, name: c.name };
      }
    }
  }
  return null;
}

const CURRENCY_RE = /(?<![\u0621-\u064A])(?:ريالات|ريال|دراهم|درهم|ر\.س|﷼)(?![\u0621-\u064A])|(?<![A-Za-z])SAR(?![A-Za-z])/gi;

function cleanDescription(text: string, kind: Kind): string {
  let out = collapseSpaces(text.replace(CURRENCY_RE, " "))
    .replace(/\s*[،,؛.:]\s*$/g, "")
    .replace(/^[،,؛.:]\s*/g, "")
    .trim();
  if (kind === "task") {
    out = out.replace(/^(?:ذكّرني|ذكرني|تذكير|مهمة)\s*/i, "");
  }
  return out.trim();
}

const MOOD_SCORES: { words: string[]; score: number }[] = [
  { words: ["سيء", "سيئة", "صعب", "صعبة", "فظيع", "مكتئب", "حزين", "خايف", "مرهق جدا", "متضايق جدا", "مزعج"], score: 1 },
  { words: ["تعبان", "متعب", "مرهق", "زهقان", "مضايق", "متضايق"], score: 2 },
  { words: ["ممتاز", "رائع", "رائعة", "مبسوط", "مبسوطة", "سعيد", "سعيدة", "فرحان", "فرحانة", "متحمس", "متحمسة", "رايق", "رايقة", "منتشي"], score: 5 },
  { words: ["جيد", "جيدة", "حلو", "حلوة", "زين", "زينة", "مرتاح", "مرتاحة", "بخير", "كويس", "كويسة", "طيب", "طيبة"], score: 4 },
  { words: ["عادي", "عادية", "وسط", "تمام", "متوسط", "لا بأس", "لابأس", "مقبول"], score: 3 },
];

export function moodScoreFromText(text: string): number {
  const t = normalizeDigits(text);
  for (const { words, score } of MOOD_SCORES) {
    for (const w of words) {
      if (t.includes(w)) return score;
    }
  }
  return 3;
}

/** التحليل بالقواعد فقط — سريع ومحلي بالكامل */
export function parseCapture(rawText: string, categories: Category[], forceKind?: Kind): CaptureParsed {
  const original = normalizeDigits(rawText.trim());

  const tagged = extractTags(original);
  const dated = extractRelativeDate(tagged.text);
  const timed = extractTime(dated.text);
  const amounted = extractAmount(timed.text);
  let { kind, explicit } = detectKind(timed.text, amounted.amount !== null);
  if (BLOCK_RE.test(timed.text) && timed.time) kind = "note"; // موعد بوقت → يُعرض كاقتراح حدث تقويم
  const person = extractPerson(amounted.text);
  const category = matchCategory(original, kind, categories);

  let description = cleanDescription(amounted.text, kind);
  if (!description) description = original.slice(0, 120) || "إدخال";

  let confidence: CaptureParsed["confidence"];
  if (amounted.amount !== null || kind === "task" || kind === "mood" || kind === "note") {
    confidence = "high";
  } else if (explicit) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  let finalKind = kind;
  const VALID: Kind[] = ["expense", "income", "note", "task", "mood"];
  if (forceKind && VALID.includes(forceKind)) finalKind = forceKind;

  return {
    kind: finalKind,
    amount: amounted.amount,
    description,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    date: dated.date,
    time: timed.time,
    tags: tagged.tags,
    person,
    confidence,
    engine: "rules",
  };
}
