/**
 * Systemy v2 — الأنواع الأساسية (نموذج البيانات الكامل)
 * نظام تشغيل شخصي متكامل — مستخدم واحد، كل البيانات على الجهاز.
 * كل الأنواع هنا نقية (بلا Dexie) وتُستخدم في كل الطبقات.
 */

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // 'YYYY-MM-DDTHH:mm' أو ISO كامل

// ═══════════════════════ الإعدادات ═══════════════════════

export type WeekStart = "sat" | "sun" | "mon"
export type DigitStyle = "latn" | "arab"
export type AccentKey = "gold" | "cyan" | "mint" | "coral" | "lav"

export interface Settings {
  id: string // 'app' دائماً
  displayName: string
  avatarEmoji: string
  currency: string // رمز العرض مثل "ر.س" أو كود ISO مثل SAR
  monthStartDay: number // بداية الشهر المالي (1-28)
  weekStart: WeekStart
  digits: DigitStyle
  accent: AccentKey // لون التمييز الأساسي
  notificationsEnabled: boolean // إشعارات المتصفح
  inAppAlerts: boolean // مركز التنبيهات داخل التطبيق
  monthlyIncome: number // دخل شهري تقديري (للرصيد الآمن)
  /** ميزانية الصرف الشهرية — منفصلة عن الدخل (لواجهة اليوم/الأسبوع/الشهر) */
  monthlyBudget?: number
  /** v4: ميزانية الأسبوع — إن غابت تُشتق = monthlyBudget ÷ عدد أسابيع الشهر المالي */
  weeklyBudget?: number
  /** v4: مصير فائض/عجز الأسبوع — يُرحّل للأسبوع التالي (افتراضي) / يُحوَّل للادخار نهاية الشهر / يُصفَّر */
  carryOver?: "next" | "savings" | "reset"
  /** v4: كنس فائض الشهر تلقائياً إلى حساب الادخار عند انتهاء الشهر المالي */
  autoSweep?: boolean
  /** v4: مفتاح آخر شهر مالي تمّت تصفيته — يمنع تكرار الكنس (YYYY-MM لبداية الشهر المالي) */
  lastSweepMonth?: string
  lockEnabled: boolean
  pinHash?: string
  seeded: boolean // هل أُنشئت البذور الهيكلية (فئات/أنظمة)
  onboardingDone: boolean
  createdAt: string
  updatedAt: string
}

// ═══════════════════════ المال ═══════════════════════

export type AccountType = "cash" | "bank" | "wallet" | "credit" | "savings"

export interface Account {
  id: string
  name: string
  type: AccountType
  color: string
  icon: string
  /** الرصيد الافتتاحي — الرصيد الحالي مشتق من المعاملات */
  startingBalance: number
  currency?: string // إن اختلف عن عملة الإعدادات
  archived: boolean
  order: number
  createdAt: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  kind: "expense" | "income"
  /** مظروف الميزانية الشهري */
  budget?: number
  /** كلمات للتصنيف الذكي: "ستاربكس,قهوة" */
  keywords: string
  archived: boolean
  order: number
  createdAt: string
}

export type TxType = "expense" | "income" | "transfer"

export interface Transaction {
  id: string
  type: TxType
  amount: number
  description: string
  merchant?: string
  accountId: string
  /** للتحويل: الحساب المستلم */
  toAccountId?: string
  categoryId?: string
  /** 'YYYY-MM-DDTHH:mm' */
  date: ISODateTime
  source: "manual" | "capture" | "recurring" | "goal" | "import" | "sweep"
  tags: string
  person?: string
  notes?: string
  /** v4: صرف خارج ميزانية المعيشة — التزامات متكررة أو استثنائية لا تدخل في الحساب الأسبوعي/الشهري للمعيشة */
  outsideBudget?: boolean
  recurringId?: string
  goalId?: string
  /** روابط v3: مشروع/رحلة/شخص مرتبطون */
  projectId?: string
  tripId?: string
  personId?: string
  createdAt: string
  updatedAt: string
}

export type RecurringType = "expense" | "income"
export type CommitmentFrequency = "daily" | "weekly" | "monthly" | "yearly"

export interface Recurring {
  id: string
  name: string
  amount: number
  type: RecurringType
  frequency: CommitmentFrequency
  nextDate: ISODate
  icon: string
  categoryId?: string
  accountId?: string
  active: boolean
  /** تذكير قبل الاستحقاق بأيام (0 = يوم الاستحقاق فقط) */
  reminderDays?: number
  essential?: boolean
  note?: string
  /** v3: التزام منزلي — يظهر في نظام المنزل والأسرة */
  home?: boolean
  /** v4: التزام يُدفع خارج ميزانية المعيشة (الإيجار/القسط...) — معاملاته المولّدة لا تدخل حساب المعيشة */
  outsideBudget?: boolean
  createdAt: string
}

/** هدف ادخار — وعاء مسمّى */
export interface Goal {
  id: string
  name: string
  emoji: string
  color: string
  targetAmount: number
  savedAmount: number
  targetDate?: ISODate
  /** المساهمة الشهرية المخططة — تُقتطع من الرصيد الآمن */
  monthly: number
  archived: boolean
  order: number
  createdAt: string
}

export interface Asset {
  id: string
  name: string
  type: string // سيارة / ذهب / عقار / استثمار
  value: number
  unit?: string
  icon: string
  note?: string
  createdAt: string
}

export interface Debt {
  id: string
  name: string
  amount: number
  paid: number
  direction: "payable" | "receivable"
  dueDate?: ISODate
  person: string
  note?: string
  createdAt: string
}

// ═══════════════════════ العادات ═══════════════════════

export type HabitCadence = "daily" | "weekly"

export interface Habit {
  id: string
  name: string
  icon: string // اسم أيقونة lucide مثل "Flame"
  color: string
  /** عدد المرات المستهدفة في اليوم */
  target: number
  unit: string
  cadence: HabitCadence
  /** للأسبوعية: أيام الالتزام */
  daysPerWeek?: number
  /** مدة مؤقت اختيارية بالدقائق */
  timerMinutes?: number
  /** وقت تذكير يومي اختياري HH:mm */
  remindAt?: string
  /** ربط العادة بادخار: مبلغ يُضاف لهدف عند الإنجاز */
  saveAmount?: number
  goalId?: string
  systemKey?: string
  archived: boolean
  order: number
  createdAt: string
}

export interface HabitLog {
  id: string
  habitId: string
  date: ISODate
  count: number
  minutes?: number
  updatedAt: string
}

/** حساب سلسلة الأيام المتتالية (اليوم لا يكسر السلسلة إن لم يُنجز بعد) */
export function habitStreak(logs: Array<{ date: ISODate; count: number }>, base: ISODate, target: number): number {
  const hit = new Set(logs.filter((l) => l.count >= Math.max(1, target)).map((l) => l.date));
  let streak = 0;
  let cursor = base;
  if (!hit.has(cursor)) {
    const d = new Date(cursor + "T12:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  while (hit.has(cursor)) {
    streak += 1;
    const d = new Date(cursor + "T12:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

// ═══════════════════════ المزاج والمهام والملاحظات ═══════════════════════

export interface Mood {
  id: string
  score: number // 1-5
  factors: string
  note?: string
  date: ISODate
  createdAt: string
}

export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: string
  title: string
  description?: string
  date: ISODate
  /** وقت اختياري HH:mm — يظهر في التقويم والتذكيرات */
  time?: string
  priority: TaskPriority
  done: boolean
  completedAt?: string
  estimatedMinutes?: number
  tags?: string
  /** روابط v3 — كل رابط يجعل المهمة تظهر داخل نظامه */
  courseId?: string
  projectId?: string
  personId?: string
  tripId?: string
  goalId?: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  type: "note" | "journal"
  mood?: string
  tags: string
  pinned: boolean
  secret: boolean
  date: ISODate
  createdAt: string
  updatedAt: string
}

// ═══════════════════════ الصحة (v3) ═══════════════════════

export type HealthKind = "water" | "sleep" | "energy" | "weight" | "exercise" | "steps"

export interface HealthLog {
  id: string
  date: ISODate
  kind: HealthKind
  value: number
  unit: string // كوب / ساعة / نقطة / كجم / دقيقة / خطوة
  note?: string
  createdAt: string
}

export const HEALTH_META: Record<HealthKind, { label: string; unit: string; icon: string; color: string; target: number; step: number }> = {
  water: { label: "الماء", unit: "كوب", icon: "glass-water", color: "#5CE1E6", target: 8, step: 1 },
  sleep: { label: "النوم", unit: "ساعة", icon: "moon", color: "#8EC5FF", target: 8, step: 0.5 },
  energy: { label: "الطاقة", unit: "نقطة", icon: "zap", color: "#F5D565", target: 5, step: 1 },
  weight: { label: "الوزن", unit: "كجم", icon: "scale", color: "#6EE7A8", target: 0, step: 0.5 },
  exercise: { label: "النشاط", unit: "دقيقة", icon: "dumbbell", color: "#FF8E7A", target: 30, step: 10 },
  steps: { label: "الخطوات", unit: "خطوة", icon: "footprints", color: "#C4B5FD", target: 8000, step: 500 },
}

// ═══════════════════════ التعلم (v3) ═══════════════════════

export interface GradeItem {
  name: string
  weight: number // نسبة البند من الدرجة الكلية %
  score: number // الدرجة المحصلة
  max: number // الدرجة الكاملة للبند
}

export interface Course {
  id: string
  name: string
  code?: string
  instructor?: string
  color: string
  icon: string
  credits?: number
  /** بنود الدرجات — JSON: GradeItem[] */
  gradeItems: string
  archived: boolean
  createdAt: string
}

export interface Flashcard {
  id: string
  courseId?: string
  question: string
  answer: string
  /** صندوق لايتنر 1-5 — كل مراجعة ناجحة ترفع الصندوق */
  box: number
  nextReview: ISODate
  createdAt: string
}

/** فواصل مراجعة لايتنر بالأيام لكل صندوق */
export const LEITNER_INTERVALS = [0, 1, 3, 7, 14, 30]

// ═══════════════════════ المشاريع (v3) ═══════════════════════

export type ProjectStatus = "active" | "paused" | "done"

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  status: ProjectStatus
  deadline?: ISODate
  /** سعر الساعة للعمل الحر — لحساب القيمة القابلة للفوترة */
  ratePerHour?: number
  createdAt: string
}

// ═══════════════════════ الأشخاص (v3) ═══════════════════════

export const PERSON_RELATIONS = ["عائلة", "صديق", "عمل", "عميل", "جار", "آخر"] as const

export interface Person {
  id: string
  name: string
  relation: string
  tags: string
  birthday?: ISODate
  lastContact?: ISODate
  notes?: string
  favorite: boolean
  createdAt: string
}

// ═══════════════════════ المستندات — الخزانة (v3) ═══════════════════════

export type DocType =
  | "passport"
  | "id"
  | "license"
  | "contract"
  | "warranty"
  | "certificate"
  | "medical"
  | "other"

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  passport: "جواز سفر",
  id: "هوية",
  license: "رخصة",
  contract: "عقد",
  warranty: "ضمان",
  certificate: "شهادة",
  medical: "تقرير طبي",
  other: "آخر",
}

export interface DocumentRecord {
  id: string
  title: string
  type: DocType
  issuer?: string
  number?: string
  issueDate?: ISODate
  expiryDate?: ISODate
  notes?: string
  tags: string
  favorite: boolean
  createdAt: string
}

// ═══════════════════════ السفر (v3) ═══════════════════════

export type TripStatus = "planned" | "active" | "done"

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: ISODate
  endDate: ISODate
  budget: number
  status: TripStatus
  notes?: string
  createdAt: string
}

// ═══════════════════════ القوائم المشتركة (v3) ═══════════════════════

export interface ListItem {
  id: string
  /** بقالة (المنزل) أو تجهيز رحلة (السفر) */
  scope: "grocery" | "trip"
  /** للسفر: معرف الرحلة */
  ownerId?: string
  text: string
  qty?: string
  done: boolean
  createdAt: string
}

// ═══════════════════════ المنزل — الممتلكات والصيانة (v3) ═══════════════════════

export interface HomeItem {
  id: string
  name: string
  kind: string // جهاز / أثاث / مركبة / عقد صيانة
  purchaseDate?: ISODate
  warrantyUntil?: ISODate
  nextService?: ISODate
  note?: string
  createdAt: string
}

// ═══════════════════════ التقويم ═══════════════════════

export type BlockType = "work" | "personal" | "health" | "learning" | "rest" | "other";

export interface TimeBlock {
  id: string
  title: string
  type: BlockType
  date: ISODate
  startTime: string // 'HH:mm'
  endTime: string // 'HH:mm'
  color?: string
  icon?: string
  note?: string
  taskId?: string
  habitId?: string
  courseId?: string
  projectId?: string
  tripId?: string
  createdAt: string
  updatedAt: string
}

// ═══════════════════════ التذكيرات والتنبيهات ═══════════════════════

export interface Reminder {
  id: string
  title: string
  dueAt: ISODateTime
  sourceType?: "task" | "habit" | "recurring" | "block" | "debt" | "manual" | "document" | "trip" | "person" | "home"
  sourceId?: string
  done: boolean
  dismissed?: boolean
  snoozedUntil?: ISODateTime
  createdAt: string
}

export type AlertSeverity = "danger" | "warning" | "info";

export interface AppAlert {
  id: string
  title: string
  detail?: string
  severity: AlertSeverity
  icon: string
  actionLabel?: string;
  targetView?: ViewId;
  dismissKey?: string;
}

// ═══════════════════════ الأنظمة ═══════════════════════

export interface SystemModel {
  id: string
  key: string // money | habits | health | goals | learning | projects | people | home
  name: string
  icon: string
  color: string
  description: string
  enabled: boolean
  order: number
  /** إعدادات النظام (JSON): ويدجتات مفعلة، تتبعات، خصائص */
  config: string
  createdAt: string
}

// ═══════════════════════ نسخ احتياطي / محادثة ═══════════════════════

export interface BackupFile {
  app: "Systemy";
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant";
  content: string
  createdAt: string
}

// ═══════════════════════ الشاشات ═══════════════════════

export type ViewId =
  | "today"
  | "money"
  | "calendar"
  | "habits"
  | "journal"
  | "insights"
  | "systems"
  | "settings"
  | "more"
  // شاشات الأنظمة v3
  | "tasks"
  | "health"
  | "learning"
  | "goals"
  | "projects"
  | "people"
  | "home"
  | "notes"
  | "vault"
  | "travel";

export type QuickAddTab =
  | "expense"
  | "income"
  | "task"
  | "habit"
  | "block"
  | "note"
  | "goal"
  | "recurring"
  | "account"
  | "category"
  | "asset"
  | "debt";
