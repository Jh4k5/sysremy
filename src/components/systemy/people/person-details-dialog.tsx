"use client";

/**
 * Systemy v3 — ملف الشخص (تفاصيل)
 * سجّل تواصلاً / ذكّرني بالتواصل + ديون الشخص بتسديد أو استلام (مع اختيار حساب)
 * + دين جديد له + آخر المعاملات المشتركة + المهام المرتبطة
 * + عيد الميلاد والوسوم والملاحظات + تعديل وحذف بتأكيد واضح.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarHeart,
  Check,
  HandCoins,
  Pencil,
  Plus,
  Square,
  Trash2,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addReminder,
  addTask,
  deletePerson,
  logContact,
  receiveDebt,
  settleDebt,
  toggleTask,
} from "@/lib/actions";
import { addDaysISO, formatDate, formatMoney, formatNumber, relativeDay, todayISO } from "@/lib/format";
import type { Account, Debt, Person, Task, Transaction } from "@/lib/types";
import { Chip, PrivateAmount } from "@/components/systemy/glass";
import { ConfirmBar, inputCls } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { avatarColor, daysSinceContact, debtsOf, initialOf, nextBirthday, transactionsOf } from "./shared";

export interface PersonDetailsDialogProps {
  person: Person;
  debts: Debt[];
  /** مرتبة تنازلياً بالتاريخ */
  transactions: Transaction[];
  tasks: Task[];
  accounts: Account[];
  currency: string;
  onClose: () => void;
  onEdit: (p: Person) => void;
  onAddDebt: (p: Person) => void;
}

export function PersonDetailsDialog({
  person,
  debts,
  transactions,
  tasks,
  accounts,
  currency,
  onClose,
  onEdit,
  onAddDebt,
}: PersonDetailsDialogProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTask, setNewTask] = useState("");

  const today = todayISO();
  const since = daysSinceContact(person, today);
  const birthday = person.birthday ? nextBirthday(person.birthday, today) : null;
  const myDebts = debtsOf(debts, person);
  const outstanding = myDebts.filter((d) => d.amount - d.paid > 0.004);
  const settledCount = myDebts.length - outstanding.length;
  const sharedTx = transactionsOf(transactions, person).slice(0, 5);
  const linkedTasks = tasks
    .filter((t) => t.personId === person.id)
    .sort((a, b) => (a.done === b.done ? a.date.localeCompare(b.date) : a.done ? 1 : -1));

  // تصفير الحالات عند تبديل الشخص
  useEffect(() => {
    setConfirmDelete(false);
    setNewTask("");
  }, [person.id]);

  const doLogContact = async () => {
    setBusy(true);
    try {
      await logContact(person.id);
    } finally {
      setBusy(false);
    }
  };

  const doRemind = async () => {
    setBusy(true);
    try {
      await addReminder({
        title: `تواصل مع ${person.name}`,
        dueAt: `${addDaysISO(today, 7)}T09:00`,
        sourceType: "person",
        sourceId: person.id,
        done: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const addRelatedTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    setBusy(true);
    try {
      await addTask({
        title,
        date: today,
        priority: "normal",
        done: false,
        personId: person.id,
      });
      setNewTask("");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deletePerson(person.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const tags = person.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-black/[0.08] bg-white/95 p-5 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(23,33,43,0.35)] max-h-[85dvh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="space-y-2 text-right">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
              style={{ background: `${avatarColor(person.name)}26`, color: avatarColor(person.name) }}
              aria-hidden="true"
            >
              {initialOf(person.name)}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-right text-lg leading-snug">{person.name}</DialogTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Chip className="text-primary">{person.relation}</Chip>
                {person.favorite && <Chip className="text-gold">مفضلة</Chip>}
              </div>
            </div>
          </div>
          <DialogDescription className="text-right text-[11.5px]">
            {since === null
              ? "لم يُسجل تواصل بعد"
              : since === 0
                ? "آخر تواصل اليوم"
                : `آخر تواصل: منذ ${formatNumber(since)} ${since === 1 ? "يوم" : "أيام"}`}
          </DialogDescription>
        </DialogHeader>

        {/* ═══ إجراءات التواصل ═══ */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void doLogContact()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground glow-gold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="h-5 w-5" aria-hidden="true" />
            سجّل تواصلاً اليوم
          </button>
          <button
            type="button"
            onClick={() => void doRemind()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/10 text-[12.5px] font-bold text-cyan transition-colors hover:bg-cyan/20 active:scale-[0.98] disabled:opacity-50"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            ذكّرني بالتواصل بعد أسبوع
          </button>
        </div>

        {/* ═══ بيانات الملف ═══ */}
        <div className="space-y-2">
          {person.birthday && (
            <InfoRow
              icon={<CalendarHeart className="h-4 w-4" />}
              label="عيد الميلاد"
              value={
                <span className="tabular">
                  {formatDate(person.birthday, true)}
                  {birthday && (
                    <span className="text-muted-foreground"> · القادم بعد {formatNumber(birthday.days)} يوماً</span>
                  )}
                </span>
              }
            />
          )}
          {tags.length > 0 && (
            <InfoRow
              icon={<span className="text-[10px] font-bold">#</span>}
              label="الوسوم"
              value={
                <span className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </span>
              }
            />
          )}
          {person.notes && <InfoRow icon={<span className="text-[10px] font-bold">✎</span>} label="ملاحظات" value={person.notes} />}
        </div>

        {/* ═══ الديون ═══ */}
        <SectionLabel
          icon={<HandCoins className="h-4 w-4" />}
          title="الديون"
          extra={
            myDebts.length > 0
              ? outstanding.length > 0
                ? `${formatNumber(outstanding.length)} قائمة`
                : "كلها مكتملة"
              : undefined
          }
        />
        <div className="space-y-2">
          {myDebts.length === 0 && (
            <p className="rounded-xl glass-soft px-3 py-2.5 text-[11.5px] text-muted-foreground">
              لا ديون مسجلة لهذا الشخص — البيانات المعروضة فقط، بلا أي استنتاج.
            </p>
          )}
          {outstanding.map((d) => (
            <DebtRow key={d.id} debt={d} accounts={accounts} currency={currency} />
          ))}
          {settledCount > 0 && (
            <ul className="space-y-1">
              {myDebts
                .filter((d) => d.amount - d.paid <= 0.004)
                .map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-xl glass-soft px-3 py-2 min-h-[44px] opacity-70"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        d.direction === "payable" ? "bg-coral/15 text-coral" : "bg-mint/15 text-mint"
                      )}
                    >
                      {d.direction === "payable" ? "عليّ" : "لي"}
                    </span>
                    <span className="text-[12px] font-medium truncate">{d.name}</span>
                    <span className="ms-auto shrink-0 rounded-full bg-mint/15 px-2 py-0.5 text-[9.5px] font-bold text-mint">
                      مكتمل ✓
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onAddDebt(person)}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 text-[12px] font-bold text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            دين جديد لهذا الشخص
          </button>
        </div>

        {/* ═══ المعاملات المشتركة ═══ */}
        <SectionLabel icon={<Wallet className="h-4 w-4" />} title="معاملات مشتركة" extra={sharedTx.length > 0 ? "آخر ٥" : undefined} />
        {sharedTx.length === 0 ? (
          <p className="rounded-xl glass-soft px-3 py-2.5 text-[11.5px] text-muted-foreground">
            لا معاملات مرتبطة به — أضف مصروفاً واذكر اسمه في «مع من؟» أو من ملفه.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sharedTx.map((t) => {
              const isIn = t.type === "income";
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2.5 rounded-xl glass-soft px-3 py-2.5 min-h-[44px]"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isIn ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral"
                    )}
                    aria-hidden="true"
                  >
                    {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground tabular">{formatDate(t.date)}</p>
                  </div>
                  <PrivateAmount
                    className={cn("text-[13px] font-bold tabular shrink-0", isIn ? "text-mint" : "text-foreground/90")}
                  >
                    {formatMoney(isIn ? t.amount : -t.amount, currency)}
                  </PrivateAmount>
                </li>
              );
            })}
          </ul>
        )}

        {/* ═══ المهام المرتبطة ═══ */}
        <SectionLabel icon={<Square className="h-4 w-4" />} title="مهام مرتبطة" extra={linkedTasks.length > 0 ? `${formatNumber(linkedTasks.length)}` : undefined} />
        <div className="space-y-1.5">
          {linkedTasks.length === 0 && (
            <p className="rounded-xl glass-soft px-3 py-2.5 text-[11.5px] text-muted-foreground">
              لا مهام مرتبطة — أضف واحدة وستظهر في شاشة المهام أيضاً.
            </p>
          )}
          <ul className="space-y-1">
            {linkedTasks.map((t) => (
              <li key={t.id}>
                <TaskCheck task={t} />
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addRelatedTask();
              }}
              placeholder="مهمة مرتبطة به…"
              className={cn(inputCls, "h-11 flex-1 min-w-0")}
              aria-label="مهمة جديدة مرتبطة بالشخص"
            />
            <button
              type="button"
              onClick={() => void addRelatedTask()}
              disabled={busy || !newTask.trim()}
              aria-label="إضافة مهمة مرتبطة"
              className="h-11 w-11 shrink-0 rounded-xl border border-primary/30 bg-primary/10 text-primary flex items-center justify-center transition-colors hover:bg-primary/20 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ═══ تعديل وحذف ═══ */}
        <div className="space-y-2 pt-1">
          {!confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(person)}
                disabled={busy}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                تعديل الملف
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label={`حذف ${person.name}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-coral/40 text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <ConfirmBar
              message={`حذف ملف «${person.name}»؟ معاملاته ومهامه المسجلة تبقى كما هي — يُفك ربطها بهذا الملف فقط.`}
              confirmLabel="حذف نهائي"
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmDelete(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════ صف دين مع تسديد/استلام ═══════════════════════ */

function DebtRow({ debt, accounts, currency }: { debt: Debt; accounts: Account[]; currency: string }) {
  const remaining = Math.max(0, Math.round((debt.amount - debt.paid) * 100) / 100);
  const isPayable = debt.direction === "payable";
  const [choosing, setChoosing] = useState(false);
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");

  const activeAccounts = accounts.filter((a) => !a.archived);

  const run = (amt: number, accountId?: string) => {
    if (!(amt > 0)) return;
    if (isPayable) void settleDebt(debt.id, amt, accountId);
    else void receiveDebt(debt.id, amt, accountId);
    setChoosing(false);
    setPartial(false);
    setAmount("");
  };

  const fullTap = () => {
    if (activeAccounts.length === 0) {
      run(remaining);
      return;
    }
    setChoosing((c) => !c);
    setPartial(false);
  };

  const partialTap = () => {
    setPartial((p) => !p);
    setChoosing(false);
  };

  const applyPartial = (accountId?: string) => {
    const v = Number(amount);
    if (!(v > 0)) return;
    run(Math.min(v, remaining), accountId);
  };

  return (
    <div className="rounded-2xl glass-soft p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
            isPayable ? "bg-coral/15 text-coral" : "bg-mint/15 text-mint"
          )}
        >
          {isPayable ? "عليّ" : "لي"}
        </span>
        <p className="text-[12.5px] font-semibold truncate">{debt.name}</p>
        <PrivateAmount className="ms-auto text-[13.5px] font-bold tabular shrink-0 text-foreground/90">
          {formatMoney(remaining, currency)}
        </PrivateAmount>
      </div>
      <p className="text-[10px] text-muted-foreground tabular">
        {debt.paid > 0
          ? `سُدد ${formatMoney(debt.paid, currency)} من ${formatMoney(debt.amount, currency)}`
          : `الإجمالي ${formatMoney(debt.amount, currency)}`}
        {debt.dueDate && ` · يستحق ${relativeDay(debt.dueDate)}`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={fullTap}
          className={cn(
            "flex-1 h-11 rounded-xl border text-[12px] font-bold transition-colors",
            isPayable
              ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
              : "bg-mint/10 border-mint/30 text-mint hover:bg-mint/20"
          )}
        >
          {isPayable ? "سدّد المتبقي" : "استلم المتبقي"}
        </button>
        <button
          type="button"
          onClick={partialTap}
          aria-label="تسديد مبلغ جزئي"
          className="h-11 px-3.5 rounded-xl glass-soft border border-black/[0.07] text-[11.5px] font-medium text-foreground/80 transition-colors hover:bg-black/[0.04]"
        >
          جزئي…
        </button>
      </div>

      {choosing && (
        <div className="space-y-2">
          <p className="text-[10.5px] text-muted-foreground">
            من أي حساب؟ — أو سجّل بلا معاملة (يحدّث الدين فقط):
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="اختيار حساب التسديد">
            {activeAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => run(remaining, a.id)}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-transform active:scale-95"
                style={{ borderColor: `${a.color}55`, background: `${a.color}1a`, color: a.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                <span className="max-w-[110px] truncate">{a.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => run(remaining)}
              className="h-11 px-3.5 rounded-xl glass-soft border border-black/[0.07] text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04]"
            >
              بلا معاملة
            </button>
          </div>
        </div>
      )}

      {partial && (
        <div className="space-y-2 glass-deep rounded-xl p-3">
          <p className="text-[10.5px] font-semibold">مبلغ جزئي ({isPayable ? "تسديد" : "استلام"})</p>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder={`حتى ${remaining}`}
            className={cn(inputCls, "h-11 tabular")}
            aria-label="المبلغ الجزئي"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="حساب المبلغ الجزئي">
            {activeAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => applyPartial(a.id)}
                disabled={!(Number(amount) > 0)}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-transform active:scale-95 disabled:opacity-40"
                style={{ borderColor: `${a.color}55`, background: `${a.color}1a`, color: a.color }}
              >
                <span className="max-w-[110px] truncate">{a.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyPartial()}
              disabled={!(Number(amount) > 0)}
              className="h-11 px-3.5 rounded-xl glass-soft border border-black/[0.07] text-[12px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] disabled:opacity-40"
            >
              بلا معاملة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ أدوات عرض ═══════════════════════ */

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl glass-soft px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionLabel({ icon, title, extra }: { icon: ReactNode; title: string; extra?: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1 text-[12px] font-semibold text-foreground/90">
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <span>{title}</span>
      {extra && <Chip className="text-muted-foreground tabular">{extra}</Chip>}
    </div>
  );
}

function TaskCheck({ task }: { task: Task }) {
  const [done, setDone] = useState(task.done);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDone(task.done), [task.done]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !done;
    setDone(next);
    try {
      await toggleTask(task.id);
    } catch {
      setDone(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={done}
      aria-label={`${done ? "إرجاع" : "إنجاز"} مهمة ${task.title}`}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-black/[0.03] min-h-[44px]"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          done ? "border-cyan bg-cyan/20 text-cyan" : "border-white/25 text-transparent"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span
        className={cn(
          "text-[12.5px] leading-relaxed",
          done ? "text-muted-foreground line-through" : "text-foreground/90"
        )}
      >
        {task.title}
      </span>
      <span className="ms-auto shrink-0 text-[10px] text-muted-foreground tabular">{formatDate(task.date)}</span>
    </button>
  );
}
