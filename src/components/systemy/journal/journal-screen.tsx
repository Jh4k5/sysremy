"use client";

/**
 * Systemy v3 — شاشة العقل واليوميات (اليوميات + المزاج)
 * قراءة واحدة useLive (notes + moods + settings) وكل الكتابة عبر actions.
 * الملاحظات والمعرفة صارت لها نظامها الخاص — هنا اليوميات فقط.
 * التفاعلية: أي إضافة/تعديل/حذف ينعكس فوراً هنا وفي كل الشاشات الأخرى.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  History,
  Lock,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Chip, GlassCard, SectionHeader, widgetEnter } from "@/components/systemy/glass";
import { ConfirmBar, EmptyState } from "@/components/systemy/ui-bits";
import { db, getSettings, useLive } from "@/lib/db";
import { addNote, deleteNote, saveMood, updateNote } from "@/lib/actions";
import {
  MOOD_FACES,
  MOOD_LABELS,
  addDaysISO,
  diffDays,
  formatDate,
  formatNumber,
  todayISO,
} from "@/lib/format";
import type { Mood, Note, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══ مكتبة سؤال اليوم — تتناوب حسب التاريخ ═══ */
const DAILY_QUESTIONS = [
  "بماذا أنت ممتن اليوم؟",
  "ما الشيء الصغير الذي أسعدك؟",
  "ما أهم قرار اتخذته هذا الأسبوع؟",
  "ما الذي أرهقك اليوم، وماذا علّمك؟",
  "لو أعدت اليوم من جديد، ما الذي ستفعله بطريقة مختلفة؟",
  "ما الشيء الذي تريد التوقف عن تأجيله؟",
  "من الشخص الذي أثّر فيك هذا الأسبوع، وكيف؟",
  "ما الجيد الذي حدث ولم تنتبه له إلا الآن؟",
  "أين أنت الآن مقارنة بشهر مضى؟",
  "ما الشيء الذي تريد تذكّره بعد سنة؟",
];

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

const TODAY_QUESTION = DAILY_QUESTIONS[dayOfYear(new Date()) % DAILY_QUESTIONS.length];

/* ═══ الفلاتر ═══ */
type FilterKey = "all" | "pinned" | "secret";
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "pinned", label: "المثبتة" },
  { key: "secret", label: "خاصة" },
];

/* ═══ لون خلية المزاج حسب الدرجة ═══ */
function moodCellColor(score: number): string {
  switch (score) {
    case 1:
      return "#FF8E7A";
    case 2:
      return "#F5B95C";
    case 3:
      return "#C4B5FD";
    case 4:
      return "#6EE7A8";
    default:
      return "#5CE1E6";
  }
}

/** حزمة بيانات اليوميات — قراءة تفاعلية واحدة */
interface JournalData {
  notes: Note[];
  moods: Mood[];
  settings: Settings;
}

/* ═══ حالة المحرر ═══ */
interface EditorState {
  id: string | null;
  title: string;
  content: string;
  type: "note" | "journal";
  mood: string | null;
  tags: string;
  pinned: boolean;
  secret: boolean;
  date: string;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** وصف زمني دافئ لتدوينة — «اليوم / أمس / قبل N يوم» */
function noteWhen(date: string): string {
  const n = diffDays(todayISO(), date);
  if (n === 0) return "اليوم";
  if (n === -1) return "أمس";
  if (n < -1 && n >= -30) return `قبل ${formatNumber(-n)} يوم`;
  return formatDate(date);
}

function editorFromNote(n: Note): EditorState {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type,
    mood: n.mood ?? null,
    tags: parseTags(n.tags).join("، "),
    pinned: n.pinned,
    secret: n.secret,
    date: n.date,
  };
}

/* ═══ بطاقة ملاحظة ═══ */
function NoteCard({
  note,
  onOpen,
  onReveal,
  revealed,
  delay,
}: {
  note: Note;
  onOpen: () => void;
  onReveal: () => void;
  revealed: boolean;
  delay: number;
}) {
  const moodIdx = note.mood ? MOOD_LABELS.indexOf(note.mood) : -1;
  const tags = parseTags(note.tags).slice(0, 3);
  const hidden = note.secret && !revealed;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.24, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={hidden ? onReveal : onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (hidden) onReveal();
          else onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={hidden ? `كشف اليومية الخاصة: ${note.title}` : `فتح اليومية: ${note.title}`}
      className="glass rounded-2xl p-3.5 cursor-pointer outline-none transition-all duration-200 hover:bg-black/[0.04] hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-2">
        {note.pinned && <Pin className="w-3.5 h-3.5 mt-1 shrink-0 text-primary fill-primary/25" aria-label="مثبتة" />}
        <h3 className={cn("flex-1 min-w-0 text-[13px] font-semibold leading-snug", hidden && "select-none")}>
          {note.title}
        </h3>
        {note.secret && (
          <Chip className="shrink-0 text-lav">
            <Lock className="w-3 h-3" aria-hidden="true" />
            خاصة
          </Chip>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-2",
          hidden && "blur-[5px] select-none"
        )}
      >
        {note.content}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/80">{noteWhen(note.date)}</span>
        {moodIdx >= 0 && (
          <span className="text-[13px] leading-none" title={note.mood ?? ""}>
            {MOOD_FACES[moodIdx]}
          </span>
        )}
        {tags.map((t) => (
          <Chip key={t} className="text-muted-foreground">
            {t}
          </Chip>
        ))}
        {hidden && (
          <span className="ms-auto text-[10px] text-lav/90 flex items-center gap-1">
            <Eye className="w-3 h-3" aria-hidden="true" />
            انقر للكشف
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ═══ هيكل التحميل ═══ */
function JournalSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28" aria-busy="true" aria-label="جارٍ تحميل اليوميات">
      <div className="h-14 mb-4 space-y-2">
        <Skeleton className="h-7 w-44 rounded-lg bg-black/[0.04]" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-black/[0.04]" />
      </div>
      <Skeleton className="h-11 rounded-2xl bg-black/[0.03] mb-3" />
      <Skeleton className="h-[132px] rounded-3xl bg-black/[0.03] mb-3" />
      <Skeleton className="h-[168px] rounded-3xl bg-black/[0.03] mb-3" />
      <Skeleton className="h-11 rounded-full bg-black/[0.03] mb-3" />
      <div className="space-y-2.5">
        <Skeleton className="h-[76px] rounded-2xl bg-black/[0.04]" />
        <Skeleton className="h-[76px] rounded-2xl bg-black/[0.04]" />
        <Skeleton className="h-[76px] rounded-2xl bg-black/[0.04]" />
      </div>
    </div>
  );
}

/* ═══ شاشة العقل واليوميات ═══ */
export function JournalScreen() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);

  /* ─── القراءة التفاعلية الوحيدة ─── */
  const data = useLive(async (): Promise<JournalData> => {
    const [notes, moods, settings] = await Promise.all([
      db.notes.toArray(),
      db.moods.toArray(),
      getSettings(),
    ]);
    return { notes, moods, settings };
  }, []);

  const today = todayISO();
  /** اليوميات فقط — الملاحظات لها نظامها الخاص الآن */
  const notesArr = useMemo(() => (data?.notes ?? []).filter((n) => n.type === "journal"), [data]);
  const moodsArr = useMemo(() => data?.moods ?? [], [data]);

  /* ─── المزاج ─── */
  const moodByDate = useMemo(() => {
    const m = new Map<string, Mood>();
    for (const x of moodsArr) m.set(x.date, x);
    return m;
  }, [moodsArr]);

  const moodToday = moodByDate.get(today) ?? null;

  /** شريط آخر 30 يوماً — الأقدم يميناً باتجاه القراءة */
  const moodDays = useMemo(() => {
    const out: Array<{ iso: string; score: number | null }> = [];
    for (let i = 29; i >= 0; i--) {
      const iso = addDaysISO(today, -i);
      out.push({ iso, score: moodByDate.get(iso)?.score ?? null });
    }
    return out;
  }, [moodByDate, today]);

  const moodAvg = useMemo(() => {
    const scores = moodDays.map((d) => d.score).filter((s): s is number => s != null);
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [moodDays]);

  /* ─── البحث (محلي) + الترتيب: المثبتة ثم الأحدث ─── */
  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = query
      ? notesArr.filter(
          (n) =>
            n.title.toLowerCase().includes(query) ||
            n.content.toLowerCase().includes(query) ||
            n.tags.toLowerCase().includes(query)
        )
      : notesArr;
    return [...base].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.date.localeCompare(a.date) ||
        b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [notesArr, q]);

  const counts = useMemo(() => {
    return {
      all: searched.length,
      pinned: searched.filter((n) => n.pinned).length,
      secret: searched.filter((n) => n.secret).length,
    } as Record<FilterKey, number>;
  }, [searched]);

  const filtered = useMemo(() => {
    return searched.filter((n) =>
      filter === "all" ? true : filter === "pinned" ? n.pinned : n.secret
    );
  }, [searched, filter]);

  /* ─── «في مثل هذا اليوم» ─── */
  const memories = useMemo(() => {
    if (q.trim()) return [];
    const now = new Date();
    return notesArr.filter((n) => {
      const d = new Date(n.date + "T12:00:00");
      return (
        d.getFullYear() < now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        Math.abs(d.getDate() - now.getDate()) <= 1
      );
    });
  }, [notesArr, q]);

  /* ─── المزاج: نقرة واحدة عبر action ─── */
  async function handleMood(score: number) {
    if (moodSaving) return;
    setMoodSaving(true);
    try {
      await saveMood(score);
      setMoodPickerOpen(false);
    } finally {
      setMoodSaving(false);
    }
  }

  /* ─── المحرر ─── */
  function openNew(title = "") {
    setEditor({
      id: null,
      title,
      content: "",
      type: "journal",
      mood: moodToday ? MOOD_LABELS[moodToday.score - 1] : null,
      tags: "",
      pinned: false,
      secret: false,
      date: today,
    });
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function openView(n: Note) {
    setEditor(editorFromNote(n));
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function patchEditor(patch: Partial<EditorState>) {
    setEditor((e) => (e ? { ...e, ...patch } : e));
  }

  async function saveNote() {
    if (!editor || saving) return;
    if (!editor.title.trim() && !editor.content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: editor.title.trim() || "بلا عنوان",
        content: editor.content.trim(),
        type: editor.type,
        mood: editor.mood ?? undefined,
        tags: parseTags(editor.tags).join("، "),
        pinned: editor.pinned,
        secret: editor.secret,
      };
      if (editor.id) {
        await updateNote(editor.id, payload);
      } else {
        await addNote({ ...payload, date: editor.date });
      }
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function togglePin() {
    if (!editor) return;
    const next = !editor.pinned;
    patchEditor({ pinned: next });
    if (editor.id) await updateNote(editor.id, { pinned: next });
  }

  async function toggleSecret() {
    if (!editor) return;
    const next = !editor.secret;
    patchEditor({ secret: next });
    if (editor.id) await updateNote(editor.id, { secret: next });
  }

  async function handleDelete() {
    if (!editor?.id || saving) return;
    setSaving(true);
    try {
      await deleteNote(editor.id);
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <JournalSkeleton />;

  const showMoodPicker = moodToday == null || moodPickerOpen;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">العقل واليوميات</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">يومياتك ومزاجك — بيت العقل في Systemy</p>
          </div>
          <button
            type="button"
            onClick={() => openNew()}
            aria-label="يومية جديدة"
            className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/35 text-primary flex items-center gap-1.5 text-[13px] font-bold transition-all duration-200 hover:bg-primary/25 hover:scale-[1.02] active:scale-95 glow-gold"
          >
            <Plus className="w-4 h-4" />
            يومية
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip className="text-muted-foreground">{formatNumber(notesArr.length)} يومية</Chip>
          <Chip className="text-lav">
            <Lock className="w-3 h-3" aria-hidden="true" />
            {formatNumber(notesArr.filter((n) => n.secret).length)} خاصة
          </Chip>
        </div>

        <div className="relative mt-3">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في العنوان أو المحتوى أو الوسوم…"
            aria-label="البحث في اليوميات"
            className="glass-soft h-11 rounded-2xl ps-10 pe-10 text-[12.5px] border-white/10 bg-transparent placeholder:text-muted-foreground/70 focus-visible:ring-primary/25"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="مسح البحث"
              className="absolute end-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-soft flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ═══ سؤال اليوم ═══ */}
      <motion.div {...widgetEnter(0.05)}>
        <GlassCard className="p-4 mb-3 glow-gold">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-[18px] h-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold text-primary/90">سؤال اليوم</div>
              <p className="mt-1 text-[14px] font-semibold leading-relaxed">{TODAY_QUESTION}</p>
            </div>
          </div>
          <Button
            onClick={() => openNew(`يوميات — ${formatDate(new Date())}`)}
            className="mt-3 w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/90"
          >
            أجب الآن
          </Button>
        </GlassCard>
      </motion.div>

      {/* ═══ المزاج + شريط 30 يوماً ═══ */}
      <motion.div {...widgetEnter(0.12)}>
        <GlassCard className="p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12.5px] font-semibold">كيف حالك اليوم؟</span>
            {moodAvg != null ? (
              <Chip className="text-mint">متوسط 30 يوماً {formatNumber(moodAvg, 1)}</Chip>
            ) : (
              <Chip className="text-muted-foreground">بلا تسجيلات بعد</Chip>
            )}
          </div>

          {/* الشريط: 30 خلية — الأقدم يميناً */}
          <div className="flex items-center gap-[3px]" role="img" aria-label="شريط المزاج لآخر 30 يوماً">
            {moodDays.map(({ iso, score }) => {
              const isToday = iso === today;
              if (score == null && isToday) {
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setMoodPickerOpen(true)}
                    aria-label="سجّل مزاج اليوم"
                    title="سجّل مزاج اليوم"
                    className="flex-1 h-5 min-w-0 rounded-[4px] bg-primary/10 ring-1 ring-inset ring-primary/70 hover:bg-primary/20 transition-colors"
                  />
                );
              }
              return (
                <span
                  key={iso}
                  title={`${formatDate(iso)}${score != null ? ` · ${MOOD_LABELS[score - 1]}` : ""}`}
                  className={cn("flex-1 h-5 min-w-0 rounded-[4px]", score == null && "bg-black/[0.03]")}
                  style={
                    score != null
                      ? { backgroundColor: moodCellColor(score), opacity: 0.4 + score * 0.12 }
                      : undefined
                  }
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-muted-foreground/70">
            <span>قبل 30 يوماً</span>
            <span>اليوم</span>
          </div>

          {/* الملتقط الصغير — يظهر عند نقرة خانة اليوم الفارغة */}
          <AnimatePresence initial={false}>
            {showMoodPicker ? (
              <motion.div
                key="picker"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="mt-3 mb-2 text-[10.5px] text-muted-foreground">
                  {moodToday ? "غيّر مزاج اليوم —" : "نقرة واحدة تكفي — بلا أسئلة طويلة"}
                </p>
                <div className="flex items-center justify-between gap-1.5">
                  {MOOD_FACES.map((face, i) => {
                    const score = i + 1;
                    const selected = moodToday?.score === score;
                    return (
                      <motion.button
                        key={score}
                        type="button"
                        disabled={moodSaving}
                        onClick={() => void handleMood(score)}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: selected ? 1.14 : 1, opacity: moodSaving ? 0.6 : 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 15 }}
                        aria-label={MOOD_LABELS[i]}
                        title={MOOD_LABELS[i]}
                        className={cn(
                          "w-12 h-12 rounded-full text-[22px] flex items-center justify-center glass-soft transition-colors duration-200 hover:bg-black/[0.05] disabled:cursor-wait",
                          selected && "ring-2 ring-primary shadow-[0_0_20px_-4px_rgba(245,185,92,0.55)]"
                        )}
                      >
                        {face}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="collapsed"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setMoodPickerOpen(true)}
                className="mt-3 w-full h-11 rounded-2xl glass-soft border border-black/[0.05] flex items-center justify-center gap-2 text-[12px] text-foreground/85 hover:bg-black/[0.04] transition-colors"
              >
                اليوم: {MOOD_FACES[moodToday.score - 1]} {MOOD_LABELS[moodToday.score - 1]}
                <span className="text-primary font-medium">انقر للتغيير</span>
              </motion.button>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ═══ في مثل هذا اليوم ═══ */}
      <AnimatePresence>
        {memories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-4"
          >
            <SectionHeader title="في مثل هذا اليوم" icon={<History className="w-3.5 h-3.5 text-lav" />} />
            {memories.slice(0, 2).map((m) => (
              <GlassCard
                key={m.id}
                interactive
                onClick={() => openView(m)}
                className="p-3.5 mb-2 border-lav/20"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Chip className="text-lav">قبل سنة تقريباً</Chip>
                  <span className="text-[10px] text-muted-foreground">{formatDate(m.date, true)}</span>
                </div>
                <p className="text-[12.5px] font-semibold">{m.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{m.content}</p>
                <span className="inline-block mt-2 text-[11px] text-lav font-medium">اقرأ الذكرى ←</span>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ شرائط الفلترة ═══ */}
      <motion.div {...widgetEnter(0.18)} className="mb-3.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-[11.5px] font-semibold transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary border border-primary/35 shadow-[0_0_16px_-6px_rgba(245,185,92,0.4)]"
                    : "glass-soft text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                {f.label}
                <span className="ms-1.5 tabular opacity-75">{formatNumber(counts[f.key])}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ═══ قائمة اليوميات ═══ */}
      <section>
        <SectionHeader
          title={q.trim() ? "نتائج البحث" : "اليوميات"}
          icon={<NotebookPen className="w-3.5 h-3.5 text-primary" />}
        />

        {notesArr.length === 0 ? (
          <GlassCard className="p-4">
            <EmptyState
              icon={<NotebookPen className="w-6 h-6" />}
              title="لا يوميات بعد"
              hint="أول تدوين يستغرق أقل من دقيقة — اكتب ما يشغل بالك"
              actionLabel="ابدأ أول تدوين"
              onAction={() => openNew()}
            />
          </GlassCard>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={<Search className="w-6 h-6" />}
            title="لا نتائج مطابقة"
            hint="جرّب كلمة أخرى — أو امسح البحث"
            actionLabel="مسح البحث"
            onAction={() => (q.trim() ? setQ("") : setFilter("all"))}
          />
        ) : (
          <div className="max-h-[22rem] overflow-y-auto sys-scroll pe-1 space-y-2.5">
            <AnimatePresence initial={false}>
              {filtered.map((n, i) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  delay={Math.min(i * 0.04, 0.24)}
                  revealed={revealed.has(n.id)}
                  onReveal={() =>
                    setRevealed((prev) => {
                      const next = new Set(prev);
                      next.add(n.id);
                      return next;
                    })
                  }
                  onOpen={() => openView(n)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ═══ محرر اليومية ═══ */}
      <Dialog
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setConfirmDelete(false);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
        >
          <DialogHeader className="text-start">
            <DialogTitle className="text-[15px] font-bold text-start">
              {editor?.id ? "تعديل اليومية" : "يومية جديدة"}
            </DialogTitle>
          </DialogHeader>

          {editor && (
            <div className="space-y-3.5 pt-1">
              <Input
                value={editor.title}
                onChange={(e) => patchEditor({ title: e.target.value })}
                placeholder="العنوان…"
                aria-label="عنوان اليومية"
                className="h-11 rounded-xl bg-black/[0.03] border-white/10 text-[13px] focus-visible:ring-primary/25"
              />
              <Textarea
                value={editor.content}
                onChange={(e) => patchEditor({ content: e.target.value })}
                placeholder="اكتب بحرية — لا أحد يصحح هنا…"
                aria-label="محتوى اليومية"
                className="min-h-48 rounded-xl bg-black/[0.03] border-white/10 text-[12.5px] leading-relaxed resize-none focus-visible:ring-primary/25"
              />

              <Input
                value={editor.tags}
                onChange={(e) => patchEditor({ tags: e.target.value })}
                placeholder="وسوم مفصولة بفاصلة (مثال: أفكار، عمل)"
                aria-label="وسوم اليومية"
                className="h-11 rounded-xl bg-black/[0.03] border-white/10 text-[12px] focus-visible:ring-primary/25"
              />

              {/* منتقي مزاج اليومية */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-muted-foreground">
                  مزاج اليومية (اختياري)
                </label>
                <div className="flex items-center gap-2">
                  {MOOD_FACES.map((face, i) => {
                    const label = MOOD_LABELS[i];
                    const active = editor.mood === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => patchEditor({ mood: active ? null : label })}
                        aria-pressed={active}
                        aria-label={label}
                        title={label}
                        className={cn(
                          "flex-1 h-11 rounded-xl text-[18px] flex items-center justify-center transition-all",
                          active
                            ? "bg-primary/15 border border-primary/40 scale-[1.04]"
                            : "glass-soft border border-black/[0.05] hover:bg-black/[0.04]"
                        )}
                      >
                        {face}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editor.secret && (
                <p className="text-[10.5px] text-lav/90 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  تظهر مموّهة في القائمة حتى تنقرها لكشفها
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={() => void saveNote()}
                  disabled={saving || (!editor.title.trim() && !editor.content.trim())}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/90"
                >
                  {saving ? "جارٍ الحفظ…" : "حفظ"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void togglePin()}
                  aria-label={editor.pinned ? "إلغاء التثبيت" : "تثبيت"}
                  title={editor.pinned ? "إلغاء التثبيت" : "تثبيت"}
                  className={cn(
                    "w-11 h-11 p-0 rounded-xl",
                    editor.pinned
                      ? "border-primary/50 text-primary bg-primary/10"
                      : "border-white/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {editor.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void toggleSecret()}
                  aria-label={editor.secret ? "إلغاء الخصوصية" : "جعلها خاصة"}
                  title={editor.secret ? "إلغاء الخصوصية" : "جعلها خاصة"}
                  className={cn(
                    "w-11 h-11 p-0 rounded-xl",
                    editor.secret
                      ? "border-lav/50 text-lav bg-lav/10"
                      : "border-white/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {editor.secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                {editor.id && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(true)}
                    aria-label="حذف اليومية"
                    title="حذف"
                    disabled={confirmDelete}
                    className="w-11 h-11 p-0 rounded-xl border-coral/30 text-coral hover:bg-coral/10 hover:text-coral"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {confirmDelete && editor.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ConfirmBar
                      message={`حذف «${editor.title || "بلا عنوان"}» نهائياً؟ لا رجعة بعد الحذف.`}
                      confirmLabel="حذف"
                      onConfirm={() => void handleDelete()}
                      onCancel={() => setConfirmDelete(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
