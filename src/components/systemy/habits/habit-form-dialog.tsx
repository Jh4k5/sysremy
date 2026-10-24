"use client";

/**
 * Systemy v2 — نموذج إضافة/تعديل عادة (درج سفلي)
 * اسم + أيقونة + لون + هدف يومي (لوحة أرقام) + وحدة + إيقاع (يومية/أسبوعية
 * بأيام الالتزام) + مؤقت اختياري + تذكير يومي + ربط ادخار بمبلغ يُضاف
 * للهدف عند إنجاز اليوم — وأرشفة/حذف للعادات الموجودة.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { addHabit, deleteHabit, updateHabit } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import type { DigitStyle, Goal, Habit, HabitCadence } from "@/lib/types";
import {
  ChipRow,
  ColorSwatches,
  ConfirmBar,
  Field,
  FormShell,
  IconGrid,
  NumberPad,
  inputCls,
} from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

const TIMER_PRESETS = [5, 10, 15, 20, 30, 45];

const REMIND_PRESETS: Array<{ time: string; label: string }> = [
  { time: "07:00", label: "7 صباحاً" },
  { time: "12:00", label: "12 ظهراً" },
  { time: "17:00", label: "5 عصراً" },
  { time: "21:00", label: "9 مساءً" },
  { time: "23:00", label: "11 ليلاً" },
];

const DAYS_OPTIONS = [
  { k: "1", v: "يوم" },
  { k: "2", v: "يومان" },
  { k: "3", v: "3 أيام" },
  { k: "4", v: "4 أيام" },
  { k: "5", v: "5 أيام" },
  { k: "6", v: "6 أيام" },
  { k: "7", v: "كل يوم" },
];

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-white/[0.08] px-4 text-[13.5px] text-foreground focus:ring-0";

export interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** عادة موجودة للتعديل — null لإضافة جديدة */
  habit: Habit | null;
  goals: Goal[];
  /** ترتيب العادة الجديدة */
  nextOrder: number;
  digits: DigitStyle;
  currency: string;
}

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
  goals,
  nextOrder,
  digits,
  currency,
}: HabitFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("flame");
  const [color, setColor] = useState("#5CE1E6");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("");
  const [cadence, setCadence] = useState<HabitCadence>("daily");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [timerOn, setTimerOn] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("15");
  const [remindOn, setRemindOn] = useState(false);
  const [remindAt, setRemindAt] = useState("21:00");
  const [saveOn, setSaveOn] = useState(false);
  const [saveAmount, setSaveAmount] = useState("5");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? "");
    setIcon(habit?.icon?.toLowerCase() ?? "flame");
    setColor(habit?.color ?? "#5CE1E6");
    setTarget(String(Math.max(1, habit?.target ?? 1)));
    setUnit(habit?.unit && habit.unit !== "مرة" ? habit.unit : "");
    setCadence(habit?.cadence ?? "daily");
    setDaysPerWeek(String(habit?.daysPerWeek ?? 3));
    setTimerOn(habit?.timerMinutes != null);
    setTimerMinutes(String(habit?.timerMinutes ?? 15));
    setRemindOn(habit?.remindAt != null);
    setRemindAt(habit?.remindAt ?? "21:00");
    setSaveOn(habit?.saveAmount != null && habit?.goalId != null);
    setSaveAmount(String(habit?.saveAmount ?? 5));
    setGoalId(habit?.goalId ?? "");
    setConfirmDelete(false);
  }, [open, habit]);

  const activeGoals = goals.filter((g) => !g.archived);
  const linkedGoal = activeGoals.find((g) => g.id === goalId);
  const savePreview =
    saveOn && linkedGoal && Number(saveAmount) > 0
      ? `كل يوم تُنجزه يضيف ${formatMoney(Number(saveAmount), currency)} إلى «${linkedGoal.name}»`
      : null;

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("اكتب اسم العادة");
      return;
    }
    const targetNum = Math.max(1, Math.min(99, Math.round(Number(target) || 1)));

    let timerNum: number | undefined;
    if (timerOn) {
      const t = Math.round(Number(timerMinutes));
      if (!(t >= 1 && t <= 180)) {
        toast.error("مدة المؤقت بين دقيقة و180 دقيقة");
        return;
      }
      timerNum = t;
    }

    let saveNum: number | undefined;
    let goal: string | undefined;
    if (saveOn) {
      const amt = Number(saveAmount);
      if (!(amt > 0)) {
        toast.error("أدخل مبلغ مكافأة أكبر من صفر");
        return;
      }
      if (!goalId) {
        toast.error("اختر هدفاً لربط الادخار");
        return;
      }
      saveNum = Math.round(amt * 100) / 100;
      goal = goalId;
    }

    setBusy(true);
    try {
      const payload = {
        name: cleanName,
        icon: icon.toLowerCase(),
        color,
        target: targetNum,
        unit: unit.trim() || "مرة",
        cadence,
        daysPerWeek: cadence === "weekly" ? Math.max(1, Math.min(7, Number(daysPerWeek))) : undefined,
        timerMinutes: timerNum,
        remindAt: remindOn && /^\d{2}:\d{2}$/.test(remindAt) ? remindAt : undefined,
        saveAmount: saveNum,
        goalId: goal,
        archived: habit?.archived ?? false,
        order: habit?.order ?? nextOrder,
      };
      if (habit) {
        await updateHabit(habit.id, payload);
      } else {
        await addHabit(payload);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    if (!habit) return;
    setBusy(true);
    try {
      await updateHabit(habit.id, { archived: !habit.archived });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!habit) return;
    setBusy(true);
    try {
      await deleteHabit(habit.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {habit ? "تعديل العادة" : "عادة جديدة"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            سلاسل، مؤقت، وربط ادخار — كل شيء يترابط تلقائياً
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[72vh] space-y-4 overflow-y-auto px-4 pb-4 pt-2">
          {/* الاسم */}
          <Field label="اسم العادة">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قراءة قبل النوم"
              maxLength={40}
              className={inputCls}
              aria-label="اسم العادة"
            />
          </Field>

          {/* الأيقونة واللون */}
          <Field label="الأيقونة">
            <IconGrid value={icon} onChange={(i) => setIcon(i.toLowerCase())} />
          </Field>
          <Field label="اللون">
            <ColorSwatches value={color} onChange={setColor} />
          </Field>

          {/* الهدف اليومي + الوحدة */}
          <Field label={`الهدف اليومي (${unit.trim() || "مرة"})`} hint="مثال: 8 أكواب ماء — أو 1 إن كانت مرة واحدة تكفي">
            <NumberPad
              value={target}
              onChange={(v) => setTarget(v)}
              digits={digits}
              label="لوحة إدخال الهدف اليومي"
            />
          </Field>
          <Field label="وحدة القياس (اختيارية)">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="كوب · صفحة · دقيقة · مرة"
              maxLength={12}
              className={inputCls}
              aria-label="وحدة القياس"
            />
          </Field>

          {/* الإيقاع */}
          <ChipRow
            label="إيقاع العادة"
            options={[
              { k: "daily", v: "يومية" },
              { k: "weekly", v: "أسبوعية" },
            ]}
            value={cadence}
            onSelect={(k) => setCadence(k === "weekly" ? "weekly" : "daily")}
            small
          />
          {cadence === "weekly" && (
            <ChipRow
              label="أيام الالتزام أسبوعياً"
              options={DAYS_OPTIONS}
              value={daysPerWeek}
              onSelect={setDaysPerWeek}
              small
            />
          )}

          {/* المؤقت */}
          <div className="space-y-2">
            <div className="flex h-14 items-center justify-between gap-3 rounded-xl glass-soft px-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">مؤقت تركيز اختياري</p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  جلسة بعدّ تنازلي عند البدء
                </p>
              </div>
              <Switch checked={timerOn} onCheckedChange={setTimerOn} aria-label="تفعيل المؤقت" />
            </div>
            {timerOn && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2" role="group" aria-label="مدد المؤقت المقترحة">
                  {TIMER_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTimerMinutes(String(m))}
                      aria-pressed={Number(timerMinutes) === m}
                      className={cn(
                        "h-10 rounded-xl border px-3.5 text-[12px] font-bold transition-colors",
                        Number(timerMinutes) === m
                          ? "border-primary/60 bg-primary/20 text-primary"
                          : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="tabular">{m}</span> د
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={180}
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  className={cn(inputCls, "tabular")}
                  dir="ltr"
                  aria-label="مدة المؤقت بالدقائق"
                />
              </div>
            )}
          </div>

          {/* التذكير اليومي */}
          <div className="space-y-2">
            <div className="flex h-14 items-center justify-between gap-3 rounded-xl glass-soft px-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">تذكير يومي</p>
                <p className="text-[10px] leading-tight text-muted-foreground">تنبيه في وقته المحدد</p>
              </div>
              <Switch checked={remindOn} onCheckedChange={setRemindOn} aria-label="تفعيل التذكير اليومي" />
            </div>
            {remindOn && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2" role="group" aria-label="أوقات التذكير المقترحة">
                  {REMIND_PRESETS.map((p) => (
                    <button
                      key={p.time}
                      type="button"
                      onClick={() => setRemindAt(p.time)}
                      aria-pressed={remindAt === p.time}
                      className={cn(
                        "h-10 rounded-xl border px-3.5 text-[12px] font-bold transition-colors",
                        remindAt === p.time
                          ? "border-primary/60 bg-primary/20 text-primary"
                          : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value || "21:00")}
                  className={cn(inputCls, "tabular")}
                  aria-label="وقت التذكير"
                />
              </div>
            )}
          </div>

          {/* ربط الادخار */}
          <div className="space-y-2">
            <div className="flex h-14 items-center justify-between gap-3 rounded-xl glass-soft px-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">اربطها بهدف ادخار</p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  كل إنجاز يضيف هذا المبلغ للهدف
                </p>
              </div>
              <Switch checked={saveOn} onCheckedChange={setSaveOn} aria-label="ربط العادة بهدف ادخار" />
            </div>
            {saveOn && (
              <div className="space-y-3">
                {activeGoals.length > 0 ? (
                  <>
                    <Field label="الهدف">
                      <Select value={goalId || "none"} onValueChange={(v) => setGoalId(v === "none" ? "" : v)} dir="rtl">
                        <SelectTrigger className={selectTriggerCls} aria-label="اختيار الهدف">
                          <SelectValue placeholder="اختر هدفاً" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-white/10 bg-[#10152a]">
                          <SelectItem value="none">بدون</SelectItem>
                          {activeGoals.map((g) => (
                            <SelectItem key={g.id} value={g.id} className="text-[13px]">
                              {g.emoji} {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="مكافأة اليوم المنجز">
                      <NumberPad
                        value={saveAmount}
                        onChange={setSaveAmount}
                        digits={digits}
                        label="لوحة إدخال مبلغ المكافأة"
                      />
                    </Field>
                    {savePreview && (
                      <p className="rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-[11px] font-medium text-primary/90">
                        {savePreview}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="rounded-xl glass-soft px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    لا أهداف بعد — أنشئ هدفاً من شاشة المال أولاً، ثم اربطه هنا ليتراكم بالإنجاز اليومي.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* أرشفة / حذف (للموجودة) + زر الحفظ */}
          <FormShell onSave={() => void save()} busy={busy} saveLabel={habit ? "حفظ التعديل" : "إضافة العادة"}>
            {habit && !confirmDelete && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void toggleArchive()}
                  disabled={busy}
                  className="h-12 flex-1 rounded-2xl glass-soft border border-white/[0.08] text-[12.5px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {habit.archived ? "استعادة من الأرشيف" : "أرشفة"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="h-12 flex-1 rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            )}
            {habit && confirmDelete && (
              <ConfirmBar
                message={`حذف «${habit.name}» نهائياً مع كل سجلاتها؟ لا يمكن التراجع.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </FormShell>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
