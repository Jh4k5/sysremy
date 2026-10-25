"use client";

/**
 * Systemy v2 — تفاصيل حدث التقويم
 * يعرض المعلومات (وقت ومدة، مبلغ، روابط مهمة/عادة) مع إجراءات ذكية:
 * إنجاز المهمة، تسجيل العادة، سداد الالتزام — وتعديل/حذف لأحداث الكتل فقط.
 */

import { useEffect, useState, type ReactNode } from "react";
import { CheckSquare, Clock3, HandCoins, NotebookPen, Pencil, Square, Trash2 } from "lucide-react";
import { db, useLive } from "@/lib/db";
import { deleteBlock, ensureDefaultAccount, logHabit, payRecurring, toggleTask } from "@/lib/actions";
import {
  BLOCK_TYPE_COLORS,
  BLOCK_TYPE_LABELS,
  eventDurationMin,
  hoursLabel,
  type CalEvent,
} from "@/lib/calendar-utils";
import { dayName, formatDate, formatMoney, formatTimeAr, relativeDay } from "@/lib/format";
import type { Account, Habit, Task } from "@/lib/types";
import { ConfirmBar, iconByName } from "@/components/systemy/ui-bits";
import { PrivateAmount } from "@/components/systemy/glass";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<CalEvent["source"], string> = {
  block: "حدث",
  task: "مهمة مجدولة",
  recurring: "استحقاق التزام",
  habit: "عادة",
};

export interface BlockDetailsDialogProps {
  event: CalEvent | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (ev: CalEvent) => void;
  tasks: Task[];
  habits: Habit[];
  currency: string;
}

export function BlockDetailsDialog({
  event,
  onOpenChange,
  onEdit,
  tasks,
  habits,
  currency,
}: BlockDetailsDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choosingAccount, setChoosingAccount] = useState(false);

  // الالتزام المرتبط + الحسابات — لسداد «سدد» باختيار حساب إن لم يحدد الالتزام واحداً
  const recurring = useLive(
    () => (event?.recurringId ? db.recurrings.get(event.recurringId) : Promise.resolve(null)),
    [event?.recurringId],
  );
  const accounts = useLive(() => db.accounts.toArray(), []);

  // تصفير التأكيدات عند تبديل الحدث
  useEffect(() => {
    setConfirmDelete(false);
    setChoosingAccount(false);
  }, [event?.id]);

  if (!event) return null;

  const isTx = event.id.startsWith("tx-");
  const isRealBlock = event.source === "block" && !isTx;
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived);
  const linkedAccount = recurring?.accountId ? activeAccounts.find((a) => a.id === recurring.accountId) : undefined;
  const task = event.taskId ? tasks.find((t) => t.id === event.taskId) : undefined;
  const habit = event.habitId ? habits.find((h) => h.id === event.habitId) : undefined;
  const color = event.color ?? BLOCK_TYPE_COLORS[event.type];
  const duration = eventDurationMin(event);
  const isAllDay = event.allDay === true;

  const doDelete = async () => {
    if (!isRealBlock) return;
    setBusy(true);
    try {
      await deleteBlock(event.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async () => {
    if (!event.taskId) return;
    setBusy(true);
    try {
      await toggleTask(event.taskId);
    } finally {
      setBusy(false);
    }
  };

  const logLinkedHabit = async () => {
    if (!event.habitId) return;
    setBusy(true);
    try {
      await logHabit(event.habitId);
    } finally {
      setBusy(false);
    }
  };

  /** السداد: إن حدد الالتزام حساباً يُنفذ مباشرة، وإلا تظهر رقائق الحسابات للاختيار */
  const pay = async (accountId?: string) => {
    if (!event.recurringId) return;
    setBusy(true);
    try {
      // لا حسابات؟ يُنشأ «نقد» تلقائياً — لا نهايات مسدودة
      const ensured = accountId ?? (await ensureDefaultAccount()).account.id;
      await payRecurring(event.recurringId, { accountId: ensured });
      setChoosingAccount(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const onPayTap = () => {
    if (recurring?.accountId) {
      void pay();
      return;
    }
    setChoosingAccount(true);
  };

  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) { setConfirmDelete(false); setChoosingAccount(false); } onOpenChange(o); }}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-black/[0.08] bg-white/95 p-5 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(23,33,43,0.35)]"
      >
        <DialogHeader className="space-y-2 text-right">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: `${color}22`,
              color,
              border: `1px solid ${color}55`,
            }}
          >
            {BLOCK_TYPE_LABELS[event.type]}
            <span className="opacity-70">· {isTx ? "معاملة" : SOURCE_LABELS[event.source]}</span>
          </span>
          <DialogTitle className="text-right text-lg leading-snug">{event.title}</DialogTitle>
          <DialogDescription className="text-right text-[11.5px] tabular">
            {dayName(event.date)} · {formatDate(event.date)} · {relativeDay(event.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <DetailRow
            icon={<Clock3 className="h-4 w-4" />}
            label="الوقت"
            value={
              isAllDay
                ? "طول اليوم"
                : `${formatTimeAr(event.start)} — ${formatTimeAr(event.end)} · ${hoursLabel(duration)}`
            }
          />

          {(event.recurringId || isTx) && event.amount != null && (
            <DetailRow
              icon={<HandCoins className="h-4 w-4" />}
              label={event.recurringId ? "المبلغ" : "قيمة المعاملة"}
              value={
                <PrivateAmount className="text-[13.5px] font-bold tabular">
                  {formatMoney(event.amount, currency)}
                </PrivateAmount>
              }
            />
          )}

          {task && (
            <DetailRow
              icon={task.done ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              label="مهمة مرتبطة"
              value={
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate", task.done && "line-through opacity-60")}>{task.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      task.done ? "bg-mint/15 text-mint" : "glass-soft text-muted-foreground"
                    )}
                  >
                    {task.done ? "منجزة" : "قائمة"}
                  </span>
                </span>
              }
            />
          )}

          {habit && (
            <DetailRow
              icon={(() => {
                const I = iconByName(habit.icon.toLowerCase());
                return <I className="h-4 w-4" />;
              })()}
              label="عادة مرتبطة"
              value={habit.name}
            />
          )}

          {event.note && (
            <DetailRow icon={<NotebookPen className="h-4 w-4" />} label="ملاحظة" value={event.note} />
          )}

          {isTx && (
            <p className="rounded-xl glass-soft px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
              معاملة مسجلة في المال — تظهر هنا للسياق الزمني فقط.
            </p>
          )}
        </div>

        {/* الإجراءات */}
        <div className="mt-1 space-y-2">
          {event.taskId && (
            <button
              type="button"
              onClick={() => void completeTask()}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan/15 text-[13px] font-bold text-cyan transition-all hover:bg-cyan/25 active:scale-[0.98] disabled:opacity-50"
            >
              <CheckSquare className="h-5 w-5" aria-hidden="true" />
              {task?.done ? "إرجاع الإنجاز" : "إنجاز المهمة"}
            </button>
          )}

          {habit && !event.taskId && (
            <button
              type="button"
              onClick={() => void logLinkedHabit()}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mint/15 text-[13px] font-bold text-mint transition-all hover:bg-mint/25 active:scale-[0.98] disabled:opacity-50"
            >
              سجّل «{habit.name}» اليوم
            </button>
          )}

          {event.recurringId && choosingAccount && (
            <div className="glass-deep space-y-3 rounded-2xl p-3.5">
              <p className="text-[12px] font-semibold">من أي حساب تسدد؟</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="اختيار حساب السداد">
                {activeAccounts.map((a: Account) => {
                  const AccIcon = iconByName((a.icon || "wallet").toLowerCase());
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void pay(a.id)}
                      disabled={busy}
                      aria-label={`السداد من ${a.name}`}
                      className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-transform active:scale-95 disabled:opacity-50"
                      style={{ borderColor: `${a.color}55`, background: `${a.color}1a`, color: a.color }}
                    >
                      <AccIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="max-w-[120px] truncate">{a.name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setChoosingAccount(false)}
                disabled={busy}
                className="h-11 w-full rounded-xl glass-soft border border-black/[0.07] text-[12.5px] font-medium transition-colors hover:bg-black/[0.04] disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          )}

          {event.recurringId && !choosingAccount && (
            <button
              type="button"
              onClick={onPayTap}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground glow-gold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              <HandCoins className="h-5 w-5" aria-hidden="true" />
              سدد الآن
              {event.amount != null && (
                <PrivateAmount className="tabular text-[12px]">
                  · {formatMoney(event.amount, currency)}
                </PrivateAmount>
              )}
            </button>
          )}

          {event.recurringId && !choosingAccount && linkedAccount && (
            <p className="tabular text-center text-[10.5px] text-muted-foreground">
              من حساب: {linkedAccount.name}
            </p>
          )}

          {isRealBlock && !confirmDelete && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                حذف
              </button>
              <button
                type="button"
                onClick={() => onEdit(event)}
                disabled={busy}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary/15 border border-primary/40 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                تعديل
              </button>
            </div>
          )}

          {isRealBlock && confirmDelete && (
            <ConfirmBar
              message={`حذف «${event.title}» من جدولك؟ يمكنك إضافته مجدداً في أي وقت.`}
              confirmLabel="حذف الحدث"
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmDelete(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl glass-soft px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[13px] font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}
