"use client";

/**
 * Systemy v4 — شاشة الأنظمة (إعادة تصميم كاملة)
 * شبكة بطاقات غنية: فقاعة أيقونة كبيرة + اسم ووصف + مؤشر حي صادق + شرائح مميزات،
 * ونظامان جديدان (التقويم والمواعيد + المساعد الذكي Sys).
 * V5-س «الشريط»: عدّاد الأنظمة النشطة داخل شريحة ribbon-soft (بلا تدرج نص)،
 * شرائح المميزات بسطح الشريط الخافت، المؤشر الحي داخل كبسولة زجاجية،
 * وضغط البطاقات 0.96، وstagger 20ms للشبكة (15 بطاقة = 280ms كحد أقصى).
 * وضع التخصيص: سحب لإعادة الترتيب عبر Reorder (مقبض واضح + أزرار أعلى/أسفل بديلة)
 * مع تفعيل/تعطيل وتغيير اللون والأيقونة لكل نظام —
 * كتابات مباشرة على db.systems (الاستثناء الوحيد المسموح).
 */

import { createElement, useMemo, useState } from "react";
import { Reorder, motion, useDragControls } from "framer-motion";
import { Check, ChevronDown, ChevronUp, GripVertical, HeartHandshake, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { ColorSwatches, EmptyState, IconGrid, iconByName } from "@/components/systemy/ui-bits";
import { db, useLive } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SystemModel, ViewId } from "@/lib/types";

/* ═══════════════════════ التنقل والأعداد الحية ═══════════════════════ */

/** شاشة التطبيق المرتبطة بكل نظام — التقويم عبر goToCalendar وSys عبر setSysOpen */
const NAV: Record<string, ViewId> = {
  money: "money",
  tasks: "tasks",
  habits: "habits",
  health: "health",
  journal: "journal",
  learning: "learning",
  goals: "goals",
  projects: "projects",
  people: "people",
  home: "home",
  notes: "notes",
  vault: "vault",
  travel: "travel",
  calendar: "calendar",
  // v4 — من Life-os
  wellbeing: "wellbeing",
};

/** شرائح المميزات لكل نظام — لمحة سريعة عما بداخل كل عالم */
const SYSTEM_FEATURES: Record<string, string[]> = {
  money: ["ميزانية أسبوعية", "مظاريف", "ادخار تلقائي"],
  tasks: ["بومودورو", "وارد", "روابط"],
  habits: ["سلاسل", "تذكيرات", "ادخار"],
  health: ["قياسات", "رسوم اتجاه", "مزاج"],
  journal: ["قوالب", "ذكريات", "مزاج"],
  learning: ["مقررات", "بطاقات متباعدة", "درجات"],
  goals: ["معالم", "ماذا لو", "مساهمات"],
  projects: ["كانبان", "سعر ساعة", "جلسات"],
  people: ["آخر تواصل", "ديون وهدايا", "مفضلة"],
  home: ["بقالة", "فواتير", "تناوب"],
  notes: ["وسوم", "تثبيت", "تحويل لمهمة"],
  vault: ["تنبيه انتهاء", "مفضلة", "أرشفة"],
  travel: ["ميزانية رحلة", "برنامج", "تجهيز"],
  calendar: ["أحداث", "كتل يوم", "دمج"],
  sys: ["محادثة", "تلخيص", "اقتراحات"],
  wellbeing: ["أنشطة", "رصيد الأسبوع", "قواعد"],
};

/** صياغة عربية سليمة للعدد مع جمعه (مفرد/مثنى/جمع قليل/جمع كثير) */
function arabicCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${formatNumber(n)} ${few}`;
  return `${formatNumber(n)} ${many}`;
}

/** حزمة الأعداد الحية — قراءة تفاعلية واحدة من كل الجداول ذات الصلة */
interface SystemsData {
  systems: SystemModel[];
  accounts: string[];
  txCount: number;
  goalTxCount: number;
  habits: string[];
  habitLogCount: number;
  moodCount: number;
  journalCount: number;
  noteCount: number;
  goals: string[];
  tasks: number;
  openTasksToday: number;
  openTaskTitles: string[];
  debts: string[];
  recurrings: string[];
  assetsCount: number;
  healthLogCount: number;
  courses: string[];
  flashcardsDue: number;
  projects: string[];
  people: string[];
  documentsCount: number;
  documentsExpiring: string[];
  trips: string[];
  groceryPending: number;
  homeItemsCount: number;
  // v4
  blocksUpcoming: number;
  wellbeingActivities: number;
  wellbeingLogCount: number;
}

/**
 * المؤشر الحي الصادق لبطاقة النظام (Master Prompt §5.4):
 * رقم واحد مفيد من بياناتك، أو — عند الفراغ — دعوة صريحة لإنشاء أول سجل.
 * لا «0 متتبع» بلا معنى أبداً.
 */
function liveIndicator(key: string, d: SystemsData): { text: string; action: string } {
  switch (key) {
    case "money":
      return d.txCount > 0
        ? { text: `${formatNumber(d.txCount)} ${d.txCount === 1 ? "معاملة" : "معاملات"} مسجلة`, action: "" }
        : { text: "", action: "سجّل أول مصروف" };
    case "tasks":
      return d.openTasksToday > 0
        ? { text: `${formatNumber(d.openTasksToday)} ${d.openTasksToday === 1 ? "مهمة" : "مهام"} اليوم`, action: "" }
        : d.tasks > 0
          ? { text: `${formatNumber(d.tasks)} ${d.tasks === 1 ? "مهمة" : "مهام"} — اليوم صفر مفتوح`, action: "" }
          : { text: "", action: "أضف أول مهمة" };
    case "habits":
      return d.habits.length > 0
        ? { text: `${formatNumber(d.habits.length)} ${d.habits.length === 1 ? "عادة" : "عادات"} نشطة · ${formatNumber(d.habitLogCount)} تسجيل`, action: "" }
        : { text: "", action: "أنشئ أول عادة" };
    case "health":
      return d.healthLogCount + d.moodCount > 0
        ? { text: `${formatNumber(d.healthLogCount + d.moodCount)} ${d.healthLogCount + d.moodCount === 1 ? "قياس" : "قياسات"} صحية`, action: "" }
        : { text: "", action: "سجّل أول قياس" };
    case "journal":
      return d.journalCount > 0
        ? { text: `${formatNumber(d.journalCount)} ${d.journalCount === 1 ? "يومية" : "يوميات"}`, action: "" }
        : { text: "", action: "دوّن أول يومية" };
    case "learning":
      return d.flashcardsDue > 0
        ? { text: `${formatNumber(d.flashcardsDue)} بطاقة مستحقة للمراجعة`, action: "" }
        : d.courses.length > 0
          ? { text: `${formatNumber(d.courses.length)} ${d.courses.length === 1 ? "مقرر" : "مقررات"}`, action: "" }
          : { text: "", action: "أضف أول مقرر" };
    case "goals":
      return d.goals.length > 0
        ? { text: `${formatNumber(d.goals.length)} ${d.goals.length === 1 ? "هدف" : "أهداف"} نشطة`, action: "" }
        : { text: "", action: "أنشئ أول هدف" };
    case "projects":
      return d.projects.length > 0
        ? { text: `${formatNumber(d.projects.length)} ${d.projects.length === 1 ? "مشروع" : "مشاريع"} نشطة`, action: "" }
        : { text: "", action: "ابدأ أول مشروع" };
    case "people":
      return d.people.length > 0
        ? { text: `${formatNumber(d.people.length)} ${d.people.length === 1 ? "شخص" : "أشخاص"}`, action: "" }
        : { text: "", action: "أضف أول شخص" };
    case "home":
      return d.groceryPending > 0
        ? { text: `${formatNumber(d.groceryPending)} بند بقالة معلق`, action: "" }
        : d.recurrings.length + d.homeItemsCount > 0
          ? { text: `${formatNumber(d.recurrings.length + d.homeItemsCount)} التزام وممتلكات`, action: "" }
          : { text: "", action: "أضف أول التزام منزلي" };
    case "notes":
      return d.noteCount > 0
        ? { text: `${formatNumber(d.noteCount)} ${d.noteCount === 1 ? "ملاحظة" : "ملاحظات"} معرفة`, action: "" }
        : { text: "", action: "دوّن أول ملاحظة" };
    case "vault":
      return d.documentsExpiring.length > 0
        ? { text: `${formatNumber(d.documentsExpiring.length)} مستند ${d.documentsExpiring.length === 1 ? "ينتهي" : "تنتهي"} قريباً`, action: "" }
        : d.documentsCount > 0
          ? { text: `${formatNumber(d.documentsCount)} ${d.documentsCount === 1 ? "مستند" : "مستندات"}`, action: "" }
          : { text: "", action: "أضف أول مستند" };
    case "travel":
      return d.trips.length > 0
        ? { text: `${formatNumber(d.trips.length)} ${d.trips.length === 1 ? "رحلة" : "رحلات"}`, action: "" }
        : { text: "", action: "خطط أول رحلة" };
    case "calendar":
      return d.blocksUpcoming > 0
        ? { text: `${arabicCount(d.blocksUpcoming, "حدث واحد", "حدثان", "أحداث", "حدثاً")} هذا الأسبوع`, action: "" }
        : { text: "", action: "مواعيدك في مكان واحد" };
    case "sys":
      return { text: "", action: "اسألني أي شيء" };
    case "wellbeing":
      return d.wellbeingActivities > 0
        ? { text: `${formatNumber(d.wellbeingActivities)} ${d.wellbeingActivities === 1 ? "نشاط" : "أنشطة"} · ${formatNumber(d.wellbeingLogCount)} تسجيل`, action: "" }
        : { text: "", action: "أضف أول نشاط" };
    default:
      return { text: "", action: "" };
  }
}

/* ═══════════════════════ عناصر بصرية ═══════════════════════ */

function tint(color: string, alpha = "22"): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;
}

function SysGlyph({ icon, className }: { icon: string; className?: string }) {
  // v4: أيقونة نظام العافية (heart-hands) ليست في خريطة ui-bits — بديل محلي
  const Comp = icon === "heart-hands" ? HeartHandshake : iconByName(icon);
  return createElement(Comp, { className, "aria-hidden": true });
}

function IconBubble({
  icon,
  color,
  className,
  iconClassName,
  alpha = "22",
}: {
  icon: string;
  color: string;
  className?: string;
  iconClassName?: string;
  /** شفافية الخلفية السداسية عشر — 26 ≈ 15% */
  alpha?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center shrink-0 rounded-2xl", className)}
      style={{ background: tint(color, alpha), color }}
    >
      <SysGlyph icon={icon} className={iconClassName} />
    </div>
  );
}

/* ═══════════════════════ هيكل التحميل ═══════════════════════ */

function SystemsSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
      aria-busy="true"
      aria-label="جارٍ تحميل الأنظمة"
    >
      <div className="h-16 mb-4 space-y-2">
        <Skeleton className="h-7 w-24 rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-60 rounded-md bg-white/[0.06]" />
        <Skeleton className="h-3 w-44 rounded-md bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[214px] rounded-3xl bg-white/[0.05]" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════ بطاقة النظام (وضع العرض) ═══════════════════════ */

function SystemCard({
  sys,
  data,
  delay,
  onOpen,
}: {
  sys: SystemModel;
  data: SystemsData;
  delay: number;
  onOpen: () => void;
}) {
  const live = liveIndicator(sys.key, data);
  const features = SYSTEM_FEATURES[sys.key] ?? [];
  return (
    <motion.div role="listitem" className="h-full" {...widgetEnter(delay)}>
      {/* غلاف تفاعلي: النقر ولوحة المفاتيح معاً — البطاقة كلها زر واحد كبير */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`فتح نظام ${sys.name}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <GlassCard
          className={cn(
            "p-4 h-full flex flex-col text-start cursor-pointer",
            "transition-[transform,translate,scale,border-color] duration-[150ms] ease-out hover:-translate-y-[2px] hover:border-primary/30 active:translate-y-0 active:scale-[0.96]",
            !sys.enabled && "opacity-40 saturate-[0.6]"
          )}
        >
          <div className="flex items-start justify-between gap-1">
            <IconBubble
              icon={sys.icon}
              color={sys.color}
              alpha="26"
              className="w-12 h-12 rounded-3xl"
              iconClassName="w-7 h-7"
            />
            {!sys.enabled && <Chip className="text-coral">معطّل</Chip>}
          </div>
          <div className="mt-2.5 text-[13.5px] font-bold leading-5">{sys.name}</div>
          <p className="mt-1 text-[10.5px] text-muted-foreground leading-4 line-clamp-2 min-h-8 flex-1">
            {sys.description}
          </p>
          {/* المؤشر الحي — نقطة بلون النظام الدلالي داخل كبسولة زجاجية خافتة،
              وشريط تقدم بتدرج الشريط للأنظمة ذات النشاط الفعلي */}
          <div className="mt-2 min-h-[22px] flex items-center">
            <span className="relative inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full glass-soft px-2 pt-0.5 pb-1 text-[10px]">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                style={{ backgroundColor: sys.color }}
                aria-hidden="true"
              />
              {live.text ? (
                <span className="tabular truncate" style={{ color: sys.color }}>
                  {live.text}
                </span>
              ) : (
                <span className="font-medium truncate" style={{ color: sys.color, opacity: 0.85 }}>
                  {live.action}
                </span>
              )}
              {/* V5: عنصر شبيه بالتقدم داخل المؤشر الحي — تعبئة بتدرج الشريط للأنظمة الحية فقط */}
              {live.text && (
                <span
                  className="ribbon absolute inset-x-1 bottom-0 h-[2px] rounded-full opacity-80"
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
          {features.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {features.map((f) => (
                <span
                  key={f}
                  className="text-[9px] leading-[15px] px-1.5 rounded-md ribbon-soft text-white/70"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════ صف التخصيص (وضع التحرير) ═══════════════════════ */

function EditRow({
  sys,
  data,
  isFirst,
  isLast,
  expanded,
  onExpand,
  onMove,
  onToggle,
  onColor,
  onIcon,
}: {
  sys: SystemModel;
  data: SystemsData;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onExpand: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
  onColor: (color: string) => void;
  onIcon: (icon: string) => void;
}) {
  const controls = useDragControls();
  const live = liveIndicator(sys.key, data);
  return (
    <Reorder.Item
      value={sys.id}
      dragListener={false}
      dragControls={controls}
      aria-roledescription="اسحب لإعادة الترتيب"
      aria-label={`نظام ${sys.name}`}
      whileDrag={{ scale: 1.02 }}
      className={cn("glass rounded-2xl p-3 relative select-none", !sys.enabled && "opacity-60 saturate-[0.7]")}
    >
      <div className="flex items-center gap-1.5">
        {/* مقبض السحب — لمس 44px ولا يبدأ التمرير */}
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`اسحب ${sys.name} لإعادة ترتيبه`}
          className="w-11 h-11 -ms-1.5 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* منطقة التوسيع: الاسم والمؤشر الحي */}
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={`تخصيص ${sys.name}: اللون والأيقونة`}
          className="flex-1 min-w-0 h-11 px-1 flex items-center gap-2.5 text-start rounded-xl hover:bg-white/[0.04] transition-[color,background-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
        >
          <IconBubble icon={sys.icon} color={sys.color} className="w-9 h-9 rounded-xl" iconClassName="w-5 h-5" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold leading-4 truncate" style={{ color: sys.color }}>
              {sys.name}
            </span>
            <span className="block mt-0.5 text-[10px] text-muted-foreground truncate">
              {live.text || live.action}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-[250ms] ease-in-out",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        {/* أزرار بديلة لمن لا يحب السحب */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={`تقديم ${sys.name} خطوة`}
            className="w-11 h-8 rounded-lg glass-soft flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-primary transition-[color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={`تأخير ${sys.name} خطوة`}
            className="w-11 h-8 rounded-lg glass-soft flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-primary transition-[color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <Switch
          checked={sys.enabled}
          onCheckedChange={onToggle}
          aria-label={`${sys.enabled ? "تعطيل" : "تفعيل"} نظام ${sys.name}`}
        />
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/[0.07] space-y-3.5">
          <p className="text-[10.5px] text-muted-foreground leading-relaxed">{sys.description}</p>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">لون النظام</p>
            <ColorSwatches value={sys.color} onChange={onColor} />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">الأيقونة</p>
            <IconGrid value={sys.icon} onChange={onIcon} />
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

/* ═══════════════════════ الشاشة ═══════════════════════ */

export function SystemsScreen() {
  const setView = useUIStore((s) => s.setView);
  const goToCalendar = useUIStore((s) => s.goToCalendar);
  const setSysOpen = useUIStore((s) => s.setSysOpen);

  /** وضع التخصيص: سحب وترتيب وتفعيل وألوان وأيقونات */
  const [editMode, setEditMode] = useState(false);
  /** مسودة ترتيب السحب (معرّفات الأنظمة) — تُحفظ عند «تم» */
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  /** الصف الموسّع في وضع التخصيص (اللون والأيقونة) */
  const [expandId, setExpandId] = useState<string | null>(null);

  /* ─── القراءة التفاعلية: الأنظمة + أعداد حية من كل الجداول ─── */
  const data = useLive(async (): Promise<SystemsData> => {
    const [systems, accounts, txs, habits, habitLogs, moods, notes, goals, tasks, debts, recurrings, assets, healthLogs, courses, flashcards, projects, people, documents, trips, listItems, homeItems, blocks, wellbeingActs, wellbeingLogs] =
      await Promise.all([
        db.systems.toArray(),
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.moods.toArray(),
        db.notes.toArray(),
        db.goals.toArray(),
        db.tasks.toArray(),
        db.debts.toArray(),
        db.recurrings.toArray(),
        db.assets.toArray(),
        db.healthLogs.toArray(),
        db.courses.toArray(),
        db.flashcards.toArray(),
        db.projects.toArray(),
        db.people.toArray(),
        db.documents.toArray(),
        db.trips.toArray(),
        db.listItems.toArray(),
        db.homeItems.toArray(),
        db.blocks.toArray(),
        db.wellbeingActivities.toArray(),
        db.wellbeingLogs.toArray(),
      ]);
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    return {
      systems: systems.sort((a, b) => a.order - b.order),
      accounts: accounts.filter((a) => !a.archived).map((a) => a.name),
      txCount: txs.length,
      goalTxCount: txs.filter((t) => t.goalId).length,
      habits: habits.filter((h) => !h.archived).map((h) => h.name),
      habitLogCount: habitLogs.length,
      moodCount: moods.length,
      journalCount: notes.filter((n) => n.type === "journal").length,
      noteCount: notes.filter((n) => n.type === "note").length,
      goals: goals.filter((g) => !g.archived).map((g) => g.name),
      tasks: tasks.length,
      openTasksToday: tasks.filter((t) => !t.done && t.date === today).length,
      openTaskTitles: tasks
        .filter((t) => !t.done)
        .slice(0, 4)
        .map((t) => t.title),
      debts: debts.map((d) => `${d.person} — ${d.name}`),
      recurrings: recurrings.filter((r) => r.active).map((r) => r.name),
      assetsCount: assets.length,
      healthLogCount: healthLogs.length,
      courses: courses.filter((c) => !c.archived).map((c) => c.name),
      flashcardsDue: flashcards.filter((f) => f.nextReview <= today).length,
      projects: projects.filter((p) => p.status === "active").map((p) => p.name),
      people: people.map((p) => p.name),
      documentsCount: documents.length,
      documentsExpiring: documents
        .filter((d) => d.expiryDate && d.expiryDate <= soon)
        .map((d) => d.title),
      trips: trips.map((t) => `${t.name} — ${t.destination}`),
      groceryPending: listItems.filter((i) => i.scope === "grocery" && !i.done).length,
      homeItemsCount: homeItems.length,
      blocksUpcoming: blocks.filter((b) => b.date >= today && b.date <= weekAhead).length,
      // v4 — العافية
      wellbeingActivities: wellbeingActs.filter((a) => !a.archived).length,
      wellbeingLogCount: wellbeingLogs.length,
    };
  }, []);

  /** الأنظمة بترتيب العرض: مسودة السحب أثناء التخصيص، وإلا ترتيب القاعدة */
  const systems = useMemo<SystemModel[]>(() => {
    if (!data) return [];
    const list = [...data.systems].sort((a, b) => a.order - b.order);
    if (orderIds) {
      const rank = new Map(orderIds.map((id, i) => [id, i]));
      list.sort(
        (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return list;
  }, [data, orderIds]);

  if (!data) return <SystemsSkeleton />;

  const enabledSystems = systems.filter((s) => s.enabled);
  const disabledSystems = systems.filter((s) => !s.enabled);
  const liveCount = enabledSystems.filter((s) => liveIndicator(s.key, data).text !== "").length;

  /* ─── الانتقال للشاشة المرتبطة — التقويم وSys بمسارهما الخاص ─── */
  const navigate = (s: SystemModel) => {
    if (s.key === "calendar") {
      goToCalendar();
      return;
    }
    if (s.key === "sys") {
      setSysOpen(true);
      return;
    }
    setView(NAV[s.key] ?? "today");
  };

  /* ─── كتابات التخصيص — مباشرة على db.systems (الاستثناء المسموح) ─── */
  const toggleEnabled = async (s: SystemModel) => {
    await db.systems.update(s.id, { enabled: !s.enabled });
    toast.success(s.enabled ? `أُوقف نظام «${s.name}»` : `فُعّل نظام «${s.name}»`, {
      description: "بياناته كلها محفوظة",
    });
  };

  const setColor = async (s: SystemModel, color: string) => {
    await db.systems.update(s.id, { color });
  };

  const setIcon = async (s: SystemModel, icon: string) => {
    await db.systems.update(s.id, { icon });
  };

  /* ─── وضع التخصيص: مسودة ترتيب محلية تُحفظ مرة واحدة عند «تم» ─── */
  const enterEdit = () => {
    setOrderIds(systems.map((s) => s.id));
    setEditMode(true);
  };

  const moveDraft = (id: string, dir: -1 | 1) => {
    if (!orderIds) return;
    const idx = orderIds.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= orderIds.length) return;
    const next = [...orderIds];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrderIds(next);
  };

  const finishEdit = async () => {
    if (orderIds && data) {
      const original = [...data.systems].sort((a, b) => a.order - b.order).map((s) => s.id);
      const changed =
        original.length !== orderIds.length || original.some((id, i) => id !== orderIds[i]);
      if (changed) {
        const ids = orderIds;
        await db.transaction("rw", db.systems, async () => {
          for (let i = 0; i < ids.length; i++) {
            await db.systems.update(ids[i], { order: i + 1 });
          }
        });
        toast.success("رُتّبت أنظمتك ✓", {
          description: "يظهر ترتيبك الجديد فوراً في كل مكان",
        });
      }
    }
    setEditMode(false);
    setOrderIds(null);
    setExpandId(null);
  };

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">{editMode ? "رتّب أنظمتك" : "الأنظمة"}</h1>
          {editMode ? (
            <p className="mt-1 text-[12px] text-muted-foreground leading-5">
              اسحب من المقبض أو استخدم الأسهم — يُحفظ الترتيب عند الضغط على «تم»
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-[12px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                {/* V5-س: العدد داخل شريحة الشريط الخافتة — بلا تدرج نص */}
                <span className="ribbon-soft rounded-full px-2 py-0.5 font-semibold text-foreground">
                  {arabicCount(systems.length, "نظام واحد", "نظامان", "أنظمة", "نظاماً")}
                </span>
                <span>— كل نظام شاشة كاملة</span>
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground flex items-center flex-wrap gap-1">
                <span className="font-semibold text-foreground/85">
                  {arabicCount(
                    enabledSystems.length,
                    "نظام نشط واحد",
                    "نظامان نشطان",
                    "أنظمة نشطة",
                    "نظاماً نشطاً"
                  )}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[var(--ribbon-cyan)]">
                  {arabicCount(liveCount, "مؤشر حي واحد", "مؤشران حيان", "مؤشرات حية", "مؤشراً حياً")}
                </span>
              </p>
            </>
          )}
        </div>
        {editMode ? (
          <button
            type="button"
            onClick={() => void finishEdit()}
            aria-label="إنهاء وضع التخصيص وحفظ الترتيب"
            className="h-11 px-4 shrink-0 rounded-2xl bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 glow-gold press"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            تم
          </button>
        ) : (
          <button
            type="button"
            onClick={enterEdit}
            aria-label="تخصيص الأنظمة: الترتيب والتفعيل والألوان والأيقونات"
            className="h-11 px-3.5 shrink-0 rounded-2xl glass-soft border border-white/[0.08] text-[12px] font-semibold flex items-center gap-1.5 text-foreground/85 hover:bg-white/[0.07] hover:border-primary/30 transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            تخصيص
          </button>
        )}
      </header>

      {systems.length === 0 ? (
        <GlassCard className="p-4">
          <EmptyState
            title="الأنظمة تنتظر الإعداد الأولي"
            hint="أكمل إعدادك مرة واحدة وستُبذر أنظمتك الخمسة عشر جاهزة للتخصيص الكامل"
            actionLabel="اذهب للإعدادات"
            onAction={() => setView("settings")}
          />
        </GlassCard>
      ) : editMode ? (
        /* ═══ وضع التخصيص: قائمة سحب عمودية ═══ */
        <Reorder.Group
          axis="y"
          values={orderIds ?? []}
          onReorder={setOrderIds}
          aria-label="قائمة الأنظمة — اسحب لإعادة الترتيب"
          className="space-y-2.5"
        >
          {systems.map((s, i) => (
            <EditRow
              key={s.id}
              sys={s}
              data={data}
              isFirst={i === 0}
              isLast={i === systems.length - 1}
              expanded={expandId === s.id}
              onExpand={() => setExpandId(expandId === s.id ? null : s.id)}
              onMove={(dir) => moveDraft(s.id, dir)}
              onToggle={() => void toggleEnabled(s)}
              onColor={(c) => void setColor(s, c)}
              onIcon={(ic) => void setIcon(s, ic)}
            />
          ))}
        </Reorder.Group>
      ) : (
        <>
          {/* ═══ شبكة الأنظمة المفعّلة — عمودان · stagger 20ms (15 بطاقة = 280ms حداً أقصى) ═══ */}
          <div role="list" aria-label="أنظمتك المفعّلة" className="grid grid-cols-2 gap-3">
            {enabledSystems.map((s, i) => (
              <SystemCard
                key={s.id}
                sys={s}
                data={data}
                delay={i * 0.02}
                onOpen={() => navigate(s)}
              />
            ))}
          </div>

          {/* ═══ الموقوفة أسفل الشبكة — بياناتها محفوظة ═══ */}
          {disabledSystems.length > 0 && (
            <section className="mt-6" aria-label="الأنظمة الموقوفة">
              <div className="flex items-center gap-2.5 mb-2.5 px-1">
                <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                  موقوفة مؤقتاً — بياناتها محفوظة
                </span>
                <span className="h-px flex-1 bg-white/[0.07]" aria-hidden="true" />
              </div>
              <div role="list" className="grid grid-cols-2 gap-3">
                {disabledSystems.map((s, i) => (
                  <SystemCard
                    key={s.id}
                    sys={s}
                    data={data}
                    delay={0.08 + i * 0.02}
                    onOpen={() => navigate(s)}
                  />
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground/70 text-center">
                فعّل أي نظام من زر «تخصيص» أعلى الشاشة
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
