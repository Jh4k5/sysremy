"use client";

/**
 * نماذج الكيانات المالية: هدف · التزام متكرر · حساب · فئة · أصل · دين.
 */
import { useState } from "react";
import { db, useLive } from "@/lib/db";
import {
  addAccount, addAsset, addCategory, addDebt, addGoal, addRecurring,
} from "@/lib/actions";
import type { Account, Category, Goal } from "@/lib/types";
import { todayISO } from "@/lib/format";
import {
  FormShell, Field, ChipRow, NumberPad, displayAmount, inputCls, textareaCls,
  IconGrid, ColorSwatches, COLOR_CHOICES, ICON_CHOICES,
} from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

const GOAL_EMOJIS = ["🏠", "🚗", "✈️", "💻", "📚", "🎓", "💍", "🕌", "👜", "🎁", "🌙", "⭐", "🐳", "🌵"];

// ═══════════════════════ هدف ═══════════════════════

export function GoalForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌙");
  const [color, setColor] = useState("#F5B95C");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [monthly, setMonthly] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await addGoal({
        name: name.trim(),
        emoji,
        color,
        targetAmount: parseFloat(target) || 0,
        savedAmount: parseFloat(saved) || 0,
        monthly: parseFloat(monthly) || 0,
        targetDate: targetDate || undefined,
        archived: false,
        order: 99,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم الهدف">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: صندوق الطوارئ" className={inputCls} dir="auto" />
      </Field>
      <Field label="الرمز">
        <div className="flex flex-wrap gap-2">
          {GOAL_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={cn(
                "w-11 h-11 rounded-xl border text-[20px] transition-all",
                emoji === e ? "bg-primary/20 border-primary/50 scale-105" : "glass-soft border-black/[0.07]"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="اللون">
        <ColorSwatches value={color} onChange={setColor} />
      </Field>
      <Field label="المبلغ المستهدف">
        <NumberPad value={target} onChange={setTarget} />
      </Field>
      <Field label="ما ادخرت منه حتى الآن">
        <NumberPad value={saved} onChange={setSaved} />
      </Field>
      <Field label="المساهمة الشهرية" hint="تُقتطع من حساب الرصيد الآمن">
        <NumberPad value={monthly} onChange={setMonthly} />
      </Field>
      <Field label="تاريخ الهدف (اختياري)">
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الهدف" />
    </ScrollBody>
  );
}

// ═══════════════════════ التزام متكرر ═══════════════════════

export function RecurringForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const categories = useLive<Category[]>(() => db.categories.toArray(), []);
  const accounts = useLive<Account[]>(() => db.accounts.toArray(), []);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDate, setNextDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reminderDays, setReminderDays] = useState("2");
  const [icon, setIcon] = useState("receipt");
  const [busy, setBusy] = useState(false);

  const kindCats = (categories ?? []).filter((c) => !c.archived && c.kind === type);
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived);

  const save = async () => {
    if (!name.trim() || !(parseFloat(amount) > 0) || busy) return;
    setBusy(true);
    try {
      await addRecurring({
        name: name.trim(),
        amount: parseFloat(amount),
        type,
        frequency: frequency as "daily" | "weekly" | "monthly" | "yearly",
        nextDate,
        icon,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        active: true,
        reminderDays: parseInt(reminderDays, 10) || 0,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم الالتزام">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: نتفلكس / إيجار / راتب" className={inputCls} dir="auto" />
      </Field>
      <ChipRow
        label="النوع"
        options={[
          { k: "expense", v: "التزام عليّ" },
          { k: "income", v: "دخل متكرر" },
        ]}
        value={type}
        onSelect={(k) => {
          setType(k as "expense" | "income");
          setCategoryId("");
        }}
      />
      <Field label="المبلغ">
        <NumberPad value={amount} onChange={setAmount} />
      </Field>
      <ChipRow
        label="التكرار"
        options={[
          { k: "daily", v: "يومي" },
          { k: "weekly", v: "أسبوعي" },
          { k: "monthly", v: "شهري" },
          { k: "yearly", v: "سنوي" },
        ]}
        value={frequency}
        onSelect={setFrequency}
      />
      <Field label="تاريخ الاستحقاق القادم">
        <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
      </Field>
      {kindCats.length > 0 && (
        <Field label="الفئة">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">بلا فئة</option>
            {kindCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {activeAccounts.length > 0 && (
        <Field label="الحساب" hint="يسهّل السداد بنقرة واحدة">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">اختر لاحقاً</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <ChipRow
        label="تذكير قبل الاستحقاق"
        options={[
          { k: "0", v: "يومه" },
          { k: "1", v: "بيوم" },
          { k: "2", v: "بيومين" },
          { k: "3", v: "بثلاثة" },
        ]}
        value={reminderDays}
        onSelect={setReminderDays}
        small
      />
      <Field label="الأيقونة">
        <IconGrid value={icon} onChange={setIcon} choices={["receipt", "wallet", "banknote", "landmark", "home", "smartphone", "car-front", "heart-pulse", "graduation-cap", "gift"]} />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الالتزام" />
    </ScrollBody>
  );
}

// ═══════════════════════ حساب ═══════════════════════

export function AccountForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("cash");
  const [icon, setIcon] = useState("banknote");
  const [color, setColor] = useState("#F5B95C");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const count = await db.accounts.count();
      await addAccount({
        name: name.trim(),
        type,
        icon,
        color,
        startingBalance: parseFloat(balance) || 0,
        archived: false,
        order: count + 1,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم الحساب">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: نقد / الراجحي / stc pay" className={inputCls} dir="auto" />
      </Field>
      <ChipRow
        label="النوع"
        options={[
          { k: "cash", v: "نقد" },
          { k: "bank", v: "بنك" },
          { k: "wallet", v: "محفظة رقمية" },
          { k: "credit", v: "بطاقة ائتمان" },
          { k: "savings", v: "ادخار" },
        ]}
        value={type}
        onSelect={(k) => setType(k as Account["type"])}
      />
      <Field label="الرصيد الحالي" hint="نقطة البداية — كل معاملة بعدها تحدّثه تلقائياً">
        <NumberPad value={balance} onChange={setBalance} />
      </Field>
      <Field label="الأيقونة">
        <IconGrid value={icon} onChange={setIcon} choices={["banknote", "landmark", "smartphone", "credit-card", "piggy-bank", "wallet"]} />
      </Field>
      <Field label="اللون">
        <ColorSwatches value={color} onChange={setColor} />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الحساب" />
    </ScrollBody>
  );
}

// ═══════════════════════ فئة ═══════════════════════

export function CategoryForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState("shopping-bag");
  const [color, setColor] = useState("#5CE1E6");
  const [budget, setBudget] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const count = await db.categories.count();
      await addCategory({
        name: name.trim(),
        icon,
        color,
        kind,
        budget: kind === "expense" && parseFloat(budget) > 0 ? parseFloat(budget) : undefined,
        keywords: keywords.trim(),
        archived: false,
        order: count + 1,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم الفئة">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: بقالة / هوايات" className={inputCls} dir="auto" />
      </Field>
      <ChipRow
        label="النوع"
        options={[
          { k: "expense", v: "مصروف" },
          { k: "income", v: "دخل" },
        ]}
        value={kind}
        onSelect={(k) => setKind(k as "expense" | "income")}
      />
      <Field label="الأيقونة">
        <IconGrid value={icon} onChange={setIcon} choices={ICON_CHOICES} />
      </Field>
      <Field label="اللون">
        <ColorSwatches value={color} onChange={setColor} choices={COLOR_CHOICES} />
      </Field>
      {kind === "expense" && (
        <Field label="مظروف الميزانية الشهري" hint="يظهر كشريط تقدم في شاشة المال">
          <NumberPad value={budget} onChange={setBudget} />
        </Field>
      )}
      <Field label="كلمات التصنيف الذكي" hint="مفصولة بفواصل — تُطابق تلقائياً عند الكتابة أو الالتقاط">
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="تميمي, سلة, بقالة" className={inputCls} dir="auto" />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الفئة" />
    </ScrollBody>
  );
}

// ═══════════════════════ أصل ═══════════════════════

export function AssetForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [icon, setIcon] = useState("package");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || !(parseFloat(value) > 0) || busy) return;
    setBusy(true);
    try {
      await addAsset({
        name: name.trim(),
        type: type.trim() || "أخرى",
        value: parseFloat(value),
        unit: unit.trim() || undefined,
        icon,
        note: note.trim() || undefined,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم الأصل">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: سيارتي / ذهب / محفظة أسهم" className={inputCls} dir="auto" />
      </Field>
      <ChipRow
        label="النوع"
        options={[
          { k: "سيارة", v: "سيارة" },
          { k: "عقار", v: "عقار" },
          { k: "ذهب", v: "ذهب" },
          { k: "استثمار", v: "استثمار" },
          { k: "أخرى", v: "أخرى" },
        ]}
        value={type}
        onSelect={setType}
      />
      <Field label="القيمة التقديرية">
        <NumberPad value={value} onChange={setValue} />
      </Field>
      <Field label="الوحدة (اختياري)">
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="غرام / سهم / متر" className={inputCls} dir="auto" />
      </Field>
      <Field label="الأيقونة">
        <IconGrid value={icon} onChange={setIcon} choices={["package", "car-front", "home", "star", "trophy", "wallet", "landmark"]} />
      </Field>
      <Field label="ملاحظة (اختياري)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} dir="auto" />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الأصل" />
    </ScrollBody>
  );
}

// ═══════════════════════ دين ═══════════════════════

export function DebtForm() {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [name, setName] = useState("");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"payable" | "receivable">("payable");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || !(parseFloat(amount) > 0) || busy) return;
    setBusy(true);
    try {
      await addDebt({
        name: name.trim(),
        person: person.trim() || "—",
        amount: parseFloat(amount),
        paid: 0,
        direction,
        dueDate: dueDate || undefined,
        note: note.trim() || undefined,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <ChipRow
        label="الاتجاه"
        options={[
          { k: "payable", v: "عليّ (أدين به)" },
          { k: "receivable", v: "لي (دَين لي عند شخص)" },
        ]}
        value={direction}
        onSelect={(k) => setDirection(k as "payable" | "receivable")}
      />
      <Field label="عنوان الدين">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قرض الشهر الماضي" className={inputCls} dir="auto" />
      </Field>
      <Field label="الشخص">
        <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="مثال: أحمد" className={inputCls} dir="auto" />
      </Field>
      <Field label="المبلغ">
        <NumberPad value={amount} onChange={setAmount} />
      </Field>
      <Field label="تاريخ الاستحقاق (اختياري)">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
      </Field>
      <Field label="ملاحظة (اختياري)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} dir="auto" />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف الدين" />
    </ScrollBody>
  );
}

function ScrollBody({ children }: { children: React.ReactNode }) {
  return <div className="overflow-y-auto sys-scroll px-4 py-3 max-h-[62vh]">{children}</div>;
}

export { displayAmount };
