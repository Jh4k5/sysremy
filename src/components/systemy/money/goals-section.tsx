"use client";

/**
 * Systemy v2 — قسم «أهداف الادخار» (الأوعية)
 * بطاقة لكل هدف: نسبة، مساهمة شهرية، شهور متبقية، احتفال عند الاكتمال 🎉
 * + ساهم/اسحب بحساب اختياري + CRUD كامل مع منتقي إيموجي.
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { contributeGoal, addGoal, deleteGoal, updateGoal, withdrawGoal } from "@/lib/actions";
import { formatMoney, formatNumber, relativeDay } from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { Chip, GlassCard, PrivateAmount } from "@/components/systemy/glass";
import {
  ColorSwatches,
  ConfirmBar,
  EmptyState,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
} from "@/components/systemy/ui-bits";
import { SheetShell, tint, type MoneyData } from "./money-screen";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ═══════════════════════ */

const EMOJI_CHOICES = [
  "🏠", "🚗", "✈️", "💻", "📚", "🎓", "💍", "🕌",
  "👜", "🎁", "🐳", "🌙", "💎", "📱", "🎮", "🏖️",
];

/* ═══════════════════════ القسم ═══════════════════════ */

export function GoalsSection({ data }: { data: MoneyData }) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const { settings, accounts, goals } = data;
  const cur = settings.currency || "ر.س";

  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [withdrawing, setWithdrawing] = useState<Goal | null>(null);

  const live = useMemo(() => goals.filter((g) => !g.archived).sort((a, b) => a.order - b.order), [goals]);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);

  const totalSaved = live.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = live.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div>
      {/* ═══ رأس القسم ═══ */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
          <Target className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>أهداف الادخار</span>
          <Chip className="text-muted-foreground tabular">{formatNumber(live.length)}</Chip>
        </div>
        <button
          onClick={() => setEditing("new")}
          aria-label="إضافة هدف جديد"
          className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          هدف
        </button>
      </div>

      {goals.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="لا أهداف بعد"
            hint="وعاء مسمّى لكل حلم: حجة، لابتوب، سيارة — مساهمة شهرية تتصل بالرصيد الآمن"
            actionLabel="أضف هدفك الأول"
            onAction={() => openQuickAdd("goal")}
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {live.length > 0 && (
            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11.5px] text-muted-foreground">ادّخرت من أهدافك</p>
                <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 tabular">
                  من {formatMoney(totalTarget, cur)}
                </p>
              </div>
              <PrivateAmount className="num-display text-[22px] tabular text-mint">
                {formatMoney(totalSaved, cur)}
              </PrivateAmount>
            </GlassCard>
          )}

          <div className="space-y-3">
            {live.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
              const remaining = Math.max(0, g.targetAmount - g.savedAmount);
              const monthsLeft = g.monthly > 0 && remaining > 0 ? Math.ceil(remaining / g.monthly) : 0;
              const done = pct >= 100;
              return (
                <GlassCard key={g.id} className={cn("p-4", done && "glow-gold border-primary/40")}>
                  <div className="flex items-center gap-3">
                    <span
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-[24px] shrink-0"
                      style={{ background: tint(g.color) }}
                      aria-hidden="true"
                    >
                      {g.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold truncate">{g.name}</span>
                        {done ? (
                          <Chip className="text-gold shrink-0">🎉 اكتمل</Chip>
                        ) : (
                          <Chip className="text-muted-foreground tabular shrink-0">{formatNumber(pct)}%</Chip>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular">
                        <PrivateAmount className="font-semibold text-foreground/80">
                          {formatMoney(g.savedAmount, cur)}
                        </PrivateAmount>
                        {" من "}
                        {formatMoney(g.targetAmount, cur)}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing(g)}
                      aria-label={`تعديل ${g.name}`}
                      className="w-11 h-11 rounded-xl glass-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="h-2 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: done ? "linear-gradient(90deg, #F5B95C, #6EE7A8)" : g.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2 text-[10.5px] text-muted-foreground tabular flex-wrap">
                    <span>شهرياً {formatMoney(g.monthly, cur)}</span>
                    {monthsLeft > 0 && <span>متبقٍ {formatNumber(monthsLeft)} شهر</span>}
                    {g.targetDate && <span>{relativeDay(g.targetDate)}</span>}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setContributing(g)}
                      className="flex-1 h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold hover:bg-primary/25 transition-colors"
                    >
                      ساهم
                    </button>
                    {g.savedAmount > 0 && (
                      <button
                        onClick={() => setWithdrawing(g)}
                        className="flex-1 h-11 rounded-xl glass-soft border border-white/[0.08] text-foreground/75 text-[12px] font-bold hover:bg-white/[0.07] transition-colors"
                      >
                        اسحب
                      </button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ الأوراق ═══ */}
      {editing && <GoalSheet editing={editing} data={data} onClose={() => setEditing(null)} />}
      {contributing && (
        <GoalMoveSheet
          goal={contributing}
          accounts={activeAccounts}
          mode="contribute"
          cur={cur}
          digits={settings.digits ?? "latn"}
          onClose={() => setContributing(null)}
        />
      )}
      {withdrawing && (
        <GoalMoveSheet
          goal={withdrawing}
          accounts={activeAccounts}
          mode="withdraw"
          cur={cur}
          digits={settings.digits ?? "latn"}
          onClose={() => setWithdrawing(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ ورقة ساهم/اسحب ═══════════════════════ */

function GoalMoveSheet({
  goal,
  accounts,
  mode,
  cur,
  digits,
  onClose,
}: {
  goal: Goal;
  accounts: MoneyData["accounts"];
  mode: "contribute" | "withdraw";
  cur: string;
  digits: "latn" | "arab";
  onClose: () => void;
}) {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const [amount, setAmount] = useState(
    mode === "contribute" ? String(goal.monthly > 0 ? goal.monthly : "") : String(goal.savedAmount),
  );
  const [accountId, setAccountId] = useState("none");
  const [busy, setBusy] = useState(false);

  const move = async () => {
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    if (mode === "withdraw" && value > goal.savedAmount) {
      toast.error(`المحفوظ ${formatMoney(goal.savedAmount, cur)} فقط`);
      return;
    }
    setBusy(true);
    const opts = accountId === "none" ? undefined : { accountId };
    if (mode === "contribute") await contributeGoal(goal.id, value, opts);
    else await withdrawGoal(goal.id, value, opts);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={mode === "contribute" ? `ساهم في «${goal.name}»` : `اسحب من «${goal.name}»`}
      desc={
        mode === "contribute"
          ? `المتبقي للاكتمال ${formatMoney(remaining, cur)}`
          : `المحفوظ حالياً ${formatMoney(goal.savedAmount, cur)}`
      }
      onClose={onClose}
    >
      <FormShell onSave={() => void move()} busy={busy} saveLabel={mode === "contribute" ? "أضف المساهمة" : "اسحب المبلغ"}>
        <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
          <div className="num-display text-[36px] text-primary tabular" aria-live="polite">
            {displayAmount(amount, digits) || "0"}
          </div>
          <span className="text-[12px] text-muted-foreground">{cur}</span>
        </div>
        <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ الحركة" />

        <Field
          label="الحساب (اختياري)"
          hint={mode === "contribute" ? "إن اخترته تُسجَّل كتحويل مرتبط بالهدف" : "إن اخترته يُسجَّل المبلغ دخلاً في الحساب"}
        >
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label="اختيار الحساب">
            <button
              type="button"
              role="radio"
              aria-checked={accountId === "none"}
              onClick={() => setAccountId("none")}
              className={cn(
                "h-11 px-3.5 rounded-xl border text-[12px] font-medium shrink-0 transition-all",
                accountId === "none"
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground"
              )}
            >
              بدون ربط بحساب
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accountId === a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "h-11 px-3.5 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 shrink-0 transition-all",
                  accountId === a.id
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground"
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                {a.name}
              </button>
            ))}
          </div>
        </Field>
      </FormShell>
    </SheetShell>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل هدف ═══════════════════════ */

function GoalSheet({ editing, data, onClose }: { editing: Goal | "new"; data: MoneyData; onClose: () => void }) {
  const isNew = editing === "new";
  const goal = isNew ? null : editing;
  const { settings, goals } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🌙");
  const [color, setColor] = useState(goal?.color ?? "#F5B95C");
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "");
  const [saved, setSaved] = useState(goal ? String(goal.savedAmount) : "0");
  const [monthly, setMonthly] = useState(goal ? String(goal.monthly) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمّ هدفك أولاً");
      return;
    }
    const targetValue = Number(target);
    if (!(targetValue > 0)) {
      toast.error("أدخل مبلغ الهدف");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      emoji,
      color,
      targetAmount: targetValue,
      savedAmount: Number(saved) || 0,
      monthly: Number(monthly) || 0,
      targetDate: targetDate || undefined,
      archived: goal?.archived ?? false,
      order: goal?.order ?? Math.max(0, ...goals.map((g) => g.order)) + 1,
    };
    if (goal) await updateGoal(goal.id, payload);
    else await addGoal(payload);
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!goal) return;
    setBusy(true);
    await deleteGoal(goal.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "هدف جديد" : `تعديل ${goal?.name ?? ""}`}
      desc="وعاء ادخار مسمّى — مساهمته الشهرية تُقتطع من الرصيد الآمن"
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الهدف" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={`حذف «${goal?.name}» ومحفوظاته ${formatMoney(goal?.savedAmount ?? 0, cur)}؟`}
              confirmLabel="حذف نهائي"
              onConfirm={() => void del()}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full h-12 rounded-2xl glass-soft border border-[#FF8E7A]/25 text-[#FF8E7A] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#FF8E7A]/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              حذف الهدف
            </button>
          ))
        }
      >
        <Field label="اسم الهدف">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="حجة، لابتوب جديد…"
            className={inputCls}
          />
        </Field>

        <Field label="الرمز">
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="اختيار رمز الهدف">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                aria-label={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  "aspect-square rounded-xl flex items-center justify-center text-[20px] transition-all",
                  emoji === e ? "bg-primary/25 border border-primary/50 scale-105" : "glass-soft border border-white/[0.06] hover:bg-white/[0.07]"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="المبلغ المستهدف">
          <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
            <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
              {displayAmount(target, digits) || "0"}
            </div>
            <span className="text-[12px] text-muted-foreground">{cur}</span>
          </div>
          <NumberPad value={target} onChange={setTarget} digits={digits} className="mt-3" label="لوحة المبلغ المستهدف" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="المحفوظ حتى الآن">
            <input
              value={saved}
              onChange={(e) => setSaved(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={cn(inputCls, "text-center num-display")}
              aria-label="المبلغ المحفوظ"
            />
          </Field>
          <Field label="المساهمة الشهرية">
            <input
              value={monthly}
              onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              className={cn(inputCls, "text-center num-display")}
              aria-label="المساهمة الشهرية"
            />
          </Field>
        </div>

        <Field label="التاريخ المستهدف (اختياري)">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={cn(inputCls, "[color-scheme:dark]")}
            aria-label="التاريخ المستهدف"
          />
        </Field>

        <Field label="اللون">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
      </FormShell>
    </SheetShell>
  );
}
