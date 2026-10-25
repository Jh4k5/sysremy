"use client";

/**
 * Systemy v3 — حوار تفاصيل المقرر (شاشة التعلم)
 * بنود الدرجات المرجّحة + مهام المقرر + جلسات المذاكرة + تعديل + حذف.
 * كل الكتابة عبر actions الجاهزة — القوائم تمر لحظية من useLive في الشاشة الأم.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Circle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Chip } from "@/components/systemy/glass";
import {
  ColorSwatches,
  ConfirmBar,
  Field,
  FormShell,
  IconGrid,
  inputCls,
} from "@/components/systemy/ui-bits";
import { addBlock, addGradeItem, addTask, deleteCourse, removeGradeItem, toggleTask, updateCourse } from "@/lib/actions";
import { addDaysISO, formatNumber, relativeDay, todayISO } from "@/lib/format";
import type { Course, Flashcard, Task, TimeBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { courseGlyph, courseGrade, gradeTone } from "./course-utils";

/** أيقونات مقررات لقائمة التحرير — نفس قائمة الإضافة */
const COURSE_ICONS = [
  "graduation-cap",
  "book-open",
  "brain",
  "languages",
  "pen-line",
  "laptop",
  "target",
  "star",
  "trophy",
  "gauge",
  "music",
  "camera",
  "briefcase",
  "shapes",
] as const;

const numInputCls = cn(inputCls, "tabular");

function parseNum(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[٫,]/g, "."));
  return Number.isFinite(n) ? n : 0;
}

/** الساعة القادمة الكاملة — لجدولة جلسة مذاكرة فورية */
function nextHourSlot(): { startTime: string; endTime: string } {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = new Date(d.getTime() + 60 * 60 * 1000);
  return {
    startTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

export function CourseDialog({
  open,
  onOpenChange,
  course,
  flashcards,
  tasks,
  blocks,
  goToCalendar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course: Course | null;
  flashcards: Flashcard[];
  tasks: Task[];
  blocks: TimeBlock[];
  goToCalendar: (date?: string) => void;
}) {
  /* ─── بنود الدرجات: نموذج الإضافة ─── */
  const [gradeFormOpen, setGradeFormOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gWeight, setGWeight] = useState("");
  const [gScore, setGScore] = useState("");
  const [gMax, setGMax] = useState("100");
  const [gradeBusy, setGradeBusy] = useState(false);

  /* ─── مهمة دراسية: مؤلف سريع ─── */
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  /* ─── جدولة جلسة ─── */
  const [scheduling, setScheduling] = useState(false);

  /* ─── تعديل بيانات المقرر ─── */
  const [editOpen, setEditOpen] = useState(false);
  const [eName, setEName] = useState("");
  const [eCode, setECode] = useState("");
  const [eInstructor, setEInstructor] = useState("");
  const [eColor, setEColor] = useState("#F5B95C");
  const [eIcon, setEIcon] = useState("graduation-cap");
  const [editBusy, setEditBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  /* تصفير الحوار عند فتح مقرر — بالمعرف حتى لا يمسح النماذج عند أي تحديث بيانات */
  const courseId = course?.id ?? null;
  useEffect(() => {
    if (open && courseId) {
      setGradeFormOpen(false);
      setGName("");
      setGWeight("");
      setGScore("");
      setGMax("100");
      setTaskFormOpen(false);
      setTaskTitle("");
      setEditOpen(false);
      setConfirmDelete(false);
    }
  }, [open, courseId]);

  /* ─── مشتقات لازمة ─── */
  const grade = useMemo(() => (course ? courseGrade(course) : null), [course]);
  const courseCards = useMemo(
    () => (course ? flashcards.filter((f) => f.courseId === course.id) : []),
    [flashcards, course]
  );
  const courseTasks = useMemo(() => {
    if (!course) return [];
    return tasks
      .filter((t) => t.courseId === course.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [tasks, course]);
  const openTaskCount = useMemo(
    () => (course ? tasks.filter((t) => t.courseId === course.id && !t.done).length : 0),
    [tasks, course]
  );
  const sessionCount = useMemo(() => {
    if (!course) return 0;
    const today = todayISO();
    const since = addDaysISO(today, -30);
    return blocks.filter(
      (b) => b.type === "learning" && b.courseId === course.id && b.date >= since && b.date <= today
    ).length;
  }, [blocks, course]);

  const totalWeight = grade ? Math.round(grade.items.reduce((a, it) => a + it.weight, 0)) : 0;

  /* ─── الإجراءات ─── */
  async function saveGradeItem() {
    if (!course || !gName.trim() || parseNum(gWeight) <= 0 || parseNum(gMax) <= 0 || gradeBusy)
      return;
    setGradeBusy(true);
    try {
      await addGradeItem(course.id, {
        name: gName.trim(),
        weight: parseNum(gWeight),
        score: parseNum(gScore),
        max: parseNum(gMax),
      });
      setGName("");
      setGWeight("");
      setGScore("");
      setGMax("100");
      setGradeFormOpen(false);
    } finally {
      setGradeBusy(false);
    }
  }

  async function saveTask() {
    if (!course || !taskTitle.trim() || taskBusy) return;
    setTaskBusy(true);
    try {
      await addTask({
        title: taskTitle.trim(),
        date: todayISO(),
        priority: "normal",
        done: false,
        courseId: course.id,
      });
      setTaskTitle("");
      setTaskFormOpen(false);
    } finally {
      setTaskBusy(false);
    }
  }

  async function scheduleSession() {
    if (!course || scheduling) return;
    setScheduling(true);
    try {
      const { startTime, endTime } = nextHourSlot();
      const today = todayISO();
      await addBlock({
        title: `مذاكرة — ${course.name}`,
        type: "learning",
        date: today,
        startTime,
        endTime,
        courseId: course.id,
        color: course.color,
        icon: course.icon,
      });
      onOpenChange(false);
      goToCalendar(today);
    } finally {
      setScheduling(false);
    }
  }

  function enterEdit() {
    if (!course) return;
    setEName(course.name);
    setECode(course.code ?? "");
    setEInstructor(course.instructor ?? "");
    setEColor(course.color);
    setEIcon(course.icon);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!course || !eName.trim() || editBusy) return;
    setEditBusy(true);
    try {
      await updateCourse(course.id, {
        name: eName.trim(),
        code: eCode.trim() || undefined,
        instructor: eInstructor.trim() || undefined,
        color: eColor,
        icon: eIcon,
      });
      setEditOpen(false);
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete() {
    if (!course) return;
    await deleteCourse(course.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setConfirmDelete(false); }}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
      >
        {course && grade && (
          <div className="space-y-4">
            {/* ═══ رأس المقرر ═══ */}
            <DialogHeader className="text-start space-y-2">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${course.color}22`, color: course.color }}
                  aria-hidden="true"
                >
                  {course && courseGlyph(course.icon, "w-6 h-6")}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <DialogTitle className="text-[16px] font-bold text-start leading-snug">
                    {course.name}
                  </DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {course.code && <Chip className="text-muted-foreground tabular">{course.code}</Chip>}
                    {course.instructor && (
                      <span className="text-[11px] text-muted-foreground">{course.instructor}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip className={grade.items.length ? gradeTone(grade.current) : "text-muted-foreground"}>
                  الدرجة الحالية{" "}
                  {grade.items.length ? `${formatNumber(grade.current)}%` : "بلا بنود"}
                </Chip>
                <Chip className="text-muted-foreground tabular">
                  {formatNumber(courseCards.length)} بطاقة
                </Chip>
                <Chip className="text-muted-foreground tabular">
                  {formatNumber(openTaskCount)} مهمة مفتوحة
                </Chip>
                <Chip className="text-muted-foreground tabular">
                  {formatNumber(sessionCount)} جلسة · 30 يوماً
                </Chip>
              </div>
            </DialogHeader>

            {/* ═══ 1) بنود الدرجات ═══ */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-foreground/90">بنود الدرجات</span>
                <button
                  type="button"
                  onClick={() => setGradeFormOpen((v) => !v)}
                  aria-label={gradeFormOpen ? "إغلاق نموذج بند الدرجة" : "إضافة بند درجة"}
                  className="h-11 px-3 rounded-xl bg-primary/15 border border-primary/35 text-primary text-[11.5px] font-bold flex items-center gap-1 hover:bg-primary/25 transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  بند درجة
                </button>
              </div>

              {grade.items.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground leading-relaxed glass-soft rounded-2xl p-3.5">
                  لا بنود بعد — أضف بنود الدرجة (بواجباتها وأوزانها) ليحسب لك النظام الدرجة المرجّحة
                  تلقائياً.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {grade.items.map((it, i) => (
                    <motion.div
                      key={`${i}-${it.name}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.15) }}
                      className="glass-soft rounded-2xl p-2.5 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold truncate">{it.name}</p>
                        <p className="text-[10.5px] text-muted-foreground tabular">
                          {formatNumber(it.score)} من {formatNumber(it.max)} ·{" "}
                          {it.max > 0 ? formatNumber(Math.round((it.score / it.max) * 100)) : "0"}%
                        </p>
                      </div>
                      <Chip className="text-muted-foreground tabular shrink-0">
                        وزن {formatNumber(it.weight)}%
                      </Chip>
                      <button
                        type="button"
                        onClick={() => void removeGradeItem(course.id, i)}
                        aria-label={`حذف بند ${it.name}`}
                        className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-coral hover:bg-coral/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}

                  {/* سطر الدرجة الحالية + التغطية */}
                  <div className="glass rounded-2xl p-3.5">
                    <p className="text-[12.5px] font-semibold">
                      الدرجة الحالية:{" "}
                      <span className={cn("tabular", gradeTone(grade.current))}>
                        {formatNumber(grade.current)}%
                      </span>{" "}
                      <span className="text-muted-foreground font-normal">
                        — بتغطية {formatNumber(grade.coveredWeight)}% من الأوزان
                      </span>
                    </p>
                    {totalWeight !== 100 && (
                      <p className="mt-1.5 text-[11px] text-gold/90 flex items-start gap-1.5 leading-relaxed">
                        <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                        الأوزان المسجلة {formatNumber(totalWeight)}% من 100 — عدّل الأوزان لتتساوى مع
                        100 لدرجة نهائية دقيقة.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* نموذج إضافة بند */}
              <AnimatePresence initial={false}>
                {gradeFormOpen && (
                  <motion.div
                    key="grade-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="glass rounded-2xl p-4 space-y-3">
                      <Field label="اسم البند">
                        <Input
                          value={gName}
                          onChange={(e) => setGName(e.target.value)}
                          placeholder="مثال: واجب الفصل الأول"
                          aria-label="اسم بند الدرجة"
                          className={inputCls}
                        />
                      </Field>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="الوزن %">
                          <Input
                            value={gWeight}
                            onChange={(e) => setGWeight(e.target.value)}
                            inputMode="decimal"
                            placeholder="20"
                            aria-label="وزن البند"
                            className={numInputCls}
                          />
                        </Field>
                        <Field label="درجتك">
                          <Input
                            value={gScore}
                            onChange={(e) => setGScore(e.target.value)}
                            inputMode="decimal"
                            placeholder="15"
                            aria-label="الدرجة المحصلة"
                            className={numInputCls}
                          />
                        </Field>
                        <Field label="الكامل">
                          <Input
                            value={gMax}
                            onChange={(e) => setGMax(e.target.value)}
                            inputMode="decimal"
                            placeholder="20"
                            aria-label="الدرجة الكاملة"
                            className={numInputCls}
                          />
                        </Field>
                      </div>
                      <FormShell
                        onSave={() => void saveGradeItem()}
                        busy={gradeBusy}
                        saveLabel="أضف البند"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* ═══ 2) مهام المقرر ═══ */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-foreground/90">
                  مهام المقرر{" "}
                  <span className="text-muted-foreground font-normal text-[11px]">
                    (آخر {formatNumber(courseTasks.length)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setTaskFormOpen((v) => !v)}
                  aria-label={taskFormOpen ? "إغلاق نموذج مهمة دراسية" : "إضافة مهمة دراسية"}
                  className="h-11 px-3 rounded-xl bg-primary/15 border border-primary/35 text-primary text-[11.5px] font-bold flex items-center gap-1 hover:bg-primary/25 transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  مهمة دراسية
                </button>
              </div>

              {courseTasks.length === 0 && !taskFormOpen && (
                <p className="text-[11.5px] text-muted-foreground glass-soft rounded-2xl p-3.5">
                  لا مهام مرتبطة بعد — أضف مهمة دراسية وتظهر هنا وفي قائمة المهام والتقويم.
                </p>
              )}

              {courseTasks.length > 0 && (
                <div className="space-y-1">
                  {courseTasks.map((t) => (
                    <div key={t.id} className="glass-soft rounded-2xl px-2.5 flex items-center gap-2 min-h-11">
                      <button
                        type="button"
                        onClick={() => void toggleTask(t.id)}
                        aria-label={t.done ? "إلغاء إنجاز المهمة" : `إنجاز المهمة: ${t.title}`}
                        aria-pressed={t.done}
                        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl transition-colors hover:bg-black/[0.04]"
                      >
                        {t.done ? (
                          <Check className="w-5 h-5 text-mint" aria-hidden="true" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/70" aria-hidden="true" />
                        )}
                      </button>
                      <p
                        className={cn(
                          "flex-1 min-w-0 text-[12.5px] leading-snug truncate",
                          t.done && "line-through text-muted-foreground"
                        )}
                      >
                        {t.title}
                      </p>
                      <Chip className="text-muted-foreground shrink-0">{relativeDay(t.date)}</Chip>
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence initial={false}>
                {taskFormOpen && (
                  <motion.div
                    key="task-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="glass rounded-2xl p-3.5 flex items-center gap-2">
                      <Input
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveTask();
                        }}
                        placeholder="مثال: مراجعة الفصل الثالث…"
                        aria-label="عنوان المهمة الدراسية"
                        className={cn(inputCls, "flex-1")}
                      />
                      <button
                        type="button"
                        onClick={() => void saveTask()}
                        disabled={taskBusy || !taskTitle.trim()}
                        aria-label="حفظ المهمة الدراسية"
                        className="h-12 shrink-0 px-4 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 disabled:opacity-50 transition-transform active:scale-95"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        إضافة
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-muted-foreground/70 px-1">
                      ستُضاف بتاريخ اليوم وترتبط بهذا المقرر.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* ═══ 3) جلسات مذاكرة ═══ */}
            <section className="space-y-2.5">
              <span className="block px-1 text-[13px] font-semibold text-foreground/90">
                جلسات المذاكرة
              </span>
              <div className="glass-soft rounded-2xl p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold tabular">
                    {formatNumber(sessionCount)} جلسة خلال آخر 30 يوماً
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    جلسات «تعلم» مرتبطة بالمقرر في التقويم
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void scheduleSession()}
                  disabled={scheduling}
                  aria-label="جدولة جلسة مذاكرة في الساعة القادمة"
                  className="h-12 shrink-0 px-4 rounded-xl bg-primary/15 border border-primary/35 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 disabled:opacity-50 transition-colors"
                >
                  <CalendarDays className="w-4 h-4" aria-hidden="true" />
                  {scheduling ? "جارٍ…" : "جدول جلسة"}
                </button>
              </div>
              <p className="text-[10.5px] text-muted-foreground/70 px-1">
                تُجدول اليوم في الساعة القادمة ثم ينقلك النظام للتقويم.
              </p>
            </section>

            {/* ═══ 4) تعديل بيانات المقرر ═══ */}
            <section className="space-y-2.5">
              {!editOpen ? (
                <button
                  type="button"
                  onClick={enterEdit}
                  aria-label="تعديل بيانات المقرر"
                  className="w-full min-h-11 glass-soft rounded-2xl px-4 py-2.5 flex items-center justify-center gap-2 text-[12.5px] font-medium text-foreground/85 hover:bg-black/[0.04] transition-colors"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                  تعديل بيانات المقرر
                </button>
              ) : (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <Field label="اسم المقرر">
                    <Input
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      aria-label="اسم المقرر"
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="الرمز">
                      <Input
                        value={eCode}
                        onChange={(e) => setECode(e.target.value)}
                        aria-label="رمز المقرر"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="المدرّس">
                      <Input
                        value={eInstructor}
                        onChange={(e) => setEInstructor(e.target.value)}
                        aria-label="اسم المدرّس"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="اللون">
                    <ColorSwatches value={eColor} onChange={setEColor} />
                  </Field>
                  <Field label="الأيقونة">
                    <IconGrid value={eIcon} onChange={setEIcon} choices={COURSE_ICONS} />
                  </Field>
                  <FormShell onSave={() => void saveEdit()} busy={editBusy} saveLabel="حفظ التعديلات" />
                </div>
              )}
            </section>

            {/* ═══ 5) حذف المقرر ═══ */}
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="حذف المقرر"
                className="w-full min-h-11 rounded-2xl border border-coral/30 text-coral text-[12.5px] font-medium flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                حذف المقرر
              </button>
            ) : (
              <ConfirmBar
                message={`حذف «${course.name}» نهائياً؟ ستُحذف بطاقاته المرتبطة (${formatNumber(
                  courseCards.length
                )}) معه، أما مهامه فتبقى في قائمة المهام بلا رابط.`}
                confirmLabel="حذف المقرر"
                onConfirm={() => void handleDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
