/**
 * migrate-lifeos.ts — أداة ترحيل بيانات Life-os إلى Systemy
 * ═══════════════════════════════════════════════════════════════
 * الجزء الأول من سلسلة تكامل Life-os (الخيار A — انظر docs/integration/architecture-decision.md).
 *
 * يحوّل ملف تصدير Life-os (db.exportAll من AsyncStorage — تنسيق
 * { data: { <name>: rows[] } }) إلى نسخة احتياطية Systemy v2
 * (BackupFile — { app:"Systemy", version:2, tables: {...} }) تُستورد
 * من: الإعدادات ← بياناتك ← استيراد (وضع الدمج merge لا يمسّ بياناتك).
 *
 * الاستخدام:
 *   bun scripts/migrate-lifeos.ts <lifeos-export.json> [--dry-run] [--out ملف.json]
 *
 * مبادئ صارمة:
 *  - قراءة فقط من المصدر؛ لا يلمس أي قاعدة حية.
 *  - كل معرف يُسبق بـ «lo-» فلا تصادم مع بيانات Systemy القائمة.
 *  - الوضع الافتراضي dry-run: يطبع جدول الجرد بلا كتابة أي ملف.
 *  - السجلات التالفة/المجهولة تُتخطى مع عدّها — لا سقوط صامت.
 *  - لا ترحيل لأسرار أو تفضيلات جهاز (settings/profile) — هذه بيئة مختلفة.
 *  - كل جدول مخرج موصوف بنوع Systemy الحقيقي من src/lib/types — تحقق
 *    زمن الترجمة أن المخرج مطابق للمخطط الذي ستستورده قاعدة البيانات.
 *  - حساب المدخلات صارم: لكل مجموعة مصدر «المدخلات = المُرحّلة + المتخطاة»،
 *    والإجمالي يُطبع مع تحقق مطابق (✓/⚠) — عمود «صفوف الناتج» منفصل
 *    لأن بعض التحويلات توسّع السجل (امتحان←مهمة+كتلة، قياس صحي←حتى 4 سجلات).
 */

import { readFileSync, writeFileSync } from "node:fs";
import type {
  Course,
  Flashcard,
  FocusSession,
  Habit,
  HabitLog,
  HealthKind,
  HealthLog,
  Mood,
  Note,
  Project,
  Task,
  TimeBlock,
  WellbeingActivity,
  WellbeingLog,
  WellbeingRule,
} from "../src/lib/types";

// ─────────────────────────── أنواع خفيفة ───────────────────────────

interface LoRow {
  id?: string;
  created_at?: string;
  [k: string]: unknown;
}
interface LoExport {
  collections?: Record<string, LoRow[]>;
  // بعض نسخ exportAll تستخدم التنسيق المسطح
  [k: string]: unknown;
}
/** جرد مجموعة مصدر واحدة: المدخلات = المُرحّلة + المتخطاة (ثابت رياضي مضمون) */
interface Counts {
  source: string;
  input: number;
  migrated: number;
  skipped: number;
  outputs: number;
  note?: string;
}

// ─────────────────────────── أدوات مساعدة ───────────────────────────

const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };

function normDigits(s: unknown): string {
  return String(s ?? "")
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
    .trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(normDigits(v));
  return Number.isFinite(n) ? n : fallback;
}

/** تاريخ Life-os الحر → ISO 'YYYY-MM-DD' (يقبل YYYY-MM-DD أو أي Date قابل للتحليل) */
function isoDate(v: unknown): string | undefined {
  const s = normDigits(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

/** 'HH:mm' صالح أو undefined — يقبل الوقت الحر أو داخل ISO datetime
 *  (مثل '2026-10-30T10:30:00Z' ← '10:30' — اكتُشف بالاختبار على المخطط الحقيقي:
 *  المطابقة من بداية السلسلة كانت تفشل أمام بادئة التاريخ فيسقط كل شيء للاحتياط) */
function hhmm(v: unknown): string | undefined {
  const s = normDigits(v);
  // وقت داخل ISO datetime أولاً (بعد حرف T)، وإلا وقت حر ببداية السلسلة
  const m = s.match(/T(\d{1,2}):(\d{2})/) ?? s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** كل الأزرار تمر من هنا: بادئة lo- تضمن عدم التصادم مع معرفات Systemy */
function oid(row: LoRow): string {
  const raw = normDigits(row.id);
  return `lo-${raw || Math.random().toString(36).slice(2, 10)}`;
}

function stamp(row: LoRow): string {
  return row.created_at ?? new Date().toISOString();
}

const asArray = (v: unknown): string => (Array.isArray(v) ? v.join(", ") : normDigits(v) || "");

// ─────────────────────────── قارئ التصدير ───────────────────────────

/** يقبل التنسيقات الثلاثة:
 *  1) { exportedAt, app: "Life OS", data: { <name>: rows[] } } — تنسيق exportAll
 *     الحقيقي في Life-os (db/local.ts:195-199) — الأصل المعتمد.
 *  2) { collections: { ... } } — تنسيق اختيارنا السابق (عينات الاختبار).
 *  3) { <name>: [...] } المسطح — احتياط. */
function readCollections(source: LoExport): Record<string, LoRow[]> {
  // التنسيق الحقيقي أولاً — مجموعات exportAll تحت مفتاح data لا collections
  const data = (source as Record<string, unknown>).data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, LoRow[]>;
  }
  if (source.collections && typeof source.collections === "object") {
    return source.collections as Record<string, LoRow[]>;
  }
  const out: Record<string, LoRow[]> = {};
  for (const [k, v] of Object.entries(source)) {
    if (Array.isArray(v)) out[k] = v as LoRow[];
  }
  return out;
}

// ─────────────────────────── مخطط التحويل ───────────────────────────

function buildTables(c: Record<string, LoRow[]>) {
  const t: Record<string, unknown[]> = {};
  const counts: Counts[] = [];
  /** تتبّع مجموعة مصدر: المدخلات يجب أن تساوي المُرحّلة + المتخطاة دائماً.
   *  الصفوف الفارغة (0 مدخل) لا تُطبع ص戸اً — لا تضيف شيئاً للجرد. */
  const track = (source: string, input: number, migrated: number, skipped: number, outputs: number, note?: string) => {
    if (input === 0 && migrated === 0 && skipped === 0 && outputs === 0) return;
    counts.push({ source, input, migrated, skipped, outputs, note });
  };
  /** المجموعات المصدر التي استهلكتها قاعدة تحويل (لايُعاد عدّها «مجهولة») */
  const handled = new Set<string>();
  const rows = (name: string): LoRow[] => {
    handled.add(name);
    return Array.isArray(c[name]) ? c[name] : [];
  };

  // ── المهام ──
  {
    const out: Task[] = [];
    let skipped = 0;
    for (const r of rows("tasks")) {
      const title = normDigits(r.title);
      if (!title) { skipped++; continue; }
      const energy = normDigits(r.energy);
      out.push({
        id: oid(r),
        title,
        description: normDigits(r.desc) || undefined,
        date: isoDate(r.due) ?? new Date().toISOString().slice(0, 10),
        time: hhmm(r.due),
        // الطاقة العالية Life-os → أولوية عالية، المتوسطة → عادية، المنخفضة → منخفضة
        priority: energy.includes("high") ? "high" : energy.includes("low") ? "low" : "normal",
        done: r.done === true,
        completedAt: r.done === true ? stamp(r) : undefined,
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.tasks = out;
    track("tasks", out.length + skipped, out.length, skipped, out.length, "energy → priority (high/low)، الوصف إن وجد");
  }

  // ── العادات ──
  {
    const out: Habit[] = [];
    let skipped = 0;
    for (const r of rows("habits")) {
      const name = normDigits(r.name);
      if (!name) { skipped++; continue; }
      const freq = normDigits(r.freq);
      const target = num(r.target, 1);
      out.push({
        id: oid(r),
        name,
        icon: "flame",
        // لون العادة الحقيقي من Life-os يُنقل كما هو (hex صالح)، والاحتياط مرجالي Systemy
        color: /^#[0-9a-fA-F]{6}$/.test(normDigits(r.color)) ? normDigits(r.color) : "#FF8E7A",
        target: target > 0 ? target : 1,
        unit: normDigits(r.unit) || "مرة",
        cadence: freq.includes("week") ? "weekly" : "daily",
        remindAt: hhmm(r.time_pref) ?? undefined,
        archived: false,
        order: out.length + 1,
        createdAt: stamp(r),
      });
    }
    t.habits = out;
    track("habits", out.length + skipped, out.length, skipped, out.length, "freq→cadence، time_pref→remindAt");
  }

  // ── سجلات العادات ──
  {
    const out: HabitLog[] = [];
    let skipped = 0;
    for (const r of rows("habit_logs")) {
      const habitId = normDigits(r.habit_id);
      const date = isoDate(r.day);
      if (!habitId || !date) { skipped++; continue; }
      out.push({
        id: oid(r),
        habitId: `lo-${habitId}`,
        date,
        count: num(r.value, 1) > 0 ? num(r.value, 1) : 1,
        // HabitLog في مخطط Systemy لا يملك createdAt — الطابع الزمني في updatedAt
        updatedAt: stamp(r),
      });
    }
    t.habitLogs = out;
    track("habit_logs", out.length + skipped, out.length, skipped, out.length);
  }

  // ── اليوميات ──
  {
    const out: Note[] = [];
    let skipped = 0;
    for (const r of rows("journal_entries")) {
      const content = normDigits(r.content) || normDigits(r.title);
      if (!content) { skipped++; continue; }
      out.push({
        id: oid(r),
        title: normDigits(r.title) || "يومية منقولة",
        content,
        type: "journal" as const,
        mood: normDigits(r.mood) || undefined,
        tags: asArray(r.tags),
        pinned: r.pinned === true,
        secret: false,
        date: isoDate(r.created_at) ?? new Date().toISOString().slice(0, 10),
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.notes = out;
    track("journal_entries", out.length + skipped, out.length, skipped, out.length);
  }

  // ── مكتبة التعلم → ملاحظات ──
  {
    const out = (t.notes ?? []) as Note[];
    let skipped = 0;
    let migrated = 0;
    for (const r of rows("learning_items")) {
      const title = normDigits(r.title);
      if (!title) { skipped++; continue; }
      migrated++;
      const author = normDigits(r.author);
      const status = normDigits(r.status);
      const progress = num(r.progress, 0);
      out.push({
        id: oid(r),
        title: `📚 ${title}${author ? ` — ${author}` : ""}`,
        content: `من مكتبة التعلم في Life-os.${status ? `\nالحالة: ${status}` : ""}${progress ? `\nالتقدم: ${progress}%` : ""}`,
        type: "note" as const,
        tags: "منقول,مكتبة",
        pinned: false,
        secret: false,
        date: isoDate(r.created_at) ?? new Date().toISOString().slice(0, 10),
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.notes = out;
    track("learning_items", migrated + skipped, migrated, skipped, migrated, "الحالة والتقدم داخل المحتوى");
  }

  // ── المقررات ──
  {
    const out: Course[] = [];
    let skipped = 0;
    for (const r of rows("study_courses")) {
      const name = normDigits(r.name);
      if (!name) { skipped++; continue; }
      out.push({
        id: oid(r),
        name,
        instructor: normDigits(r.teacher) || undefined,
        color: "#F5D565",
        icon: "graduation-cap",
        gradeItems: "[]",
        archived: normDigits(r.status) === "done",
        createdAt: stamp(r),
      });
    }
    t.courses = out;
    track("study_courses", out.length + skipped, out.length, skipped, out.length);
  }

  // ── البطاقات (SM-2 → لايتنر) ──
  {
    const out: Flashcard[] = [];
    let skipped = 0;
    for (const r of rows("flashcards")) {
      const q = normDigits(r.front);
      const a = normDigits(r.back);
      if (!q || !a) { skipped++; continue; }
      // تقدير الصندوق من فترة SM-2: ≤1ي→1، ≤3→2، ≤7→3، ≤14→4، >14→5
      const interval = num(r.interval_days, 0);
      const box = interval <= 1 ? 1 : interval <= 3 ? 2 : interval <= 7 ? 3 : interval <= 14 ? 4 : 5;
      const due = isoDate(r.due_date) ?? new Date().toISOString().slice(0, 10);
      out.push({
        id: oid(r),
        courseId: r.course_id ? `lo-${normDigits(r.course_id)}` : undefined,
        question: q,
        answer: a,
        box,
        nextReview: due,
        createdAt: stamp(r),
      });
    }
    t.flashcards = out;
    track("flashcards", out.length + skipped, out.length, skipped, out.length, "ease/interval SM-2 → صندوق لايتنر 1-5");
  }

  // ── الأحداث → كتل تقويم ──
  {
    const out: TimeBlock[] = [];
    let skipped = 0;
    for (const r of rows("events")) {
      const title = normDigits(r.title);
      const start = normDigits(r.starts_at);
      if (!title || !start) { skipped++; continue; }
      const date = isoDate(start);
      if (!date) { skipped++; continue; }
      const startTime = hhmm(start) ?? "09:00";
      const startMin = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
      const endRaw = normDigits(r.ends_at);
      const endMin = endRaw && hhmm(endRaw) ? Number(hhmm(endRaw)!.slice(0, 2)) * 60 + Number(hhmm(endRaw)!.slice(3)) : startMin + 60;
      const endTime = `${String(Math.floor(Math.min(endMin, startMin + 480) / 60)).padStart(2, "0")}:${String(Math.min(endMin, startMin + 480) % 60).padStart(2, "0")}`;
      out.push({
        id: oid(r),
        title,
        type: normDigits(r.source).includes("exam") ? "learning" : "personal",
        date,
        startTime,
        endTime,
        note: normDigits(r.location) ? `المكان: ${normDigits(r.location)}` : undefined,
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.blocks = out;
    track("events", out.length + skipped, out.length, skipped, out.length, "all_day→كتلة 09:00-10:00");
  }

  // ── الامتحانات → مهمة عالية الأولوية + كتلة يوم كامل ──
  {
    const taskOut = (t.tasks ?? []) as Task[];
    const blockOut = (t.blocks ?? []) as TimeBlock[];
    let skipped = 0;
    let migrated = 0;
    for (const r of rows("exams")) {
      const name = normDigits(r.name);
      const date = isoDate(r.exam_date);
      if (!name || !date) { skipped++; continue; }
      migrated++;
      taskOut.push({
        id: oid(r),
        title: `📝 امتحان: ${name}`,
        description: `امتحان منقول من Life-os — ${num(r.chapters_count, 0)} فصلاً`,
        date,
        priority: "high",
        done: false,
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
      blockOut.push({
        id: `${oid(r)}-b`,
        title: `امتحان ${name}`,
        type: "learning",
        date,
        startTime: "08:00",
        endTime: "09:00",
        note: "يوم الامتحان",
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.tasks = taskOut;
    t.blocks = blockOut;
    track("exams", migrated + skipped, migrated, skipped, migrated * 2, "كل امتحان ← مهمة عالية + كتلة (صفان)");
  }

  // ── قياسات الصحة (سجل واحد قد يولّد حتى 4 سجلات Systemy) ──
  {
    const out: HealthLog[] = [];
    let skipped = 0;
    let migrated = 0;
    for (const r of rows("health_metrics")) {
      const date = isoDate(r.day);
      if (!date) { skipped++; continue; }
      const entries: Array<[HealthKind, number, string]> = [
        ["water", num(r.water_ml, 0) / 250, "كوب"],
        ["sleep", num(r.sleep_min, 0) / 60, "ساعة"],
        ["steps", num(r.steps, 0), "خطوة"],
        ["weight", num(r.weight_kg, 0), "كجم"],
      ];
      let produced = 0;
      for (const [kind, value, unit] of entries) {
        if (value > 0) {
          out.push({ id: `${oid(r)}-${kind}`, date, kind, value: Math.round(value * 10) / 10, unit, createdAt: stamp(r) });
          produced++;
        }
      }
      if (produced === 0) {
        // تاريخ سليم لكن كل القياسات صفر/فارغة — لا شيء يُرحَّل منه
        skipped++;
      } else {
        migrated++;
      }
    }
    t.healthLogs = out;
    track("health_metrics", migrated + skipped, migrated, skipped, out.length, "ملّي/دقائق → أكواب/ساعات (سجل←حتى 4)");
  }

  // ── التمارين → سجل نشاط ──
  {
    const out = (t.healthLogs ?? []) as HealthLog[];
    let skipped = 0;
    let migrated = 0;
    for (const r of rows("workouts")) {
      const date = isoDate(r.done_at) ?? isoDate(r.created_at);
      const name = normDigits(r.name);
      if (!date || !name) { skipped++; continue; }
      migrated++;
      out.push({
        id: oid(r),
        date,
        kind: "exercise",
        value: num(r.duration_min, 30),
        unit: "دقيقة",
        note: name,
        createdAt: stamp(r),
      });
    }
    t.healthLogs = out;
    track("workouts", migrated + skipped, migrated, skipped, migrated);
  }

  // ── جلسات التركيز ──
  {
    const out: FocusSession[] = [];
    let skipped = 0;
    for (const r of rows("focus_sessions")) {
      const date = isoDate(r.created_at);
      const minutes = num(r.duration_min, 0);
      if (!date || minutes < 1) { skipped++; continue; }
      const tech = normDigits(r.technique);
      out.push({
        id: oid(r),
        technique: tech.includes("52") ? "52-17" : tech.includes("deep") ? "deep" : tech.includes("custom") ? "custom" : "pomodoro",
        task: normDigits(r.task) || "جلسة منقولة",
        minutes,
        // طاقة ما قبل الجلسة موجودة فعلًا في Life-os (energy_before) — تُنقل إن صحّت 1-5
        energyBefore: (() => { const e = num(r.energy_before, 0); return e >= 1 && e <= 5 ? e : undefined; })(),
        completed: true,
        date,
        createdAt: stamp(r),
      });
    }
    t.focusSessions = out;
    track("focus_sessions", out.length + skipped, out.length, skipped, out.length);
  }

  // ── العافية ──
  {
    const acts: WellbeingActivity[] = [];
    let skippedA = 0;
    for (const r of rows("wellbeing_activities")) {
      const name = normDigits(r.name);
      if (!name) { skippedA++; continue; }
      acts.push({
        id: oid(r),
        name,
        kind: normDigits(r.type).includes("drain") ? "draining" : "healthy",
        icon: normDigits(r.type).includes("drain") ? "battery-low" : "heart-pulse",
        archived: false,
        createdAt: stamp(r),
      });
    }
    t.wellbeingActivities = acts;
    track("wellbeing_activities", acts.length + skippedA, acts.length, skippedA, acts.length);

    const logs: WellbeingLog[] = [];
    let skippedL = 0;
    for (const r of rows("wellbeing_logs")) {
      const activityId = normDigits(r.activity_id);
      const date = isoDate(r.day);
      if (!activityId || !date) { skippedL++; continue; }
      logs.push({ id: oid(r), activityId: `lo-${activityId}`, date, createdAt: stamp(r) });
    }
    t.wellbeingLogs = logs;
    track("wellbeing_logs", logs.length + skippedL, logs.length, skippedL, logs.length);

    const rules: WellbeingRule[] = [];
    let skippedR = 0;
    for (const r of rows("wellbeing_rules")) {
      const text = normDigits(r.text);
      if (!text) { skippedR++; continue; }
      rules.push({
        id: oid(r),
        text,
        remindAt: hhmm(r.time),
        enabled: r.enabled !== false,
        createdAt: stamp(r),
      });
    }
    t.wellbeingRules = rules;
    track("wellbeing_rules", rules.length + skippedR, rules.length, skippedR, rules.length);
  }

  // ── المناطق والمشاريع → مشاريع ──
  {
    const out: Project[] = [];
    let skipped = 0;
    const areaName = new Map<string, string>();
    const areaRows = rows("areas");
    for (const r of areaRows) {
      const name = normDigits(r.name);
      if (name) areaName.set(normDigits(r.id), name);
    }
    // المناطق تُستهلك للإثراء فقط — سجلها نفسه لا يصبح صف Systemy مستقلاً
    track("areas", areaRows.length, 0, areaRows.length, 0, "تُستهلك للإثراء — اسمها يُدمج في اسم المشروع (لا صف مستقل)");
    for (const r of rows("projects")) {
      const name = normDigits(r.name);
      if (!name) { skipped++; continue; }
      const area = areaName.get(normDigits(r.area_id));
      out.push({
        id: oid(r),
        name: area ? `${name} (${area})` : name,
        description: normDigits(r.description) || "مشروع منقول من Life-os",
        color: "#8EC5FF",
        icon: "kanban",
        status: normDigits(r.status) === "done" ? "done" : normDigits(r.status) === "paused" ? "paused" : "active",
        deadline: isoDate(r.due),
        createdAt: stamp(r),
      });
    }
    t.projects = out;
    track("projects", out.length + skipped, out.length, skipped, out.length, "اسم المنطقة يُدمج في اسم المشروع");
  }

  // ── الأهداف الميتة في Life-os → مهام معالم ──
  {
    const taskOut = (t.tasks ?? []) as Task[];
    let skipped = 0;
    let migrated = 0;
    for (const r of rows("goals")) {
      const title = normDigits(r.title);
      if (!title) { skipped++; continue; }
      migrated++;
      taskOut.push({
        id: oid(r),
        title: `🎯 ${title}`,
        description: normDigits(r.detail) || "هدف منقول من Life-os",
        date: isoDate(r.target_date) ?? new Date().toISOString().slice(0, 10),
        priority: "normal",
        done: r.done === true || num(r.progress, 0) >= 100,
        createdAt: stamp(r),
        updatedAt: stamp(r),
      });
    }
    t.tasks = taskOut;
    track("goals", migrated + skipped, migrated, skipped, migrated, "الهدف المالي في Systemy مختلف البنية → مهمة معلم");
  }

  // ── المزاج من إشارات اليوميات ──
  {
    const out: Mood[] = [];
    let skipped = 0;
    for (const r of rows("journal_signals")) {
      const date = isoDate(r.created_at) ?? isoDate(r.day);
      const score = num(r.mood_score, 0);
      if (!date || score < 1) { skipped++; continue; }
      out.push({
        id: oid(r),
        score: Math.max(1, Math.min(5, Math.round(score))),
        factors: "",
        date,
        createdAt: stamp(r),
      });
    }
    // تُتتبَّع دائماً متى وُجدت مدخلات — حتى لو فشلت كلها (لا اختفاء صامت)
    if (out.length) t.moods = out;
    track("journal_signals", out.length + skipped, out.length, skipped, out.length, "mood_score 1-5 مباشرة");
  }

  // ── سجلات جداول Life-os بلا مقابل مقصود ──
  const intentionallySkipped = [
    "meals", "insights", "memory_nodes", "memory_edges",
    "captures", "files", "shares", "study_sessions", "body_logs",
    "analytics_events", "app_usage", "journal_signals_used",
  ];
  for (const name of intentionallySkipped) {
    const n = rows(name).length;
    if (n) track(name, n, 0, n, 0, "بلا مقابل في Systemy — موثّق في docs/integration");
  }

  // ── شبكة الأمان: أي مجموعة مصدر لم تستهلكها قاعدة تحويل ──
  // (كانت تختفي من الجرد كلياً — الآن تُعدّ متخطاة بشفافية)
  for (const [name, arr] of Object.entries(c)) {
    if (!handled.has(name) && Array.isArray(arr) && arr.length > 0) {
      track(name, arr.length, 0, arr.length, 0, "مجموعة غير معروفة — لا قاعدة تحويل");
    }
  }

  return { tables: t, counts };
}

// ─────────────────────────── الواجهة ───────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const src = args.find((a) => !a.startsWith("--"));
  const dryRun = !args.includes("--out") || args.includes("--dry-run");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;

  if (!src) {
    console.error("الاستخدام: bun scripts/migrate-lifeos.ts <lifeos-export.json> [--dry-run] [--out out.json]");
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(src, "utf-8");
  } catch (e) {
    console.error(`❌ تعذّرت قراءة الملف: ${(e as Error).message}`);
    process.exit(1);
  }

  let parsed: LoExport;
  try {
    parsed = JSON.parse(raw) as LoExport;
  } catch (e) {
    console.error(`❌ ملف JSON غير صالح: ${(e as Error).message}`);
    process.exit(1);
  }

  const collections = readCollections(parsed);
  const totalInput = Object.values(collections).reduce((n, arr) => n + arr.length, 0);
  if (totalInput === 0) {
    console.error("❌ لا مجموعات بيانات في الملف — تأكد أنه تصدير Life-os (db.exportAll).");
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   ترحيل Life-os → Systemy — جرد التحويل          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`المصدر: ${src} (${totalInput} سجلاً في ${Object.keys(collections).length} مجموعة)\n`);

  const { tables, counts } = buildTables(collections);

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`${pad("مجموعة المصدر", 22)}${pad("مدخلات", 8)}${pad("مُرحّلة", 9)}${pad("متخطاة", 8)}${pad("صفوف", 7)}ملاحظة`);
  console.log("─".repeat(95));
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalOutputs = 0;
  for (const c of counts) {
    console.log(`${pad(c.source, 22)}${pad(String(c.input), 8)}${pad(String(c.migrated), 9)}${pad(String(c.skipped), 8)}${pad(String(c.outputs), 7)}${c.note ?? ""}`);
    totalMigrated += c.migrated;
    totalSkipped += c.skipped;
    totalOutputs += c.outputs;
  }
  console.log("─".repeat(95));
  console.log(`${pad("الإجمالي", 22)}${pad(String(totalInput), 8)}${pad(String(totalMigrated), 9)}${pad(String(totalSkipped), 8)}${pad(String(totalOutputs), 7)}\n`);

  // ═══ التحقق الصارم: المدخلات = المُرحّلة + المتخطاة (يجب أن يتطابق دائماً) ═══
  if (totalInput === totalMigrated + totalSkipped) {
    console.log(`✓ الحساب متطابق: ${totalInput} مدخلاً = ${totalMigrated} مُرحّلة + ${totalSkipped} متخطاة`);
    console.log(`  صفوف Systemy الناتجة: ${totalOutputs} (بعض التحويلات توسّع السجل — العمود معلوماتي)\n`);
  } else {
    console.log(`⚠ عدم تطابق في الحساب! مدخلات ${totalInput} ≠ مُرحّلة ${totalMigrated} + متخطاة ${totalSkipped} — عطل في الجرد، أبلغ عنه.\n`);
  }

  if (dryRun) {
    console.log("🔍 وضع الجرد (dry-run) — لم يُكتب أي ملف.");
    console.log("   للتنفيذ: أضف --out <ملف.json>\n");
    return;
  }

  const backup = {
    app: "Systemy",
    version: 2,
    exportedAt: new Date().toISOString(),
    tables,
  };
  writeFileSync(outPath!, JSON.stringify(backup, null, 2), "utf-8");
  console.log(`✅ كُتب الملف: ${outPath} (${totalMigrated} سجلاً مصدراً، ${totalOutputs} صفاً في Systemy)`);
  console.log("   استورده من: Systemy → الإعدادات → بياناتك → استيراد → وضع الدمج\n");
}

main();
