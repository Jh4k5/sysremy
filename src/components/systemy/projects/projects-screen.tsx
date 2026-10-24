"use client";

/**
 * Systemy v3 — شاشة «المشاريع والعمل» (المدير الكامل)
 * بطل: مشاريع نشطة + مهام مفتوحة مرتبطة + دخل المشاريع هذا الشهر.
 * فلاتر chips (نشطة/متوقفة/منجزة/الكل) وبطاقة لكل مشروع بتقدم المهام
 * والموعد (أحمر إن فات) → لمسة تفتح تفاصيل غنية: مهام وجلسات وقت
 * وفوترة ومال مرتبط وحالة وتعديل وحذف.
 * قراءة useLive حصراً — كتابة عبر actions فقط. محلي بالكامل بلا fetch.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Briefcase, CalendarDays, CheckSquare, ChevronLeft, Plus } from "lucide-react";
import { db, getSettings, useLive } from "@/lib/db";
import {
  diffDays,
  financeMonthEnd,
  financeMonthStart,
  formatDate,
  formatMoney,
  formatNumber,
  todayISO,
} from "@/lib/format";
import type { Project, ProjectStatus, Task } from "@/lib/types";
import { Chip, GlassCard, PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { EmptyState, iconByName } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectDetailsDialog } from "./project-details-dialog";

/* ═══════════════════════ ثوابت ═══════════════════════ */

const STATUS_META: Record<ProjectStatus, { label: string; chipCls: string }> = {
  active: { label: "نشط", chipCls: "border-mint/30 text-mint" },
  paused: { label: "متوقف", chipCls: "border-gold/30 text-gold" },
  done: { label: "منجز", chipCls: "border-primary/30 text-primary" },
};

const FILTER_OPTIONS: Array<{ k: ProjectStatus | "all"; label: string }> = [
  { k: "active", label: "النشطة" },
  { k: "paused", label: "المتوقفة" },
  { k: "done", label: "المنجزة" },
  { k: "all", label: "الكل" },
];

/** لون hex + شفافية سداسية */
const tint = (color: string, alpha = "22"): string =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;

/** أيقونة مشروع بالاسم — تُبنى داخل إغلاق خريطة (نمط ثابت آمن لقواعد الخطافات) */
function ProjectGlyph({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      {[name.toLowerCase()].map((n) => {
        const I = iconByName(n);
        return <I key={n} className={className} style={style} aria-hidden="true" />;
      })}
    </>
  );
}

/* ═══════════════════════ الشاشة ═══════════════════════ */

export function ProjectsScreen() {
  const settings = useLive(() => getSettings(), []);
  const projects = useLive(() => db.projects.toArray(), []);
  const tasks = useLive(() => db.tasks.toArray(), []);
  const blocks = useLive(() => db.blocks.toArray(), []);
  const txs = useLive(() => db.transactions.toArray(), []);

  const [filter, setFilter] = useState<ProjectStatus | "all">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [formProject, setFormProject] = useState<Project | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const today = todayISO();
  const cur = settings?.currency ?? "ر.س";
  const monthStartDay = settings?.monthStartDay ?? 1;

  /* ---------- مشتقات البطل ---------- */
  const activeCount = (projects ?? []).filter((p) => p.status === "active").length;

  const openTaskCount = useMemo(
    () => (tasks ?? []).filter((t) => t.projectId && !t.done).length,
    [tasks],
  );

  /** دخل المشاريع هذا الشهر المالي (transactions projectId + income + ضمن الشهر) */
  const monthIncome = useMemo(() => {
    const start = financeMonthStart(today, monthStartDay);
    const end = financeMonthEnd(today, monthStartDay);
    return (txs ?? [])
      .filter((t) => {
        if (!t.projectId || t.type !== "income") return false;
        const d = t.date.slice(0, 10);
        return d >= start && d <= end;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [txs, today, monthStartDay]);

  /* ---------- القائمة والفلاتر ---------- */
  const visible = useMemo(() => {
    const list = projects ?? [];
    const filtered = filter === "all" ? list : list.filter((p) => p.status === filter);
    return [...filtered].sort((a, b) => {
      // النشط أولاً ثم حسب الأحدث إنشاءً
      const rank = (p: Project) => (p.status === "active" ? 0 : p.status === "paused" ? 1 : 2);
      return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [projects, filter]);

  const detailsProject = detailsId ? (projects ?? []).find((p) => p.id === detailsId) ?? null : null;

  const openForm = (p: Project | null) => {
    setFormProject(p);
    setFormOpen(true);
  };

  /* ---------- تحميل ---------- */
  if (!projects || !settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل المشاريع"
      >
        <header className="mb-4">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="mt-2 h-3.5 w-56 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="glass-soft mb-3 h-24 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-11 animate-pulse rounded-full" />
        <div className="glass-soft mb-3 h-32 animate-pulse rounded-3xl" />
        <div className="glass-soft h-32 animate-pulse rounded-3xl" />
      </div>
    );
  }

  /* ---------- الهيكل ---------- */
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-4 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">المشاريع والعمل</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            مشاريع بمهام ووقت ودخل مرتبط — كل شيء مترابط
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => openForm(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          aria-label="إضافة مشروع جديد"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        </motion.button>
      </motion.header>

      {/* ═══ بداية نظيفة ═══ */}
      {projects.length === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="مشروعك الأول — عمل حر أو هدف شخصي"
              hint="مشروع بمهام وجلسات وقت وموعد: طوّر متجرك، اكتب كتابك، أو اعمل عملاً حراً بسعر ساعة — الوقت يتحول إلى فوترة"
              actionLabel="أنشئ المشروع الأول"
              onAction={() => openForm(null)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ البطل ═══ */}
      {projects.length > 0 && (
        <motion.div {...widgetEnter(0.05)} className="mb-3">
          <GlassCard className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] text-muted-foreground">دخل المشاريع هذا الشهر</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground/70 tabular">
                  من {formatNumber(projects.length)} مشروع مسجل
                </p>
              </div>
              <PrivateAmount className="num-display shrink-0 text-[24px] tabular text-mint">
                {formatMoney(monthIncome, cur)}
              </PrivateAmount>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <Chip className="tabular text-foreground/85">
                <Briefcase className="h-3 w-3 text-mint" aria-hidden="true" />
                {formatNumber(activeCount)} مشروع نشط
              </Chip>
              <Chip className="tabular text-foreground/85">
                <CheckSquare className="h-3 w-3 text-gold" aria-hidden="true" />
                {formatNumber(openTaskCount)} مهمة مفتوحة
              </Chip>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ الفلاتر ═══ */}
      {projects.length > 0 && (
        <motion.div {...widgetEnter(0.08)} className="mb-3">
          <div className="flex gap-2" role="radiogroup" aria-label="فلترة المشاريع بالحالة">
            {FILTER_OPTIONS.map((o) => {
              const active = filter === o.k;
              const count =
                o.k === "all"
                  ? projects.length
                  : projects.filter((p) => p.status === o.k).length;
              return (
                <button
                  key={o.k}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`فلتر: ${o.label}`}
                  onClick={() => setFilter(o.k)}
                  className={cn(
                    "h-11 min-h-11 flex-1 rounded-2xl border text-[12px] font-bold transition-colors",
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "glass-soft border-white/[0.08] text-foreground/70 hover:bg-white/[0.06]",
                  )}
                >
                  <span className="tabular">
                    {o.label} <span className="text-[9.5px] opacity-70">({formatNumber(count)})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ قائمة المشاريع ═══ */}
      {projects.length > 0 && visible.length === 0 && (
        <motion.div {...widgetEnter(0.1)}>
          <GlassCard className="p-2">
            <EmptyState
              compact
              icon={<Briefcase className="h-6 w-6" />}
              title={`لا مشاريع ${FILTER_OPTIONS.find((o) => o.k === filter)?.label ?? ""}`}
              hint="بدّل الفلتر أو أنشئ مشروعاً جديداً"
              actionLabel="مشروع جديد"
              onAction={() => openForm(null)}
            />
          </GlassCard>
        </motion.div>
      )}

      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((p, idx) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasks={tasks ?? []}
              currency={cur}
              today={today}
              delay={0.1 + idx * 0.04}
              onOpen={() => setDetailsId(p.id)}
            />
          ))}
        </div>
      )}

      {/* ═══ الحوارات ═══ */}
      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={formProject}
        currency={cur}
      />
      {detailsProject && (
        <ProjectDetailsDialog
          project={detailsProject}
          onClose={() => setDetailsId(null)}
          onEdit={(p) => {
            setDetailsId(null);
            openForm(p);
          }}
          tasks={tasks ?? []}
          blocks={blocks ?? []}
          txs={txs ?? []}
          currency={cur}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ بطاقة مشروع ═══════════════════════ */

function ProjectCard({
  project,
  tasks,
  currency,
  today,
  delay,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  currency: string;
  today: string;
  delay: number;
  onOpen: () => void;
}) {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneCount = projectTasks.filter((t) => t.done).length;
  const pct = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;
  const hasTasks = projectTasks.length > 0;
  const days = project.deadline ? diffDays(today, project.deadline) : null;
  const late = days != null && days < 0 && project.status !== "done";
  const status = STATUS_META[project.status];

  return (
    <motion.div {...widgetEnter(delay)}>
      <GlassCard
        interactive
        onClick={onOpen}
        className={cn("p-4", project.status === "done" && "border-mint/25")}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: tint(project.color), color: project.color }}
            aria-hidden="true"
          >
            <ProjectGlyph name={project.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("truncate text-[14px] font-semibold", project.status === "done" && "line-through decoration-white/30")}>
                {project.name}
              </span>
              <Chip className={cn("shrink-0 border", status.chipCls)}>{status.label}</Chip>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground tabular">
              {hasTasks
                ? `${formatNumber(doneCount)}/${formatNumber(projectTasks.length)} مهام · ${formatNumber(pct)}%`
                : "لا مهام بعد"}
              {project.ratePerHour != null && project.ratePerHour > 0 && ` · ${formatMoney(project.ratePerHour, currency)}/ساعة`}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
            <ChevronLeft className="h-5 w-5" />
          </span>
        </div>

        {hasTasks && (
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`تقدم مهام «${project.name}»: ${pct}%`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: project.color }}
            />
          </div>
        )}

        {project.deadline && (
          <div className="mt-2 flex items-center gap-2">
            <Chip
              className={cn(
                "border tabular",
                late ? "border-coral/40 text-coral" : "border-white/[0.1] text-muted-foreground",
              )}
            >
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {late ? "فات الموعد" : "الموعد"} {formatDate(project.deadline)}
            </Chip>
            {days != null && (
              <span className="text-[10.5px] text-muted-foreground tabular">
                {days === 0
                  ? "اليوم"
                  : days > 0
                    ? `بعد ${formatNumber(days)} يوماً`
                    : `فات ${formatNumber(-days)} يوماً`}
              </span>
            )}
          </div>
        )}

        {project.description && !project.deadline && (
          <p className="mt-2 truncate text-[10.5px] text-muted-foreground/80">{project.description}</p>
        )}
      </GlassCard>
    </motion.div>
  );
}
