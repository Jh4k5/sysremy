"use client";

/**
 * Systemy v3 — تفاصيل المشروع (درج سفلي غني)
 * مهام المشروع (checkbox + إضافة مهمة مرتبطة) · وقت المشروع (جلسات blocks
 * ومدتها + القيمة القابلة للفوترة + تسجيل جلسة عمل سريعة) · المال المرتبط
 * (دخل/مصروف + آخر 4 معاملات + إضافة سريعة) · تعديل الحالة والبيانات
 * وحذف بتأكيد يوضح أن السجلات تبقى بلا ربط. كتابة عبر actions فقط.
 */

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckSquare,
  ChevronLeft,
  PiggyBank,
  Play,
  Plus,
  Timer,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  addBlock,
  addTask,
  deleteProject,
  toggleTask,
  updateProject,
} from "@/lib/actions";
import {
  diffDays,
  formatDate,
  formatDurationAr,
  formatMoney,
  formatNumber,
  hhmmToMinutes,
  minutesToHHMM,
  nowHHMM,
  todayISO,
} from "@/lib/format";
import type { Project, ProjectStatus, Task, TimeBlock, Transaction } from "@/lib/types";
import { Chip, PrivateAmount } from "@/components/systemy/glass";
import { ConfirmBar, iconByName, inputCls } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ومساعدات ═══════════════════════ */

const STATUS_META: Record<ProjectStatus, { label: string; chipCls: string; btnCls: string }> = {
  active: {
    label: "نشط",
    chipCls: "border-mint/30 text-mint",
    btnCls: "border-mint/50 bg-mint/15 text-mint",
  },
  paused: {
    label: "متوقف",
    chipCls: "border-gold/30 text-gold",
    btnCls: "border-gold/50 bg-gold/15 text-gold",
  },
  done: {
    label: "منجز",
    chipCls: "border-primary/30 text-primary",
    btnCls: "border-primary/50 bg-primary/15 text-primary",
  },
};

const STATUS_OPTIONS: Array<{ k: ProjectStatus; label: string }> = [
  { k: "active", label: "نشط" },
  { k: "paused", label: "متوقف" },
  { k: "done", label: "منجز" },
];

const PRIORITY_OPTIONS: Array<{ k: Task["priority"]; label: string }> = [
  { k: "low", label: "منخفضة" },
  { k: "normal", label: "عادية" },
  { k: "high", label: "عالية" },
];

/** لون hex + شفافية سداسية */
const tint = (color: string, alpha = "22"): string =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;

/** عنوان قسم موحد داخل الدرج */
function SectionTitle({ icon, children, badge }: { icon: React.ReactNode; children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground/90">
        {icon}
        <span>{children}</span>
      </div>
      {badge && <Chip className="text-muted-foreground tabular">{badge}</Chip>}
    </div>
  );
}

export interface ProjectDetailsDialogProps {
  /** المشروع الحي (من useLive في الأب) — null يغلق الدرج */
  project: Project | null;
  onClose: () => void;
  onEdit: (project: Project) => void;
  tasks: Task[];
  blocks: TimeBlock[];
  txs: Transaction[];
  currency: string;
}

export function ProjectDetailsDialog({
  project,
  onClose,
  onEdit,
  tasks,
  blocks,
  txs,
  currency,
}: ProjectDetailsDialogProps) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  const [newTask, setNewTask] = useState("");
  const [taskDate, setTaskDate] = useState(todayISO());
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تصفير الحركات المحلية عند تغيير المشروع
  useEffect(() => {
    if (!project) return;
    setNewTask("");
    setTaskDate(todayISO());
    setPriority("normal");
    setConfirmDelete(false);
  }, [project?.id]);

  if (!project) return null;

  const cur = currency;
  const today = todayISO();

  /* ---------- مشتقات المهام ---------- */
  const allTasks = tasks.filter((t) => t.projectId === project.id);
  const doneCount = allTasks.filter((t) => t.done).length;
  const lastTasks = [...allTasks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const taskPct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

  /* ---------- مشتقات الوقت ---------- */
  const projectBlocks = blocks.filter((b) => b.projectId === project.id);
  const totalMinutes = projectBlocks.reduce((sum, b) => {
    const mins = hhmmToMinutes(b.endTime) - hhmmToMinutes(b.startTime);
    return sum + Math.max(0, mins);
  }, 0);
  const totalHours = totalMinutes / 60;
  const billable =
    project.ratePerHour != null && project.ratePerHour > 0 && totalMinutes > 0
      ? Math.round(totalHours * project.ratePerHour * 100) / 100
      : null;

  /* ---------- مشتقات المال ---------- */
  const projectTxs = txs.filter((t) => t.projectId === project.id);
  const incomeSum = projectTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseSum = projectTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const lastTxs = [...projectTxs]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const deadlineLate = project.deadline ? diffDays(today, project.deadline) < 0 && project.status !== "done" : false;

  /* ---------- الحركات ---------- */

  const setStatus = async (status: ProjectStatus) => {
    if (status === project.status || busy) return;
    setBusy(true);
    try {
      await updateProject(project.id, { status });
    } finally {
      setBusy(false);
    }
  };

  const addLinkedTask = async () => {
    const title = newTask.trim();
    if (!title) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    setBusy(true);
    try {
      await addTask({
        title,
        date: taskDate || today,
        priority,
        done: false,
        projectId: project.id,
      });
      setNewTask("");
      setTaskDate(today);
      setPriority("normal");
    } finally {
      setBusy(false);
    }
  };

  const logSession = async () => {
    setBusy(true);
    try {
      const start = nowHHMM();
      const end = minutesToHHMM(hhmmToMinutes(start) + 60);
      await addBlock({
        title: `جلسة عمل — ${project.name}`,
        type: "work",
        date: today,
        startTime: start,
        endTime: end,
        color: project.color,
        icon: project.icon,
        projectId: project.id,
      });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteProject(project.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  /* ---------- الهيكل ---------- */

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-black/[0.08] bg-white/95 backdrop-blur-xl shadow-[0_-12px_40px_-16px_rgba(23,33,43,0.3)]"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5 text-right text-[15px] font-bold">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: tint(project.color), color: project.color }}
              aria-hidden="true"
            >
              {[project.icon.toLowerCase()].map((n) => {
                const I = iconByName(n);
                return <I key={n} className="h-5 w-5" aria-hidden="true" />;
              })}
            </span>
            <span className="truncate">{project.name}</span>
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px] tabular">
            {allTasks.length > 0
              ? `${formatNumber(doneCount)} من ${formatNumber(allTasks.length)} مهام منجزة · ${formatNumber(projectBlocks.length)} جلسة عمل`
              : "لا مهام بعد — أضف أول خطوة"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[74vh] space-y-5 overflow-y-auto px-4 pb-6 pt-2">
          {/* ═══ الوصف والتقدم والموعد ═══ */}
          <div className="space-y-2.5">
            {project.description && (
              <p className="rounded-xl glass-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-foreground/80">
                {project.description}
              </p>
            )}
            {allTasks.length > 0 && (
              <>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-black/[0.04]"
                  role="progressbar"
                  aria-valuenow={taskPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`تقدم مهام المشروع: ${taskPct}%`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${taskPct}%`, background: project.color }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className="tabular text-foreground/85">
                    {formatNumber(doneCount)}/{formatNumber(allTasks.length)} مهام · {formatNumber(taskPct)}%
                  </Chip>
                  {project.deadline && (
                    <Chip
                      className={cn(
                        "border tabular",
                        deadlineLate ? "border-coral/40 text-coral" : "border-black/[0.08] text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      {deadlineLate ? "فات الموعد" : "الموعد"} {formatDate(project.deadline)}
                    </Chip>
                  )}
                </div>
              </>
            )}
            {allTasks.length === 0 && project.deadline && (
              <Chip
                className={cn(
                  "border tabular",
                  deadlineLate ? "border-coral/40 text-coral" : "border-black/[0.08] text-muted-foreground",
                )}
              >
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {deadlineLate ? "فات الموعد" : "الموعد"} {formatDate(project.deadline)}
              </Chip>
            )}
          </div>

          {/* ═══ الحالة ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<TrendingUp className="h-4 w-4 text-mint" aria-hidden="true" />}>
              حالة المشروع
            </SectionTitle>
            <div className="flex gap-2" role="radiogroup" aria-label="حالة المشروع">
              {STATUS_OPTIONS.map((o) => {
                const active = project.status === o.k;
                return (
                  <button
                    key={o.k}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`الحالة: ${o.label}`}
                    onClick={() => void setStatus(o.k)}
                    disabled={busy}
                    className={cn(
                      "h-11 min-h-11 flex-1 rounded-xl border text-[12.5px] font-bold transition-colors disabled:opacity-50",
                      active
                        ? STATUS_META[o.k].btnCls
                        : "glass-soft border-black/[0.07] text-foreground/70 hover:bg-black/[0.04]",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ مهام المشروع ═══ */}
          <div className="space-y-3">
            <SectionTitle
              icon={<CheckSquare className="h-4 w-4 text-mint" aria-hidden="true" />}
              badge={`${formatNumber(doneCount)}/${formatNumber(allTasks.length)}`}
            >
              مهام المشروع
            </SectionTitle>
            <div className="glass-soft space-y-2 rounded-2xl p-3.5">
              {lastTasks.length === 0 ? (
                <p className="py-1 text-center text-[11px] text-muted-foreground">
                  لا مهام بعد — آخر 6 ستظهر هنا مع الإضافة
                </p>
              ) : (
                <ul className="sys-scroll max-h-56 space-y-1 overflow-y-auto">
                  {lastTasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void toggleTask(t.id)}
                        aria-pressed={t.done}
                        aria-label={`مهمة ${t.title}${t.done ? " — منجزة" : " — لإتمامها"}`}
                        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start transition-colors hover:bg-black/[0.03]"
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            t.done ? "border-mint bg-mint/20 text-mint" : "border-white/25 text-transparent",
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate text-[12.5px]",
                            t.done ? "text-muted-foreground line-through" : "text-foreground/90",
                          )}
                        >
                          {t.title}
                        </span>
                        {t.priority === "high" && !t.done && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-label="أولوية عالية" />
                        )}
                        <span className="shrink-0 text-[9.5px] text-muted-foreground tabular">{formatDate(t.date)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* إضافة مهمة مرتبطة */}
              <div className="space-y-2.5 border-t border-black/[0.05] pt-2.5">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addLinkedTask();
                  }}
                  placeholder="مهمة جديدة للمشروع…"
                  maxLength={60}
                  aria-label="عنوان مهمة جديدة مرتبطة بالمشروع"
                  className={inputCls}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className={cn(inputCls, "h-11 flex-1 [color-scheme:dark] tabular")}
                    aria-label="تاريخ المهمة"
                  />
                  <div className="flex gap-1.5" role="radiogroup" aria-label="أولوية المهمة">
                    {PRIORITY_OPTIONS.map((p) => {
                      const active = priority === p.k;
                      return (
                        <button
                          key={p.k}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={`الأولوية ${p.label}`}
                          onClick={() => setPriority(p.k)}
                          className={cn(
                            "h-11 min-h-11 rounded-xl border px-3 text-[11px] font-bold transition-colors",
                            active
                              ? "border-primary/60 bg-primary/20 text-primary"
                              : "glass-soft border-black/[0.07] text-foreground/70 hover:bg-black/[0.04]",
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void addLinkedTask()}
                  disabled={busy}
                  className="flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                  aria-label="إضافة المهمة للمشروع"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                  أضف المهمة للمشروع
                </button>
              </div>
            </div>
          </div>

          {/* ═══ وقت المشروع ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<Timer className="h-4 w-4 text-gold" aria-hidden="true" />} badge={`${formatNumber(projectBlocks.length)} جلسة`}>
              وقت المشروع
            </SectionTitle>
            <div className="glass-soft space-y-3 rounded-2xl p-3.5">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-1 py-2.5">
                  <p className="text-[9.5px] text-muted-foreground">عدد الجلسات</p>
                  <p className="text-[15px] font-bold tabular">{formatNumber(projectBlocks.length)}</p>
                </div>
                <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-1 py-2.5">
                  <p className="text-[9.5px] text-muted-foreground">المدة الكلية</p>
                  <p className="text-[13px] font-bold tabular">{formatDurationAr(totalMinutes)}</p>
                </div>
              </div>
              {billable != null && (
                <p className="rounded-xl border border-gold/25 bg-gold/10 px-3 py-2.5 text-[12px] font-medium text-gold tabular">
                  القيمة القابلة للفوترة ≈{" "}
                  <PrivateAmount className="font-bold">{formatMoney(billable, cur)}</PrivateAmount>
                  <span className="font-normal text-gold/70"> ({formatNumber(Math.round(totalHours * 10) / 10)} ساعة × {formatMoney(project.ratePerHour ?? 0, cur)})</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => void logSession()}
                disabled={busy}
                className="flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 text-[12.5px] font-bold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
                aria-label="تسجيل جلسة عمل من الآن لمدة ساعة"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                سجّل جلسة عمل (ساعة من الآن)
              </button>
              <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                جلسة عمل تُسجَّل في التقويم من الآن لساعة — مرتبطة بالمشروع.
              </p>
            </div>
          </div>

          {/* ═══ المال المرتبط ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<Wallet className="h-4 w-4 text-primary" aria-hidden="true" />} badge={`${formatNumber(projectTxs.length)} معاملة`}>
              المال المرتبط
            </SectionTitle>
            <div className="glass-soft space-y-3 rounded-2xl p-3.5">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-mint/20 bg-mint/10 px-1 py-2.5">
                  <p className="flex items-center justify-center gap-1 text-[9.5px] text-mint/80">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" /> دخل المشروع
                  </p>
                  <PrivateAmount className="block text-[14px] font-bold tabular text-mint">
                    {formatMoney(incomeSum, cur)}
                  </PrivateAmount>
                </div>
                <div className="rounded-xl border border-coral/20 bg-coral/10 px-1 py-2.5">
                  <p className="flex items-center justify-center gap-1 text-[9.5px] text-coral/80">
                    <TrendingDown className="h-3 w-3" aria-hidden="true" /> مصروف المشروع
                  </p>
                  <PrivateAmount className="block text-[14px] font-bold tabular text-coral">
                    {formatMoney(expenseSum, cur)}
                  </PrivateAmount>
                </div>
              </div>

              {lastTxs.length > 0 && (
                <ul className="space-y-1 border-t border-black/[0.05] pt-2">
                  {lastTxs.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          t.type === "income" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral",
                        )}
                        aria-hidden="true"
                      >
                        {t.type === "income" ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="flex-1 truncate text-[12px] text-foreground/85">{t.description}</span>
                      <PrivateAmount
                        className={cn(
                          "shrink-0 text-[12px] font-bold tabular",
                          t.type === "income" ? "text-mint" : "text-coral",
                        )}
                      >
                        {t.type === "income" ? "+" : "−"}
                        {formatMoney(t.amount, cur)}
                      </PrivateAmount>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openQuickAdd("income");
                  }}
                  className="h-11 min-h-11 flex-1 rounded-xl border border-mint/40 bg-mint/10 text-[12px] font-bold text-mint transition-colors hover:bg-mint/20"
                  aria-label="تسجيل دخل مشروع سريع"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <PiggyBank className="h-4 w-4" aria-hidden="true" />
                    دخل مشروع
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openQuickAdd("expense");
                  }}
                  className="h-11 min-h-11 flex-1 rounded-xl border border-coral/40 bg-coral/10 text-[12px] font-bold text-coral transition-colors hover:bg-coral/20"
                  aria-label="تسجيل مصروف مشروع سريع"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                    مصروف مشروع
                  </span>
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                إضافة سريعة هنا — الربط التفصيلي للمعاملة بالمشروع يُدار من تبويب المعاملات في المال.
              </p>
            </div>
          </div>

          {/* ═══ تعديل / حذف ═══ */}
          <div className="space-y-2 border-t border-black/[0.05] pt-3">
            {!confirmDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(project)}
                  className="h-11 min-h-11 flex-1 rounded-xl glass-soft border border-black/[0.07] text-[12.5px] font-bold text-foreground/80 transition-colors hover:bg-black/[0.04]"
                  aria-label={`تعديل المشروع ${project.name}`}
                >
                  تعديل البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF8E7A]/30 text-[#FF8E7A] transition-colors hover:bg-[#FF8E7A]/10 disabled:opacity-50"
                  aria-label={`حذف المشروع ${project.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <ConfirmBar
                message={`حذف «${project.name}» نهائياً؟ مهامه وجلساته ومعاملاته تبقى في سجلاتها — بلا ربط به.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
            <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[9.5px] text-muted-foreground/70">
              <ChevronLeft className="h-3 w-3" aria-hidden="true" />
              كل حركة هنا تنعكس فوراً في المهام والتقويم والمال عبر الترابط الحي
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
