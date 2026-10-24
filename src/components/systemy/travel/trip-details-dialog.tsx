"use client";

/**
 * Systemy v3 — حوار تفاصيل الرحلة (واسع وقابل للتمرير)
 * قائمة التجهيز + البرنامج (blocks) + المصاريف المرتبطة + مهام الرحلة
 * + تغيير الحالة وتعديل البيانات والحذف بتأكيد صريح النتائج.
 * كل الكتابة عبر actions الجاهزة — القراءة تمر من الشاشة (useLive).
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  Clock,
  Luggage,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Receipt,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addBlock,
  addListItem,
  addTask,
  clearDoneItems,
  deleteListItem,
  deleteTrip,
  toggleListItem,
  toggleTask,
  updateTrip,
} from "@/lib/actions";
import type { ListItem, Task, TimeBlock, Transaction, Trip, TripStatus } from "@/lib/types";
import {
  dayNameShort,
  diffDays,
  formatDate,
  formatMoney,
  formatNumber,
  formatTimeAr,
  todayISO,
} from "@/lib/format";
import { Chip, GlassCard, PrivateAmount, SectionHeader } from "@/components/systemy/glass";
import { ConfirmBar, EmptyState, Field, inputCls } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

/* ═══ حالة الرحلة — تُشارك مع الشاشة ═══ */
export const TRIP_STATUS_META: Record<TripStatus, { label: string; chipCls: string }> = {
  planned: { label: "مخططة", chipCls: "border-gold/25 bg-gold/10 text-gold" },
  active: { label: "جارية", chipCls: "border-mint/25 bg-mint/10 text-mint" },
  done: { label: "منتهية", chipCls: "border-white/[0.08] bg-white/[0.04] text-muted-foreground" },
};

export function TripStatusChip({ status, className }: { status: TripStatus; className?: string }) {
  const meta = TRIP_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold",
        meta.chipCls,
        className
      )}
    >
      {status === "active" && <Plane className="h-3 w-3" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

/* ═══ صف قابل للتأشير (تجهيز / مهمة) ═══ */
function CheckRow({
  done,
  label,
  meta,
  onToggle,
  onDelete,
  toggleAria,
  deleteAria,
}: {
  done: boolean;
  label: string;
  meta?: string;
  onToggle: () => void;
  onDelete?: () => void;
  toggleAria: string;
  deleteAria?: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-1 rounded-xl glass-soft px-2 py-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={toggleAria}
        onClick={onToggle}
        className="flex h-11 w-10 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all duration-200",
            done ? "border-mint bg-mint/20 text-mint" : "border-white/20 text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </button>
      <span className={cn("min-w-0 flex-1 text-[12.5px]", done && "text-muted-foreground line-through")}>
        {label}
      </span>
      {meta && <span className="shrink-0 text-[10px] text-muted-foreground/80">{meta}</span>}
      {onDelete && deleteAria && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteAria}
          className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-white/[0.05] hover:text-coral"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ═══ الحوار ═══ */
export interface TripDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  /** بنود التجهيز — scope "trip" وownerId الرحلة */
  items: ListItem[];
  /** أحداث البرنامج المرتبطة بالرحلة */
  blocks: TimeBlock[];
  /** مصاريف الرحلة (expense فقط) — الأحدث أولاً */
  expenses: Transaction[];
  /** مهام الرحلة المرتبطة */
  tasks: Task[];
  currency: string;
  /** فتح نموذج تعديل بيانات الرحلة */
  onEdit: (trip: Trip) => void;
}

export function TripDetailsDialog({
  open,
  onOpenChange,
  trip,
  items,
  blocks,
  expenses,
  tasks,
  currency,
  onEdit,
}: TripDetailsDialogProps) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  const [newItemText, setNewItemText] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockDate, setBlockDate] = useState("");
  const [blockFrom, setBlockFrom] = useState("09:00");
  const [blockTo, setBlockTo] = useState("10:00");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = todayISO();

  // تصفير الحالات الداخلية عند الفتح أو تبديل الرحلة
  useEffect(() => {
    if (!open) return;
    setNewItemText("");
    setNewTaskTitle("");
    setBlockFormOpen(false);
    setBlockTitle("");
    setConfirmDelete(false);
    setBusy(false);
  }, [open, trip?.id]);

  /* ─── مشتقات ─── */
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt)
      ),
    [items]
  );
  const doneCount = items.filter((i) => i.done).length;

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [blocks]
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
      ),
    [tasks]
  );
  const tasksDone = tasks.filter((t) => t.done).length;

  const spent = expenses.reduce((a, t) => a + t.amount, 0);
  const budget = trip?.budget ?? 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0;
  const over = budget > 0 && spent > budget;

  const lastExpenses = expenses.slice(0, 5);
  const daysCount = trip ? diffDays(trip.startDate, trip.endDate) + 1 : 0;
  const datesLabel =
    trip?.startDate === trip?.endDate
      ? formatDate(trip?.startDate ?? today)
      : trip
        ? `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`
        : "";

  /* ─── إجراءات ─── */
  const addItem = async () => {
    if (!trip) return;
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText("");
    await addListItem("trip", text, { ownerId: trip.id });
  };

  const addTaskLinked = async () => {
    if (!trip) return;
    const title = newTaskTitle.trim();
    if (!title) return;
    const date = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;
    setNewTaskTitle("");
    await addTask({ title, date, priority: "normal", done: false, tripId: trip.id });
  };

  const openBlockForm = () => {
    if (!trip) return;
    setBlockDate(today >= trip.startDate && today <= trip.endDate ? today : trip.startDate);
    setBlockFormOpen(true);
  };

  const addItineraryEvent = async () => {
    if (!trip) return;
    const title = blockTitle.trim();
    if (!title) {
      toast.error("اكتب عنوان الحدث");
      return;
    }
    if (!blockDate || !blockFrom || !blockTo) {
      toast.error("أكمل تاريخ الحدث ووقتي البداية والنهاية");
      return;
    }
    if (blockDate < trip.startDate || blockDate > trip.endDate) {
      toast.error("تاريخ الحدث يجب أن يكون ضمن فترة الرحلة");
      return;
    }
    if (blockTo <= blockFrom) {
      toast.error("وقت النهاية يجب أن يكون بعد وقت البداية");
      return;
    }
    setBusy(true);
    try {
      await addBlock({
        title,
        type: "personal",
        date: blockDate,
        startTime: blockFrom,
        endTime: blockTo,
        tripId: trip.id,
        icon: "plane",
      });
      setBlockFormOpen(false);
      setBlockTitle("");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (s: TripStatus) => {
    if (!trip || trip.status === s) return;
    setBusy(true);
    try {
      await updateTrip(trip.id, { status: s });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!trip) return;
    setBusy(true);
    try {
      await deleteTrip(trip.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  if (!trip) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmDelete(false);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-lg w-[calc(100vw-2rem)] max-h-[88vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-start text-[15px] font-bold">{trip.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ═══ تعريف الرحلة ═══ */}
          <div className="flex flex-wrap items-center gap-1.5">
            <TripStatusChip status={trip.status} />
            <Chip className="text-primary">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              {trip.destination}
            </Chip>
            <Chip className="text-muted-foreground">
              {datesLabel} · {formatNumber(daysCount)} {daysCount === 1 ? "يوم" : "أيام"}
            </Chip>
          </div>

          {/* ═══ الحالة ═══ */}
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-muted-foreground">حالة الرحلة</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="حالة الرحلة">
              {(Object.keys(TRIP_STATUS_META) as TripStatus[]).map((s) => {
                const meta = TRIP_STATUS_META[s];
                const active = trip.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void changeStatus(s)}
                    disabled={busy}
                    className={cn(
                      "h-11 rounded-xl border text-[12px] font-semibold transition-colors disabled:opacity-50",
                      active ? meta.chipCls : "glass-soft border-white/[0.08] text-foreground/70 hover:bg-white/[0.06]"
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ الميزانية ═══ */}
          <GlassCard className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {budget > 0 ? "ميزانية الرحلة" : "مصاريف الرحلة"}
              </span>
              {budget > 0 ? (
                <PrivateAmount className="text-[12.5px] font-bold">
                  <span className={cn(over ? "text-coral" : "text-foreground")}>
                    {formatMoney(spent, currency)}
                  </span>
                  <span className="font-normal text-muted-foreground"> من {formatMoney(budget, currency)}</span>
                </PrivateAmount>
              ) : (
                <PrivateAmount className="text-[12.5px] font-bold text-foreground">
                  {formatMoney(spent, currency)}
                </PrivateAmount>
              )}
            </div>
            {budget > 0 && (
              <>
                <div
                  className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`نسبة استهلاك ميزانية الرحلة: ${pct}%`}
                >
                  <motion.div
                    className={cn("h-full rounded-full", over ? "bg-coral" : pct >= 75 ? "bg-gold" : "bg-mint")}
                    initial={false}
                    animate={{ width: `${Math.max(pct, 2)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className={cn("mt-2 text-[11px] font-bold", over ? "text-coral" : "text-muted-foreground")}>
                  {over
                    ? `تجاوزت الميزانية بـ ${formatMoney(spent - budget, currency)}`
                    : budget - spent > 0
                      ? `متبقٍ ${formatMoney(budget - spent, currency)}`
                      : "استُهلكت الميزانية بالكامل"}
                </p>
              </>
            )}
          </GlassCard>

          {/* ═══ قائمة التجهيز ═══ */}
          <section className="space-y-2.5">
            <SectionHeader
              title="قائمة التجهيز"
              icon={<Luggage className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
              action={doneCount > 0 ? `مسح المنجز (${formatNumber(doneCount)})` : undefined}
              onAction={doneCount > 0 ? () => void clearDoneItems("trip", trip.id) : undefined}
            />
            {sortedItems.length > 0 ? (
              <div className="space-y-1.5">
                {sortedItems.map((it) => (
                  <CheckRow
                    key={it.id}
                    done={it.done}
                    label={it.qty ? `${it.text} · ${it.qty}` : it.text}
                    onToggle={() => void toggleListItem(it.id)}
                    onDelete={() => void deleteListItem(it.id)}
                    toggleAria={`${it.done ? "إلغاء تأشير" : "تأشير"} بند التجهيز: ${it.text}`}
                    deleteAria={`حذف بند التجهيز: ${it.text}`}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl glass-soft px-3 py-3 text-[11px] text-muted-foreground">
                لا بنود تجهيز بعد — أضف أول بند بالأسفل.
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addItem();
                }}
                placeholder="بند تجهيز جديد… (شنطة، شاحن، تذاكر)"
                maxLength={60}
                aria-label="بند تجهيز جديد"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void addItem()}
                disabled={!newItemText.trim()}
                aria-label="إضافة بند التجهيز"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            <p className="tabular text-[10.5px] text-muted-foreground/80">
              الجاهزية {formatNumber(doneCount)} من {formatNumber(items.length)}
            </p>
          </section>

          {/* ═══ البرنامج ═══ */}
          <section className="space-y-2.5">
            <SectionHeader
              title="برنامج الرحلة"
              icon={<CalendarPlus className="h-3.5 w-3.5 text-lav" aria-hidden="true" />}
            />
            {sortedBlocks.length > 0 ? (
              <div className="space-y-1.5">
                {sortedBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl glass-soft px-3 py-2"
                  >
                    <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {dayNameShort(b.date)} {formatDate(b.date)}
                    </span>
                    <span className="tabular shrink-0 text-[10.5px] font-semibold text-primary">
                      {formatTimeAr(b.startTime)} — {formatTimeAr(b.endTime)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{b.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl glass-soft px-3 py-3 text-[11px] text-muted-foreground">
                البرنامج فارغ — خطّط أول حدث للرحلة.
              </p>
            )}

            {blockFormOpen ? (
              <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                <Field label="عنوان الحدث">
                  <input
                    value={blockTitle}
                    onChange={(e) => setBlockTitle(e.target.value)}
                    placeholder="مثال: زيارة المتحف"
                    maxLength={40}
                    className={inputCls}
                    aria-label="عنوان حدث البرنامج"
                  />
                </Field>
                <Field label={`التاريخ (ضمن ${formatDate(trip.startDate)} — ${formatDate(trip.endDate)})`}>
                  <input
                    type="date"
                    value={blockDate}
                    min={trip.startDate}
                    max={trip.endDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    dir="ltr"
                    className={inputCls}
                    aria-label="تاريخ الحدث"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="من">
                    <input
                      type="time"
                      value={blockFrom}
                      onChange={(e) => setBlockFrom(e.target.value || "09:00")}
                      dir="ltr"
                      className={inputCls}
                      aria-label="وقت بداية الحدث"
                    />
                  </Field>
                  <Field label="إلى">
                    <input
                      type="time"
                      value={blockTo}
                      onChange={(e) => setBlockTo(e.target.value || "10:00")}
                      dir="ltr"
                      className={inputCls}
                      aria-label="وقت نهاية الحدث"
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBlockFormOpen(false)}
                    className="h-11 rounded-xl glass-soft border border-white/[0.08] px-4 text-[12px] font-medium transition-colors hover:bg-white/[0.06]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => void addItineraryEvent()}
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl bg-primary text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? "جارٍ الإضافة…" : "أضف للبرنامج"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openBlockForm}
                aria-label="أضف حدثاً للبرنامج"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl glass-soft border border-white/[0.08] text-[12px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.06]"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                أضف حدثاً للبرنامج
              </button>
            )}
          </section>

          {/* ═══ المصاريف ═══ */}
          <section className="space-y-2.5">
            <SectionHeader
              title="مصاريف الرحلة"
              icon={<Receipt className="h-3.5 w-3.5 text-coral" aria-hidden="true" />}
            />
            <div className="flex items-center justify-between rounded-xl glass-soft px-3 py-2.5">
              <span className="text-[11.5px] text-muted-foreground">إجمالي المصاريف المرتبطة</span>
              <PrivateAmount className="text-[13px] font-bold text-foreground">
                {formatMoney(spent, currency)}
              </PrivateAmount>
            </div>
            {lastExpenses.length > 0 ? (
              <div className="space-y-1.5">
                {lastExpenses.map((t) => (
                  <div
                    key={t.id}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-xl glass-soft px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px]">{t.description}</span>
                    <PrivateAmount className="shrink-0 text-[12px] font-semibold text-coral">
                      −{formatMoney(t.amount, currency)}
                    </PrivateAmount>
                  </div>
                ))}
                {expenses.length > 5 && (
                  <p className="tabular px-1 text-[10px] text-muted-foreground/80">
                    و{formatNumber(expenses.length - 5)} مصاريف أخرى مرتبطة
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-xl glass-soft px-3 py-3 text-[11px] text-muted-foreground">
                لا مصاريف مرتبطة بهذه الرحلة بعد.
              </p>
            )}
            <button
              type="button"
              onClick={() => openQuickAdd("expense")}
              aria-label="سجّل مصروف رحلة"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl glass-soft border border-coral/25 text-[12px] font-semibold text-coral transition-colors hover:bg-coral/10"
            >
              <Receipt className="h-4 w-4" aria-hidden="true" />
              سجّل مصروف رحلة
            </button>
          </section>

          {/* ═══ مهام الرحلة ═══ */}
          <section className="space-y-2.5">
            <SectionHeader
              title="مهام الرحلة"
              icon={<SquareCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" />}
            />
            {sortedTasks.length > 0 ? (
              <div className="space-y-1.5">
                {sortedTasks.map((t) => (
                  <CheckRow
                    key={t.id}
                    done={t.done}
                    label={t.title}
                    meta={t.date !== trip.startDate ? formatDate(t.date) : undefined}
                    onToggle={() => void toggleTask(t.id)}
                    toggleAria={`${t.done ? "إلغاء تأشير" : "تأشير"} مهمة الرحلة: ${t.title}`}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl glass-soft px-3 py-3 text-[11px] text-muted-foreground">
                لا مهام مرتبطة — اربط مهام الرحلة هنا وتظهر في التقويم والمهام أيضاً.
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addTaskLinked();
                }}
                placeholder="مهمة مرتبطة بالرحلة… (حجز فندق)"
                maxLength={60}
                aria-label="مهمة رحلة جديدة"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void addTaskLinked()}
                disabled={!newTaskTitle.trim()}
                aria-label="إضافة مهمة الرحلة"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            {tasks.length > 0 && (
              <p className="tabular text-[10.5px] text-muted-foreground/80">
                منجز {formatNumber(tasksDone)} من {formatNumber(tasks.length)} مهمة
              </p>
            )}
          </section>

          {/* ═══ تعديل / حذف ═══ */}
          {!confirmDelete ? (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onEdit(trip)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl glass-soft border border-white/[0.08] text-[12.5px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.06]"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                تعديل البيانات
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                حذف الرحلة
              </button>
            </div>
          ) : (
            <ConfirmBar
              message={`حذف «${trip.name}» نهائياً؟ تُحذف قائمة تجهيزها مع بنودها، وتبقى مصاريفها وبرنامجها ومهامها في أماكنها — بلا ربط.`}
              confirmLabel="حذف الرحلة"
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmDelete(false)}
            />
          )}

          {expenses.length === 0 && items.length === 0 && blocks.length === 0 && tasks.length === 0 && (
            <EmptyState
              compact
              icon={<Plane className="h-5 w-5" />}
              title="رحلة نظيفة"
              hint="ابدأ بقائمة التجهيز ثم خطّط البرنامج — كل شيء يترابط مع التقويم والمال"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
