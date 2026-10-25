"use client";

/**
 * نماذج الكيانات: مهمة · عادة · حدث تقويم · ملاحظة — كلها عالية التخصيص.
 */
import { useEffect, useState } from "react";
import { db, getSettings, useLive } from "@/lib/db";
import { addHabit, addNote, addTask, addBlock, updateHabit, updateTask, updateBlock, updateNote } from "@/lib/actions";
import type { Goal, Habit, Task, TimeBlock } from "@/lib/types";
import { nowHHMM, todayISO } from "@/lib/format";
import { BLOCK_TYPE_LABELS } from "@/lib/calendar-utils";
import { FormShell, Field, ChipRow, NumberPad, displayAmount, inputCls, textareaCls, IconGrid, ColorSwatches } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import type { QuickDraft } from "./quick-add-sheet";

const PRIORITY_LABELS = [
  { k: "low", v: "هادئة" },
  { k: "normal", v: "عادية" },
  { k: "high", v: "عاجلة" },
];

// ═══════════════════════ المهمة ═══════════════════════

export function TaskForm({ presetDate, draft }: { presetDate: string | null; draft: QuickDraft | null }) {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(presetDate ?? todayISO());
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("normal");
  const [est, setEst] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  // مسودة الالتقاط الطبيعي — تعبئة دفعة واحدة
  useEffect(() => {
    if (!draft) return;
    if (draft.kind === "task" || draft.kind === "note") {
      setTitle(draft.description);
      if (draft.date) setDate(draft.date);
      if (draft.time) setTime(draft.time);
    }
  }, [draft?.stamp]);

  const save = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await addTask({
        title: title.trim(),
        description: desc.trim() || undefined,
        date,
        time: time || undefined,
        priority: priority as Task["priority"],
        done: false,
        estimatedMinutes: est ? Number(est) : undefined,
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="عنوان المهمة">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تسليم تقرير الأسبوع" className={inputCls} dir="auto" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
        <Field label="الوقت (اختياري)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
      </div>
      <ChipRow label="الأهمية" options={PRIORITY_LABELS} value={priority} onSelect={setPriority} />
      <Field label="المدة التقديرية بالدقائق (اختياري)">
        <input
          type="number"
          inputMode="numeric"
          value={est}
          onChange={(e) => setEst(e.target.value)}
          placeholder="45"
          className={cn(inputCls, "tabular")}
          dir="ltr"
        />
      </Field>
      <Field label="تفاصيل (اختياري)">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="أي سياق يساعدك لاحقاً…" className={textareaCls} dir="auto" />
      </Field>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف المهمة" />
    </ScrollBody>
  );
}

// ═══════════════════════ العادة ═══════════════════════

export function HabitForm({ editHabit }: { editHabit?: Habit | null }) {
  const close = useUIStore((s) => s.closeQuickAdd);
  const goals = useLive<Goal[]>(() => db.goals.toArray(), []);
  const [name, setName] = useState(editHabit?.name ?? "");
  const [icon, setIcon] = useState(editHabit?.icon ?? "flame");
  const [color, setColor] = useState(editHabit?.color ?? "#5CE1E6");
  const [target, setTarget] = useState(editHabit ? String(editHabit.target) : "1");
  const [unit, setUnit] = useState(editHabit?.unit ?? "مرة");
  const [cadence, setCadence] = useState(editHabit?.cadence ?? "daily");
  const [daysPerWeek, setDaysPerWeek] = useState(String(editHabit?.daysPerWeek ?? 5));
  const [timer, setTimer] = useState(editHabit?.timerMinutes ? String(editHabit.timerMinutes) : "");
  const [remindAt, setRemindAt] = useState(editHabit?.remindAt ?? "");
  const [saveAmount, setSaveAmount] = useState(editHabit?.saveAmount ? String(editHabit.saveAmount) : "");
  const [goalId, setGoalId] = useState(editHabit?.goalId ?? "");
  const [busy, setBusy] = useState(false);

  const activeGoals = (goals ?? []).filter((g) => !g.archived);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        icon,
        color,
        target: Math.max(1, parseInt(target, 10) || 1),
        unit: unit.trim() || "مرة",
        cadence: cadence as Habit["cadence"],
        daysPerWeek: cadence === "weekly" ? Math.min(7, Math.max(1, parseInt(daysPerWeek, 10) || 5)) : undefined,
        timerMinutes: timer ? Math.max(1, parseInt(timer, 10)) : undefined,
        remindAt: remindAt || undefined,
        saveAmount: saveAmount && goalId ? Math.max(0, parseFloat(saveAmount) || 0) : undefined,
        goalId: saveAmount ? goalId || undefined : undefined,
        archived: false,
        order: editHabit?.order ?? 99,
      };
      if (editHabit) await updateHabit(editHabit.id, payload);
      else await addHabit(payload);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="اسم العادة">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: 8 أكواب ماء" className={inputCls} dir="auto" />
      </Field>
      <Field label="الأيقونة — اختر ما يميزها">
        <IconGrid value={icon} onChange={setIcon} />
      </Field>
      <Field label="اللون">
        <ColorSwatches value={color} onChange={setColor} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الهدف اليومي">
          <NumberPad value={target} onChange={setTarget} />
        </Field>
        <Field label="الوحدة">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="كوب / صفحة / دقيقة" className={inputCls} dir="auto" />
        </Field>
      </div>
      <ChipRow
        label="الإيقاع"
        options={[
          { k: "daily", v: "يومية" },
          { k: "weekly", v: "أسبوعية" },
        ]}
        value={cadence}
        onSelect={(k) => setCadence(k as "daily" | "weekly")}
      />
      {cadence === "weekly" && (
        <ChipRow
          label="أيام الالتزام في الأسبوع"
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ k: String(n), v: String(n) }))}
          value={daysPerWeek}
          onSelect={setDaysPerWeek}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="مؤقت تركيز (دقائق)" hint="اختياري — يفتح مؤقتاً عند الإنجاز">
          <input
            type="number"
            inputMode="numeric"
            value={timer}
            onChange={(e) => setTimer(e.target.value)}
            placeholder="20"
            className={cn(inputCls, "tabular")}
            dir="ltr"
          />
        </Field>
        <Field label="تذكير يومي" hint="اختياري — إشعار في وقته">
          <input type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
      </div>
      {activeGoals.length > 0 && (
        <div className="glass-soft rounded-2xl p-3.5 space-y-3">
          <p className="text-[11px] font-semibold text-primary/90">ربط الادخار (اختياري)</p>
          <p className="text-[10.5px] text-muted-foreground leading-relaxed">كل يوم تنجز فيه العادة يُضاف المبلغ تلقائياً للهدف — الترابط الحقيقي 🔗</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ لكل إنجاز">
              <NumberPad value={saveAmount} onChange={setSaveAmount} />
            </Field>
            <Field label="الهدف">
              <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={inputCls}>
                <option value="">بلا هدف</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji} {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}
      <FormShell onSave={() => void save()} busy={busy} saveLabel={editHabit ? "حفظ التعديل" : "أضف العادة"} />
    </ScrollBody>
  );
}

// ═══════════════════════ حدث التقويم ═══════════════════════

export function BlockForm({ presetDate, editBlock, draft }: { presetDate: string | null; editBlock?: TimeBlock | null; draft?: QuickDraft | null }) {
  const close = useUIStore((s) => s.closeQuickAdd);
  const tasks = useLive<Task[]>(() => db.tasks.toArray(), []);
  const habits = useLive<Habit[]>(() => db.habits.toArray(), []);
  const [title, setTitle] = useState(editBlock?.title ?? "");
  const [type, setType] = useState<TimeBlock["type"]>(editBlock?.type ?? "personal");
  const [date, setDate] = useState(editBlock?.date ?? presetDate ?? todayISO());
  const [start, setStart] = useState(editBlock?.startTime ?? nowHHMM());
  const [end, setEnd] = useState(editBlock ? editBlock.endTime : "");
  const [note, setNote] = useState(editBlock?.note ?? "");
  const [taskId, setTaskId] = useState(editBlock?.taskId ?? "");
  const [habitId, setHabitId] = useState(editBlock?.habitId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const openTasks = (tasks ?? []).filter((t) => !t.done);
  const activeHabits = (habits ?? []).filter((h) => !h.archived);

  const save = async () => {
    if (!title.trim() || busy) return;
    const startMin = start;
    let endV = end;
    if (!endV || endV <= start) {
      const [h, m] = start.split(":").map(Number);
      endV = `${String(Math.min(23, h + 1)).padStart(2, "0")}:${m}`;
    }
    if (endV <= start) {
      setErr("وقت النهاية يجب أن يكون بعد البداية");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        type,
        date,
        startTime: start,
        endTime: endV,
        note: note.trim() || undefined,
        taskId: taskId || undefined,
        habitId: habitId || undefined,
      };
      if (editBlock) await updateBlock(editBlock.id, payload);
      else await addBlock(payload);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <Field label="عنوان الحدث">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: جلسة تركيز عميقة" className={inputCls} dir="auto" />
      </Field>
      <ChipRow
        label="النوع"
        options={Object.entries(BLOCK_TYPE_LABELS).map(([k, v]) => ({ k, v }))}
        value={type}
        onSelect={(k) => setType(k as TimeBlock["type"])}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field label="التاريخ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
        <Field label="من">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
        <Field label="إلى">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={cn(inputCls, "tabular")} dir="ltr" />
        </Field>
      </div>
      {err && <p className="text-[11px] text-coral">{err}</p>}
      <Field label="ملاحظة (اختياري)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="أجندة الحدث…" className={textareaCls} dir="auto" />
      </Field>
      {openTasks.length > 0 && (
        <Field label="ربط بمهمة (اختياري)">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls}>
            <option value="">بلا ربط</option>
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      {activeHabits.length > 0 && (
        <Field label="ربط بعادة (اختياري)">
          <select value={habitId} onChange={(e) => setHabitId(e.target.value)} className={inputCls}>
            <option value="">بلا ربط</option>
            {activeHabits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <FormShell onSave={() => void save()} busy={busy} saveLabel={editBlock ? "حفظ الحدث" : "أضف الحدث"} />
    </ScrollBody>
  );
}

// ═══════════════════════ الملاحظة / اليومية ═══════════════════════

const MOOD_OPTIONS = [
  { k: "", v: "بلا مزاج" },
  { k: "😖", v: "😖 صعب" },
  { k: "🙁", v: "🙁 منخفض" },
  { k: "😐", v: "😐 عادي" },
  { k: "🙂", v: "🙂 جيد" },
  { k: "😄", v: "😄 ممتاز" },
];

export function NoteForm({ draft }: { draft: QuickDraft | null }) {
  const close = useUIStore((s) => s.closeQuickAdd);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"note" | "journal">("note");
  const [mood, setMood] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);

  // مسودة الالتقاط الطبيعي — تعبئة دفعة واحدة
  useEffect(() => {
    if (!draft) return;
    if (draft.kind === "note" || draft.kind === "task") {
      setTitle(draft.description.slice(0, 40));
      if (draft.tags.length > 0) setTags(draft.tags.join(", "));
    }
  }, [draft?.stamp]);

  const save = async () => {
    if ((!title.trim() && !content.trim()) || busy) return;
    setBusy(true);
    try {
      await addNote({
        title: title.trim() || content.trim().slice(0, 40),
        content: content.trim(),
        type,
        mood: mood || undefined,
        tags: tags.trim(),
        pinned,
        secret,
        date: todayISO(),
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollBody>
      <ChipRow
        label="النوع"
        options={[
          { k: "note", v: "ملاحظة سريعة" },
          { k: "journal", v: "يومية" },
        ]}
        value={type}
        onSelect={(k) => setType(k as "note" | "journal")}
      />
      <Field label="العنوان">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "journal" ? "يوم 12 — إنجاز صغير" : "فكرة التطبيق"} className={inputCls} dir="auto" />
      </Field>
      <Field label={type === "journal" ? "كيف كان يومك؟" : "النص"}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "journal" ? "اكتب بحرية — سطران يكفيان…" : "دوّن الفكرة قبل أن تهرب…"}
          className={cn(textareaCls, "min-h-[140px]")}
          dir="auto"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <ChipRow label="مزاج اليومية" options={MOOD_OPTIONS} value={mood} onSelect={setMood} small />
        <Field label="وسوم">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="أفكار, عمل" className={inputCls} dir="auto" />
        </Field>
      </div>
      <div className="flex gap-2">
        <ToggleChip active={pinned} onClick={() => setPinned(!pinned)} label="📌 تثبيت" />
        <ToggleChip active={secret} onClick={() => setSecret(!secret)} label="🔒 خاصة" />
      </div>
      <FormShell onSave={() => void save()} busy={busy} saveLabel={type === "journal" ? "دوّن اليومية" : "احفظ الملاحظة"} />
    </ScrollBody>
  );
}

function ToggleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-11 px-4 rounded-xl border text-[12px] font-medium transition-colors",
        active ? "bg-primary/20 border-primary/50 text-primary" : "glass-soft border-black/[0.07] text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ScrollBody({ children }: { children: React.ReactNode }) {
  return <div className="overflow-y-auto sys-scroll px-4 py-3 max-h-[62vh]">{children}</div>;
}

export { displayAmount };
