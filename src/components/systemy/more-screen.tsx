"use client";

/**
 * شاشة «المزيد» — مركز الوجهات الثانوية مع شارات حية.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  NotebookPen,
  Sparkles,
  Shapes,
  Settings as SettingsIcon,
  CalendarDays,
  Download,
  FileText,
  Gauge,
  Loader2,
  CheckSquare,
  HeartPulse,
  HeartHandshake,
  ShieldCheck,
  GraduationCap,
  Target,
  Kanban,
  Users,
  Home as HomeIcon,
  Lightbulb,
  Shield,
  Plane,
} from "lucide-react";
import { toast } from "sonner";
import { db, getSettings, useLive } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import type { ViewId } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { downloadHTMLReport } from "@/lib/report";
import { GlassCard, widgetEnter } from "./glass";
import { cn } from "@/lib/utils";

interface MoreTile {
  key: string;
  label: string;
  icon: typeof Flame;
  desc: string;
  color: string;
  badge?: number;
  onClick: () => void;
  ariaLabel: string;
  busy?: boolean;
}

export function MoreScreen() {
  const setView = useUIStore((s) => s.setView);
  const goToMoney = useUIStore((s) => s.goToMoney);

  /* مستخلص HTML — تقرير شهري مستقل يُنزَّل بضغطة */
  const [reportBusy, setReportBusy] = useState(false);
  const makeReport = async () => {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      const name = await downloadHTMLReport();
      toast.success("نزّلنا مستخلص الشهر ✓", { description: `${name} — افتحه بأي متصفح أو شاركه` });
    } catch {
      toast.error("تعذّر توليد التقرير");
    } finally {
      setReportBusy(false);
    }
  };

  const data = useLive(async () => {
    const [settings, habits, habitLogs, tasks, notes, healthLogs, courses, flashcards, projects, people, documents, trips, listItems, wellbeingActivities] = await Promise.all([
      getSettings(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.tasks.toArray(),
      db.notes.toArray(),
      db.healthLogs.toArray(),
      db.courses.toArray(),
      db.flashcards.toArray(),
      db.projects.toArray(),
      db.people.toArray(),
      db.documents.toArray(),
      db.trips.toArray(),
      db.listItems.toArray(),
      db.wellbeingActivities.toArray(),
    ]);
    const today = todayISO();
    const soon = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10);
    const pendingHabits = habits.filter((h) => {
      if (h.archived) return false;
      const log = habitLogs.find((l) => l.habitId === h.id && l.date === today);
      return !log || log.count < h.target;
    }).length;
    const openTasks = tasks.filter((t) => !t.done && t.date <= today).length;
    return {
      settings,
      pendingHabits,
      openTasks,
      notesCount: notes.filter((n) => n.type === "note").length,
      habitsCount: habits.filter((h) => !h.archived).length,
      // v3
      openTasksToday: tasks.filter((t) => !t.done && t.date === today).length,
      healthToday: healthLogs.filter((l) => l.date === today).length,
      flashcardsDue: flashcards.filter((f) => f.nextReview <= today).length,
      goalsActive: (await db.goals.filter((g) => !g.archived).count()),
      projectsActive: projects.filter((p) => p.status === "active").length,
      peopleCount: people.length,
      groceryPending: listItems.filter((i) => i.scope === "grocery" && !i.done).length,
      documentsExpiring: documents.filter((d) => d.expiryDate && d.expiryDate <= soon).length,
      tripsUpcoming: trips.filter((t) => t.status !== "done").length,
      coursesCount: courses.filter((c) => !c.archived).length,
      // v4 — العافية
      wellbeingCount: wellbeingActivities.filter((a) => !a.archived).length,
    };
  }, []);

  const tiles: MoreTile[] = [
    { key: "habits", label: "العادات", icon: Flame, desc: "سلاسل، مؤقت، تذكيرات، ربط بالأهداف", badge: data?.pendingHabits, color: "#5CE1E6", onClick: () => setView("habits"), ariaLabel: "افتح شاشة العادات" },
    { key: "journal", label: "الدفتر", icon: NotebookPen, desc: "ملاحظات ويوميات وذكريات", color: "#C4B5FD", onClick: () => setView("journal"), ariaLabel: "افتح شاشة الدفتر" },
    { key: "insights", label: "الرؤى", icon: Sparkles, desc: "درجتك، القصص، الارتباطات، التنبؤ", color: "#F5B95C", onClick: () => setView("insights"), ariaLabel: "افتح شاشة الرؤى" },
    { key: "systems", label: "الأنظمة", icon: Shapes, desc: "أنظمتك الخمسة عشر — رتبها بالسحب وخصصها", color: "#F5D565", onClick: () => setView("systems"), ariaLabel: "افتح شاشة الأنظمة" },
    { key: "budget", label: "الميزانية", icon: Gauge, desc: "متبقي اليوم/الأسبوع/الشهر", color: "#6EE7A8", onClick: () => goToMoney("budget"), ariaLabel: "افتح تبويب الميزانية في شاشة المال" },
    { key: "report", label: "مستخلص HTML", icon: FileText, desc: "تقرير شهري مستقل يفتح بأي متصفح", color: "#FF8E7A", onClick: makeReport, busy: reportBusy, ariaLabel: "تنزيل مستخلص HTML للتقرير الشهري" },
  ];

  const rows: Array<{ id: ViewId; label: string; icon: typeof Flame; desc: string }> = [
    { id: "settings", label: "الإعدادات", icon: SettingsIcon, desc: "ملفك، المظهر، الإشعارات، القفل، بياناتك" },
    { id: "calendar", label: "التقويم", icon: CalendarDays, desc: "أسبوعك وأحداثك في شبكة واحدة" },
    { id: "trust", label: "الثقة والخصوصية", icon: ShieldCheck, desc: "بياناتك على جهازك، تصدير حر، وحذف نهائي" },
  ];

  /* أنظمة v3/v4 — صفوف مضغوطة بشارات حية */
  const systemRows: Array<{ id: ViewId; label: string; icon: typeof Flame; color: string; badge?: number; badgeLabel: string }> = [
    { id: "tasks", label: "المهام والتركيز", icon: CheckSquare, color: "#5CE1E6", badge: data?.openTasksToday, badgeLabel: "مفتوحة اليوم" },
    { id: "health", label: "الصحة والجسم", icon: HeartPulse, color: "#6EE7A8", badge: data?.healthToday, badgeLabel: "قياسات اليوم" },
    { id: "wellbeing", label: "العافية والدوبامين", icon: HeartHandshake, color: "#6EE7A8", badge: data?.wellbeingCount, badgeLabel: "أنشطة" },
    { id: "learning", label: "التعلم والدراسة", icon: GraduationCap, color: "#F5D565", badge: data?.flashcardsDue, badgeLabel: "بطاقات مستحقة" },
    { id: "goals", label: "الأهداف والادخار", icon: Target, color: "#FFB4A2", badge: data?.goalsActive, badgeLabel: "أهداف نشطة" },
    { id: "projects", label: "المشاريع والعمل", icon: Kanban, color: "#8EC5FF", badge: data?.projectsActive, badgeLabel: "مشاريع نشطة" },
    { id: "people", label: "الأشخاص والعلاقات", icon: Users, color: "#F8B4D9", badge: data?.peopleCount, badgeLabel: "أشخاص" },
    { id: "home", label: "المنزل والأسرة", icon: HomeIcon, color: "#F5B95C", badge: data?.groceryPending, badgeLabel: "بنود بقالة" },
    { id: "notes", label: "الملاحظات والمعرفة", icon: Lightbulb, color: "#6EE7A8", badge: data?.notesCount, badgeLabel: "ملاحظات" },
    { id: "vault", label: "المستندات والخزانة", icon: Shield, color: "#5CE1E6", badge: data?.documentsExpiring, badgeLabel: "تنتهي قريباً" },
    { id: "travel", label: "السفر والتجارب", icon: Plane, color: "#C08457", badge: data?.tripsUpcoming, badgeLabel: "رحلات قادمة" },
  ];

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-32">
      {/* بطاقة الملف */}
      <motion.div {...widgetEnter(0)}>
        <GlassCard className="p-5 flex items-center gap-4">
          <span className="w-16 h-16 rounded-3xl glass-soft flex items-center justify-center text-[30px] border border-white/10">
            {data?.settings.avatarEmoji ?? "🌙"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold truncate">{data?.settings.displayName || "ضيف Systemy"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {data?.settings.currency ?? "ر.س"} · {formatCounts(data)}
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* البلاطات */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {tiles.map((t, i) => {
          const Icon = t.busy ? Loader2 : t.icon;
          return (
            <motion.div key={t.key} {...widgetEnter(0.05 + i * 0.05)}>
              <motion.button
                type="button"
                onClick={t.onClick}
                disabled={t.busy}
                aria-label={t.ariaLabel}
                className="glass rounded-3xl relative overflow-hidden p-4 h-full w-full text-start cursor-pointer transition-transform duration-200 hover:scale-[1.015] active:scale-[0.985] disabled:opacity-60 disabled:cursor-default"
              >
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute top-3 end-3 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-[10px] font-bold text-[#1c1204] flex items-center justify-center tabular">
                    {t.badge}
                  </span>
                )}
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-2.5"
                  style={{ background: `${t.color}1f`, border: `1px solid ${t.color}44`, color: t.color }}
                >
                  <Icon className={cn("w-[20px] h-[20px]", t.busy && "animate-spin")} />
                </span>
                <p className="text-[13.5px] font-bold">{t.label}</p>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-1">{t.desc}</p>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* الصفوف */}
      <div className="mt-3 space-y-2.5">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <motion.div key={r.id} {...widgetEnter(0.25 + i * 0.05)}>
              <GlassCard interactive onClick={() => setView(r.id)} className="p-4 flex items-center gap-3.5">
                <span className="w-10 h-10 rounded-2xl glass-soft flex items-center justify-center text-primary shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold">{r.label}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{r.desc}</p>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* بقية أنظمتك — v3 */}
      <motion.div {...widgetEnter(0.18)} className="mt-5 mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold">بقية أنظمتك</p>
        <button
          type="button"
          onClick={() => setView("systems")}
          className="h-9 px-3 rounded-xl glass-soft text-[10.5px] text-primary font-semibold hover:bg-primary/10 transition-colors"
          aria-label="افتح مركز الأنظمة"
        >
          المركز ←
        </button>
      </motion.div>
      <div className="space-y-2.5">
        {systemRows.map((r, i) => {
          const Icon = r.icon;
          const badge = r.badge ?? 0;
          return (
            <motion.div key={r.id} {...widgetEnter(0.2 + i * 0.03)}>
              <GlassCard interactive onClick={() => setView(r.id)} className="p-3.5 flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${r.color}1c`, color: r.color }}
                >
                  <Icon className="w-[16px] h-[16px]" aria-hidden />
                </span>
                <p className="text-[12.5px] font-semibold flex-1 min-w-0 truncate">{r.label}</p>
                {badge > 0 ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular">
                    <span className="font-bold" style={{ color: r.color }}>{badge}</span> {r.badgeLabel}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground/50">افتح ←</span>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <motion.p {...widgetEnter(0.5)} className="mt-6 text-center text-[10px] text-muted-foreground/60">
        Systemy v5.0 · نظام تشغيلك الشخصي · 16 نظاماً مترابطاً · بياناتك على جهازك دائماً
      </motion.p>
    </div>
  );
}

function formatCounts(data: { habitsCount: number; notesCount: number; openTasks: number } | null): string {
  if (!data) return "…";
  const parts: string[] = [];
  if (data.habitsCount > 0) parts.push(`${data.habitsCount} عادة`);
  if (data.notesCount > 0) parts.push(`${data.notesCount} ملاحظة`);
  if (data.openTasks > 0) parts.push(`${data.openTasks} مهمة مفتوحة`);
  return parts.length > 0 ? parts.join(" · ") : "ابدأ بإضافة أول شيء";
}

export { cn, Download };
