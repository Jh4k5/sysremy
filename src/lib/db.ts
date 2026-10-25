/**
 * Systemy v2 — قاعدة البيانات المحلية (Dexie / IndexedDB)
 * كل البيانات على الجهاز — لا خادم إطلاقاً. reactive عبر useLive.
 */
"use client";

import Dexie, { liveQuery, type Table } from "dexie";
import { useEffect, useState } from "react";
import type {
  Account,
  Asset,
  Category,
  ChatMessage,
  Course,
  Debt,
  DocumentRecord,
  Flashcard,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  HealthLog,
  HomeItem,
  ListItem,
  Mood,
  Note,
  Person,
  Project,
  Recurring,
  Reminder,
  Settings,
  SystemModel,
  Task,
  TimeBlock,
  Transaction,
  Trip,
  WellbeingActivity,
  WellbeingLog,
  WellbeingRule,
} from "./types";

export class SystemyDB extends Dexie {
  settings!: Table<Settings, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  moods!: Table<Mood, string>;
  tasks!: Table<Task, string>;
  notes!: Table<Note, string>;
  goals!: Table<Goal, string>;
  recurrings!: Table<Recurring, string>;
  assets!: Table<Asset, string>;
  debts!: Table<Debt, string>;
  blocks!: Table<TimeBlock, string>;
  reminders!: Table<Reminder, string>;
  systems!: Table<SystemModel, string>;
  chat!: Table<ChatMessage, string>;
  // v3 — الأنظمة الجديدة
  healthLogs!: Table<HealthLog, string>;
  courses!: Table<Course, string>;
  flashcards!: Table<Flashcard, string>;
  projects!: Table<Project, string>;
  people!: Table<Person, string>;
  documents!: Table<DocumentRecord, string>;
  trips!: Table<Trip, string>;
  listItems!: Table<ListItem, string>;
  homeItems!: Table<HomeItem, string>;
  // v4 — من Life-os
  wellbeingActivities!: Table<WellbeingActivity, string>;
  wellbeingLogs!: Table<WellbeingLog, string>;
  wellbeingRules!: Table<WellbeingRule, string>;
  focusSessions!: Table<FocusSession, string>;

  constructor() {
    super("SystemyDB");
    this.version(1).stores({
      settings: "id",
      accounts: "id, type, archived, order",
      categories: "id, kind, archived, order",
      transactions: "id, date, type, accountId, categoryId, recurringId, goalId",
      habits: "id, archived, order, remindAt",
      habitLogs: "id, habitId, date",
      moods: "id, date",
      tasks: "id, date, done, priority",
      notes: "id, type, pinned, secret, date, updatedAt",
      goals: "id, archived, order",
      recurrings: "id, active, nextDate, type",
      assets: "id",
      debts: "id, direction, dueDate",
      blocks: "id, date, type, taskId, habitId",
      reminders: "id, dueAt, done, sourceType",
      systems: "id, key, order",
      chat: "id, role, createdAt",
    });
    // v2: فهرس sourceId للتذكيرات (تستعلمه actions عند حذف المصدر)
    this.version(2).stores({
      reminders: "id, dueAt, done, sourceType, sourceId",
    });
    // v3: جداول الأنظمة الجديدة + فهارس روابط على الجداول القائمة
    this.version(3).stores({
      healthLogs: "id, date, kind",
      courses: "id, archived",
      flashcards: "id, nextReview, courseId",
      projects: "id, status",
      people: "id, favorite",
      documents: "id, type, expiryDate",
      trips: "id, status, startDate",
      listItems: "id, scope, done, ownerId",
      homeItems: "id, nextService",
      tasks: "id, date, done, priority, projectId, courseId",
      transactions: "id, date, type, accountId, categoryId, recurringId, goalId, projectId, tripId",
      blocks: "id, date, type, taskId, habitId, courseId, projectId, tripId",
    });
    // v4 (تكامل Life-os): العافية + جلسات التركيز — إضافات تراكمية فقط،
    // لا يُعاد تشكيل أي جدول قائم فالترقية آمنة لكل البيانات الحية.
    this.version(4).stores({
      wellbeingActivities: "id, kind, archived",
      wellbeingLogs: "id, activityId, date",
      wellbeingRules: "id, enabled",
      focusSessions: "id, date, technique, taskId",
    });
  }
}

/** نسخة وحيدة من القاعدة (client فقط) */
export const db: SystemyDB =
  typeof window !== "undefined" ? new SystemyDB() : (null as unknown as SystemyDB);

/** معرف فريد */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `l${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** الآن بصيغة 'YYYY-MM-DDTHH:mm' محلية */
export function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ═══════════════════════ الإعدادات ═══════════════════════

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  displayName: "",
  avatarEmoji: "🌙",
  currency: "ر.س",
  monthStartDay: 1,
  weekStart: "sat",
  digits: "latn",
  accent: "gold",
  notificationsEnabled: false,
  inAppAlerts: true,
  monthlyIncome: 0,
  monthlyBudget: 0,
  lockEnabled: false,
  seeded: false,
  onboardingDone: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** قراءة الإعدادات — ترجع الافتراضية إن لم توجد */
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("app");
  return s ?? DEFAULT_SETTINGS;
}

/** تحديث الإعدادات جزئياً */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const s = await getSettings();
  const next = { ...s, ...patch, id: "app", updatedAt: new Date().toISOString() };
  await db.settings.put(next);
  return next;
}

// ═══════════════════════ البذور الهيكلية (بلا أي بيانات شخصية) ═══════════════════════

/** الفئات الافتراضية — هيكل قابل للتخصيص الكامل (بلا معاملات) */
const DEFAULT_CATEGORIES: Array<Partial<Category> & { name: string; kind: "expense" | "income" }> = [
  { name: "بقالة وطعام", icon: "shopping-basket", color: "#F5B95C", kind: "expense", budget: 1400, keywords: "تميمي,سلة,هورا,بقالة,لؤلؤة,بندة" },
  { name: "قهوة", icon: "coffee", color: "#C08457", kind: "expense", budget: 280, keywords: "قهوة,ستاربكس,درنك,بارنز,دنكن,لاتيه,كابتشينو" },
  { name: "مطاعم", icon: "utensils", color: "#FFB4A2", kind: "expense", budget: 420, keywords: "مطعم,بيتزا,برجر,شاورما,كباب,مشاوي,سوشي" },
  { name: "مواصلات", icon: "car-front", color: "#5CE1E6", kind: "expense", budget: 380, keywords: "أوبر,كريم,بنزين,وقود,محطة,مواصلات,موصل" },
  { name: "فواتير واشتراكات", icon: "receipt", color: "#8EC5FF", kind: "expense", budget: 620, keywords: "stc,كهرباء,مياه,نتفلكس,نتفليكس,سبوتيفاي,شاهد,اشتراك,فاتورة" },
  { name: "تسوق", icon: "shopping-bag", color: "#F8B4D9", kind: "expense", budget: 480, keywords: "نون,جرير,زارا,ايكيا,أمازون,ملابس" },
  { name: "ترفيه", icon: "gamepad-2", color: "#C4B5FD", kind: "expense", budget: 250, keywords: "سينما,بلايستيشن,ألعاب,تذاكر" },
  { name: "صحة", icon: "heart-pulse", color: "#6EE7A8", kind: "expense", budget: 200, keywords: "صيدلية,دكتور,نهدي,علاج,فيتامين" },
  { name: "تعليم", icon: "graduation-cap", color: "#F5D565", kind: "expense", budget: 240, keywords: "كورس,كتاب,دورة,أوديمي,تعلم" },
  { name: "حوالات للأهل", icon: "send", color: "#F5B95C", kind: "expense", budget: 2000, keywords: "حوالة,للأهل,الوالد,الوالدة,اهل" },
  { name: "هدايا وصدقة", icon: "gift", color: "#FFD9A0", kind: "expense", budget: 200, keywords: "هدية,صدقة,تبرع,خيرية" },
  { name: "راتب", icon: "briefcase", color: "#6EE7A8", kind: "income", keywords: "راتب,مرتب" },
  { name: "عمل حر", icon: "laptop", color: "#5CE1E6", kind: "income", keywords: "عميل,مشروع,فريلانس,تصميم,برمجة" },
  { name: "مبيعات", icon: "store", color: "#C4B5FD", kind: "income", keywords: "بيع,مبيعة,متجر" },
];

/** أنظمة v3 الثلاثة عشر — كل نظام بشاشة حقيقية (الإيمان اختياري لاحقاً) */
const DEFAULT_SYSTEMS: Array<Partial<SystemModel> & { key: string; name: string }> = [
  { key: "money", name: "المال والمحفظة", icon: "wallet", color: "#F5B95C", description: "حسابات، مظاريف ميزانية، رصيد آمن، أهداف، أصول وديون، التزامات متكررة" },
  { key: "tasks", name: "المهام والتركيز", icon: "check-square", color: "#5CE1E6", description: "مهام اليوم والوارد، مؤقت تركيز بومودورو، روابط بالمشاريع والمقررات" },
  { key: "habits", name: "العادات والروتين", icon: "flame", color: "#FF8E7A", description: "حلقات تقدم، سلاسل متسامحة، مؤقت، ربط عادة بمبلغ ادخار، تذكيرات" },
  { key: "health", name: "الصحة والجسم", icon: "heart-pulse", color: "#6EE7A8", description: "ماء ونوم ووزن ونشاط وخطوات، رسوم اتجاه، مزاج مرتبط" },
  { key: "journal", name: "العقل واليوميات", icon: "notebook-pen", color: "#C4B5FD", description: "يوميات وقوالب ومزاج وذكريات «في مثل هذا اليوم»" },
  { key: "learning", name: "التعلم والدراسة", icon: "graduation-cap", color: "#F5D565", description: "مقررات، محرك درجات مرجّح، بطاقات مراجعة متباعدة، جلسات مذاكرة" },
  { key: "goals", name: "الأهداف والادخار", icon: "target", color: "#FFB4A2", description: "أهداف بمعالم، محاكاة ماذا لو، مساهمات تتصل بالمال والعادات" },
  { key: "projects", name: "المشاريع والعمل", icon: "kanban", color: "#8EC5FF", description: "مشاريع بمهام وجلسات وقت، دخل ومصاريف مرتبطة، سعر ساعة" },
  { key: "people", name: "الأشخاص والعلاقات", icon: "users", color: "#F8B4D9", description: "ملفات أشخاص، آخر تواصل، ديون وهدايا ومعاملات مشتركة" },
  { key: "home", name: "المنزل والأسرة", icon: "home", color: "#F5B95C", description: "فواتير منزلية، مهام بالتناوب، قائمة بقالة، ممتلكات وصيانة" },
  { key: "notes", name: "الملاحظات والمعرفة", icon: "lightbulb", color: "#6EE7A8", description: "معرفة مرجعية بالوسوم والمفضلة وتثبيت، تحويل بند لمهمة" },
  { key: "vault", name: "المستندات والخزانة", icon: "shield", color: "#5CE1E6", description: "جوازات وعقود وضمانات، تنبيه انتهاء، مفضلة وأرشفة" },
  { key: "travel", name: "السفر والتجارب", icon: "plane", color: "#C08457", description: "رحلات بميزانية وبرنامج وقائمة تجهيز ومصاريف مرتبطة" },
  { key: "calendar", name: "التقويم والمواعيد", icon: "calendar", color: "#8EC5FF", description: "أحداث ومواعيد وكتل يوم، دمج المهام والالتزامات في عرض واحد" },
  { key: "wellbeing", name: "العافية والدوبامين", icon: "heart-hands", color: "#6EE7A8", description: "أنشطة تغذيك مقابل ما يستنزفك، رصيد الأسبوع الصافي، وقواعد تضعها لنفسك" },
  { key: "sys", name: "المساعد الذكي Sys", icon: "sparkles", color: "#F5D565", description: "محادثتك مع النظام: سؤال، تلخيص يومك، واقتراح الخطوة التالية" },
];

/**
 * إنشاء البذور الهيكلية بعد الإعداد الأولي: فئات + أنظمة فقط.
 * لا معاملات، لا عادات، لا ملاحظات — بداية نظيفة تماماً.
 */
export async function seedStructure(): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction("rw", db.categories, db.systems, async () => {
    const existingCats = await db.categories.count();
    if (existingCats === 0) {
      await db.categories.bulkPut(
        DEFAULT_CATEGORIES.map((c, i) => ({
          id: uid(),
          name: c.name,
          icon: c.icon ?? "tag",
          color: c.color ?? "#5CE1E6",
          kind: c.kind,
          budget: c.budget,
          keywords: c.keywords ?? "",
          archived: false,
          order: i + 1,
          createdAt: now,
        }))
      );
    }
    await seedSystems();
  });
  await saveSettings({ seeded: true });
}

/**
 * v3 ترحيل الأنظمة: يضيف مفاتيح الأنظمة الناقصة فقط —
 * بلمس اسم/لون/ترتيب أي نظام خصّصه المستخدم مسبقاً.
 * يُستدعى أيضاً من التطبيق عند الإقلاع لترقية قواعد v2 القائمة.
 */
export async function seedSystems(): Promise<void> {
  const existing = await db.systems.toArray();
  const have = new Set(existing.map((s) => s.key));
  const missing = DEFAULT_SYSTEMS.filter((sys) => !have.has(sys.key));
  if (missing.length === 0) return;
  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order), 0);
  const now = new Date().toISOString();
  await db.systems.bulkPut(
    missing.map((sys, i) => ({
      id: uid(),
      key: sys.key,
      name: sys.name,
      icon: sys.icon ?? "shapes",
      color: sys.color ?? "#F5B95C",
      description: sys.description ?? "",
      enabled: true,
      order: maxOrder + i + 1,
      config: "{}",
      createdAt: now,
    }))
  );
}

// ═══════════════════════ التفاعلية (liveQuery) ═══════════════════════

/**
 * خطاف تفاعلي: يشترك في استعلام Dexie مباشر — يتحدث تلقائياً
 * عند أي تغيير في الجداول المعنية. هذا هو سر الترابط:
 * كل حركة في أي شاشة تنعكس فوراً في كل الشاشات الأخرى.
 */
export function useLive<T>(fn: () => Promise<T>, deps: unknown[] = []): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({
      next: (v) => setData(v as T),
      error: (e) => console.error("[useLive]", e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return data;
}

/** جداول النسخ الاحتياطي الكاملة */
export const ALL_TABLES = [
  "settings",
  "accounts",
  "categories",
  "transactions",
  "habits",
  "habitLogs",
  "moods",
  "tasks",
  "notes",
  "goals",
  "recurrings",
  "assets",
  "debts",
  "blocks",
  "reminders",
  "systems",
  "chat",
  // v3
  "healthLogs",
  "courses",
  "flashcards",
  "projects",
  "people",
  "documents",
  "trips",
  "listItems",
  "homeItems",
  // v4 — تكامل Life-os
  "wellbeingActivities",
  "wellbeingLogs",
  "wellbeingRules",
  "focusSessions",
] as const;

export type TableName = (typeof ALL_TABLES)[number];

/** مسح كل البيانات نهائياً (حذف الحساب) */
export async function resetAll(): Promise<void> {
  for (const name of ALL_TABLES) {
    await (db as unknown as Record<string, Table>)[name].clear();
  }
}

/** نطاقات إعادة الضبط الانتقائي */
export type ResetScope =
  | "everything"
  | "money"
  | "habitsTasks"
  | "journal"
  | "calendar"
  | "health"
  | "learning"
  | "projects"
  | "people"
  | "home"
  | "travel"
  | "wellbeing"
  | "focus"

export const RESET_SCOPES: Record<ResetScope, readonly string[]> = {
  money: ["transactions", "recurrings", "accounts", "goals", "assets", "debts"],
  habitsTasks: ["habits", "habitLogs", "tasks", "reminders"],
  journal: ["notes", "moods", "chat"],
  calendar: ["blocks"],
  health: ["healthLogs", "moods"],
  learning: ["courses", "flashcards"],
  projects: ["projects"],
  people: ["people"],
  home: ["homeItems", "listItems"],
  travel: ["trips"],
  wellbeing: ["wellbeingActivities", "wellbeingLogs", "wellbeingRules"],
  focus: ["focusSessions"],
  everything: ALL_TABLES,
};

export const RESET_SCOPE_LABELS: Record<ResetScope, string> = {
  everything: "كل شيء (إعادة تشغيل التطبيق)",
  money: "المال فقط — معاملات وحسابات وأهداف",
  habitsTasks: "العادات والمهام والتذكيرات",
  journal: "الدفتر والمزاج والمحادثات",
  calendar: "أحداث التقويم فقط",
  health: "سجلات الصحة والمزاج",
  learning: "المقررات والبطاقات",
  projects: "المشاريع",
  people: "ملفات الأشخاص",
  home: "ممتلكات المنزل وقوائم البقالة",
  travel: "الرحلات",
  wellbeing: "أنشطة العافية وسجلاتها وقواعدها",
  focus: "سجل جلسات التركيز",
};

/** إعادة ضبط نطاق محدد — الفئات والأنظمة تبقى (هيكل) */
export async function resetScope(scope: ResetScope): Promise<void> {
  const tables = RESET_SCOPES[scope];
  await db.transaction("rw", db.tables, async () => {
    for (const name of tables) {
      await (db as unknown as Record<string, Table>)[name].clear();
    }
  });
}
