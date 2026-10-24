"use client";

/**
 * نموذج المصروف/الدخل — لوحة أرقام LTR + تصنيف ذكي + تخصيص كامل.
 * PR-2: تحكم النوع واحد فقط (شبكة الأنواع أعلاه — أُلغي زر مصروف/دخل المكرر)،
 * زر الحفظ ثابت في تذييل اللوحة خارج منطقة التمرير (يُرى دائماً)،
 * ويقبل مسودة الالتقاط الطبيعي («قهوة 18») لتعبئة الحقول دفعة واحدة.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronUp, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { db, DEFAULT_SETTINGS, getSettings, useLive } from "@/lib/db";
import { addTransaction, contributeGoal, ensureDefaultAccount, guessCategoryFor, replaceTransaction } from "@/lib/actions";
import { budgetPacing } from "@/lib/money";
import type { Account, Category, Goal, Transaction } from "@/lib/types";
import { formatMoney, nowHHMM, todayISO } from "@/lib/format";
import { Field, NumberPad, StickySave, displayAmount, inputCls, textareaCls, iconByName } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import type { QuickDraft } from "./quick-add-sheet";

export function TxForm({ tab, presetDate, editTxId, draft }: { tab: "expense" | "income"; presetDate: string | null; editTxId: string | null; draft: QuickDraft | null }) {
  const close = useUIStore((s) => s.closeQuickAdd);

  const accounts = useLive<Account[]>(() => db.accounts.toArray(), []);
  const categories = useLive<Category[]>(() => db.categories.toArray(), []);
  const settings = useLive(() => getSettings(), []);
  const txs = useLive<Transaction[]>(() => db.transactions.toArray(), []);
  const goals = useLive<Goal[]>(() => db.goals.toArray(), []);

  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [person, setPerson] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(presetDate ?? todayISO());
  const [time, setTime] = useState(nowHHMM());
  const [moreOpen, setMoreOpen] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // تحميل المعاملة المحددة للتعديل
  useEffect(() => {
    let alive = true;
    if (editTxId) {
      setGoalId(""); // لا ربط أهداف في وضع التعديل
      void db.transactions.get(editTxId).then((t) => {
        if (alive && t) {
          setEditTx(t);
          setDesc(t.description);
          setAmount(String(t.amount));
          setAccountId(t.accountId);
          setToAccountId(t.toAccountId ?? "");
          setCategoryId(t.categoryId ?? "");
          setMerchant(t.merchant ?? "");
          setPerson(t.person ?? "");
          setTags(t.tags);
          setNotes(t.notes ?? "");
          setDate(t.date.slice(0, 10));
          setTime(t.date.slice(11, 16) || nowHHMM());
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [editTxId]);

  // مسودة الالتقاط الطبيعي — تعبئة دفعة واحدة عند «عدّل في النموذج»
  useEffect(() => {
    if (!draft || editTxId) return;
    setDesc(draft.description);
    if (draft.amount != null) setAmount(String(draft.amount));
    if (draft.categoryId) setCategoryId(draft.categoryId);
    else setCategoryId("");
    if (draft.date) setDate(draft.date);
    if (draft.time) setTime(draft.time);
    setPerson(draft.person ?? "");
    setTags(draft.tags.join(", "));
  }, [draft?.stamp]);

  const kind = editTx ? (editTx.type === "income" ? "income" : "expense") : tab;
  const isTransfer = editTx?.type === "transfer";
  const digits = settings?.digits ?? "latn";
  const currency = settings?.currency ?? "ر.س";
  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => !a.archived), [accounts]);
  const activeGoals = useMemo(() => (goals ?? []).filter((g) => !g.archived), [goals]);
  const kindCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.archived && c.kind === (kind === "income" ? "income" : "expense")),
    [categories, kind]
  );

  // «في ماذا صرفت؟» — الأوصاف الأكثر تسجيلاً لهذا النوع (آخر 120 معاملة):
  // الأكثر تكراراً أولاً، والتعادل بالأحدث. لمسة واحدة تعبّئ الوصف وتُطلق التخمين الذكي.
  const recentDescs = useMemo((): string[] => {
    if (!txs || editTxId) return [];
    const recent = txs
      .filter((t) => t.type === kind)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 120);
    const stats = new Map<string, { n: number; seen: number }>();
    recent.forEach((t, i) => {
      const text = t.description.trim();
      if (!text) return;
      const cur = stats.get(text);
      if (cur) cur.n += 1;
      else stats.set(text, { n: 1, seen: i });
    });
    return [...stats.entries()]
      .map(([text, s]) => ({ text, ...s }))
      .sort((a, b) => b.n - a.n || a.seen - b.seen)
      .slice(0, 6)
      .map((x) => x.text);
  }, [txs, kind, editTxId]);

  // وتيرة الميزانية الحية — لمعاينة «كم يتبقى بعد هذا؟» تحت المبلغ
  const pacing = useMemo(
    () => budgetPacing(settings ?? DEFAULT_SETTINGS, categories ?? [], txs ?? []),
    [settings, categories, txs]
  );
  const amountValue = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  // حساب افتراضي: أول حساب
  useEffect(() => {
    if (!accountId && activeAccounts.length > 0) setAccountId(activeAccounts[0].id);
  }, [accountId, activeAccounts]);

  // تصنيف ذكي من الوصف
  useEffect(() => {
    if (editTx || !desc.trim() || categoryId) return;
    let alive = true;
    void guessCategoryFor(desc, kind).then((c) => {
      if (alive && c) setCategoryId(c.id);
    });
    return () => {
      alive = false;
    };
  }, [desc]);

  const selectedGoal = goalId ? activeGoals.find((g) => g.id === goalId) ?? null : null;

  const save = async () => {
    if (busy) return;
    const value = parseFloat(amount);
    if (!(value > 0)) {
      toast.error("أدخل المبلغ من اللوحة أولاً");
      return;
    }
    if (!desc.trim()) {
      toast.error("أضف وصفاً قصيراً");
      return;
    }
    // لا حساب؟ يُنشأ «نقد» تلقائياً بدل رفض الحفظ — لا نهايات مسدودة (إصلاح «البانل لا يعمل»)
    let account = accountId;
    if (!account) {
      const ensured = await ensureDefaultAccount();
      account = ensured.account.id;
      if (ensured.created) {
        toast.info("أنشأنا حساب «نقد» لك تلقائياً", {
          description: "عدّل رصيده لاحقاً من المال ← الحسابات",
        });
      }
    }
    setBusy(true);
    try {
      if (editTxId && editTx) {
        await replaceTransaction(editTxId, {
          type: isTransfer ? "transfer" : kind,
          amount: value,
          description: desc,
          accountId: account,
          toAccountId: isTransfer ? toAccountId : undefined,
          categoryId: categoryId || undefined,
          merchant: merchant || undefined,
          tags,
          person: person || undefined,
          notes: notes || undefined,
          date: `${date}T${time}`,
        });
      } else {
        await addTransaction({
          type: kind,
          amount: value,
          description: desc,
          accountId: account,
          categoryId: categoryId || undefined,
          merchant: merchant || undefined,
          tags,
          person: person || undefined,
          notes: notes || undefined,
          date: `${date}T${time}`,
          source: "manual",
        });
        // ربط الدخل بهدف: بعد نجاح التسجيل يُضاف المبلغ لمحفوظ الهدف (بلا تحويل من حساب)
        if (kind === "income" && goalId) {
          await contributeGoal(goalId, value);
        }
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const previewVisible = !isTransfer && pacing.status !== "unset" && amountValue > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* المبلغ — العرض الكبير (مضغوط دائماً كي يتسع مع معاينة المسودة فوقه) */}
      <div className="px-4 pt-2 pb-2.5 shrink-0">
        <div className="glass rounded-2xl p-3 text-center">
          <p className="text-[10.5px] text-muted-foreground mb-1">
            {editTx ? "تعديل المعاملة" : kind === "income" ? "المبلغ المستلم" : "المبلغ المصروف"}
          </p>
          <p className="num-display text-[40px] leading-none text-primary tabular" dir="ltr">
            {displayAmount(amount, digits)}
            <span className="text-[15px] text-muted-foreground ms-1.5">{settings?.currency ?? "ر.س"}</span>
          </p>
        </div>
        {isTransfer && (
          <div className="flex items-center gap-2 mt-2.5 text-[11px] text-muted-foreground">
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan" />
            تحويل بين حسابين
          </div>
        )}
      </div>

      {/* اللوحة — LTR دائماً (§7.2) */}
      <div className="px-3 shrink-0">
        <NumberPad value={amount} onChange={setAmount} digits={digits} />
      </div>

      {/* التفاصيل — قابلة للتمرير، وزر الحفظ خارجها في التذييل الثابت */}
      <div className="overflow-y-auto sys-scroll px-4 pt-3 pb-2 space-y-3.5 flex-1 min-h-0">
        {/* معاينة الميزانية الحية — داخل التمرير كي لا تفيض الأقسام الثابتة */}
        {previewVisible && (
          <p
            className={cn(
              "glass rounded-xl px-3 py-2.5 text-[10.5px] leading-relaxed tabular",
              kind === "income" || pacing.todayRemaining - amountValue >= 0 ? "text-mint" : "text-coral"
            )}
          >
            {kind === "income"
              ? `هذا الدخل يرفع متبقي الشهر إلى ≈ ${formatMoney(pacing.monthRemaining + amountValue, currency)}`
              : `بعد هذا المصروف — متبقي اليوم ≈ ${formatMoney(pacing.todayRemaining - amountValue, currency)} · الأسبوع ≈ ${formatMoney(pacing.weekRemaining - amountValue, currency)}`}
          </p>
        )}
        {/* الأكثر تسجيلاً — في ماذا صرفت؟ بلمسة */}
        {!editTxId && !isTransfer && recentDescs.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11.5px] font-medium text-muted-foreground">الأكثر تسجيلاً</p>
            <div
              className="flex gap-2 overflow-x-auto sys-scroll -mx-1 px-1 pb-1"
              role="group"
              aria-label="الأوصاف الأكثر تسجيلاً — لمسة تعبّئ الوصف"
            >
              {recentDescs.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDesc(d)}
                  aria-label={`تعبئة الوصف: ${d}`}
                  className={cn(
                    "h-11 shrink-0 px-4 rounded-full border text-[12px] font-medium whitespace-nowrap transition-colors",
                    desc.trim() === d ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-white/[0.08]"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="الوصف">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={kind === "income" ? "مثال: دفعة مشروع" : "مثال: قهوة الصباح"}
            className={inputCls}
            dir="auto"
          />
        </Field>

        <Field label="الحساب">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="الحساب">
            {activeAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accountId === a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "h-11 px-4 rounded-xl border text-[12.5px] font-medium flex items-center gap-1.5 transition-colors",
                  accountId === a.id ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-white/[0.08]"
                )}
              >
                {(() => {
                  const I = iconByName(a.icon);
                  return <I className="w-4 h-4" style={{ color: a.color }} />;
                })()}
                {a.name}
              </button>
            ))}
            {activeAccounts.length === 0 && (
              <p className="text-[11.5px] text-primary/90">
                بلا حسابات بعد — سيُنشأ حساب «نقد» تلقائياً عند الحفظ ✓
              </p>
            )}
          </div>
        </Field>

        {isTransfer && (
          <Field label="إلى حساب">
            <div className="flex flex-wrap gap-2">
              {activeAccounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setToAccountId(a.id)}
                    className={cn(
                      "h-11 px-4 rounded-xl border text-[12.5px] font-medium transition-colors",
                      toAccountId === a.id ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-white/[0.08]"
                    )}
                  >
                    {a.name}
                  </button>
                ))}
            </div>
          </Field>
        )}

        {!isTransfer && kindCategories.length > 0 && (
          <Field label={categoryId ? "الفئة (ذكية ✓)" : "الفئة — تُخمَّن تلقائياً من الوصف"}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="الفئة">
              {kindCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                  className={cn(
                    "h-9 px-3 rounded-full border text-[11.5px] font-medium flex items-center gap-1.5 transition-colors",
                    categoryId === c.id ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-white/[0.08]"
                  )}
                >
                  {(() => {
                    const I = iconByName(c.icon);
                    return <I className="w-3.5 h-3.5" style={{ color: c.color }} />;
                  })()}
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* التاجر/المصدر — مباشرة بلا طي */}
        <Field
          label={
            isTransfer
              ? "التاجر / الجهة"
              : kind === "income"
                ? "الجهة / المصدر — من أين جاء الدخل؟"
                : "المتجر / الجهة — من أين اشتريت؟"
          }
        >
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={kind === "income" ? "مثال: شركة، عميل، متجر…" : "مثال: ستاربكس، تميمي…"}
            className={inputCls}
            dir="auto"
          />
        </Field>

        {/* مع من؟ — للأشخاص (مصروف فقط) */}
        {!isTransfer && kind === "expense" && (
          <Field label="مع من؟ (اختياري)" hint="يرتبط بنظام الأشخاص — يظهر في تفاصيل المعاملة">
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="مثال: خالد، العائلة…"
              className={inputCls}
              dir="auto"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
          </Field>
          <Field label="الوقت">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
          </Field>
        </div>

        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="min-h-11 flex items-center gap-1.5 text-[11px] text-primary/90 font-medium"
          type="button"
          aria-expanded={moreOpen}
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
          {moreOpen ? "إخفاء التفاصيل" : "تفاصيل أكثر (وسوم، ملاحظة…)"}
        </button>

        {moreOpen && (
          <div className="space-y-3.5">
            <Field label="وسوم (بفواصل)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="عمل, جانبي" className={inputCls} dir="auto" />
            </Field>
            <Field label="ملاحظة">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي تفصيل تريد تذكره…" className={textareaCls} dir="auto" />
            </Field>
          </div>
        )}

        {/* ربط الدخل بهدف — اجعله مساهمة ادخار (جديد فقط) */}
        {!isTransfer && !editTxId && kind === "income" && activeGoals.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setGoalOpen((v) => !v)}
              className="min-h-11 flex items-center gap-1.5 text-[11px] text-primary/90 font-medium"
              type="button"
              aria-expanded={goalOpen}
            >
              <PiggyBank className="w-3.5 h-3.5" aria-hidden="true" />
              {goalOpen ? "إخفاء ربط الهدف" : "اربط بهدف — اجعله مساهمة ادخار"}
              <ChevronUp className={cn("w-3.5 h-3.5 transition-transform", !goalOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {goalOpen && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="هدف الادخار">
                  {activeGoals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={goalId === g.id}
                      onClick={() => setGoalId(goalId === g.id ? "" : g.id)}
                      className={cn(
                        "h-11 px-4 rounded-full border text-[12.5px] font-medium flex items-center gap-1.5 transition-colors",
                        goalId === g.id ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-white/[0.08]"
                      )}
                    >
                      <span aria-hidden="true">{g.emoji}</span>
                      {g.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10.5px] text-muted-foreground/75 leading-relaxed">
                  {selectedGoal
                    ? `سيُضاف ${formatMoney(amountValue, currency)} إلى محفوظ «${selectedGoal.name}» بعد التسجيل — بلا تحويل من حساب`
                    : "اختر هدفاً ليُضاف المبلغ إلى محفوظه تلقائياً بعد تسجيل الدخل"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* زر الحفظ — ثابت في تذييل اللوحة، مرئي دائماً فوق لوحة المفاتيح (§7.2/8) */}
      <StickySave
        onSave={() => void save()}
        busy={busy}
        saveLabel={editTx ? "حفظ التعديل" : kind === "income" ? "سجّل الدخل" : "سجّل المصروف"}
      />
    </div>
  );
}
