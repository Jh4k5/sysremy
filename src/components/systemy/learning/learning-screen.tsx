"use client";

/**
 * Systemy v3 — شاشة التعلم والدراسة (التنفيذ الكامل)
 * بطاقة البطل: المقررات النشطة + متوسط الدرجات المرجّحة + البطاقات المستحقة (لايتنر).
 * قائمة المقررات → حوار تفاصيل كامل (بنود درجات/مهام/جلسات/تعديل/حذف)
 * + جلسة مراجعة متباعدة ملء الشاشة + حوارا إضافة (مقرر/بطاقة).
 * كل الكتابة عبر actions — القراءة الوحيدة عبر useLive.
 */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { db, useLive } from "@/lib/db";
import { formatNumber, todayISO } from "@/lib/format";
import type { Course, Flashcard, Task, TimeBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { AddCourseDialog, AddFlashcardDialog } from "./add-dialogs";
import { CourseDialog } from "./course-dialog";
import { courseGlyph, courseGrade, gradeTone } from "./course-utils";
import { ReviewDialog } from "./review-dialog";

interface LearningData {
  courses: Course[];
  flashcards: Flashcard[];
  tasks: Task[];
  blocks: TimeBlock[];
}

/* ═══ هيكل التحميل ═══ */
function LearningSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28" aria-busy="true" aria-label="جارٍ تحميل شاشة التعلم">
      <div className="h-14 mb-4 space-y-2">
        <Skeleton className="h-7 w-36 rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-52 rounded-md bg-white/[0.06]" />
      </div>
      <Skeleton className="h-[168px] rounded-3xl bg-white/[0.05] mb-3" />
      <Skeleton className="h-11 rounded-2xl bg-white/[0.05] mb-3" />
      <div className="space-y-2.5">
        <Skeleton className="h-[88px] rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-[88px] rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-[88px] rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  );
}

/* ═══ بطاقة مقرر في القائمة ═══ */
function CourseCard({
  course,
  gradeCurrent,
  hasItems,
  cardCount,
  openTaskCount,
  delay,
  onOpen,
}: {
  course: Course;
  gradeCurrent: number;
  hasItems: boolean;
  cardCount: number;
  openTaskCount: number;
  delay: number;
  onOpen: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.26, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`فتح مقرر ${course.name}`}
    >
      <GlassCard interactive className="p-3.5 border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${course.color}22`, color: course.color }}
            aria-hidden="true"
          >
            {courseGlyph(course.icon, "w-[22px] h-[22px]")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-[14px] font-bold leading-snug truncate">{course.name}</h3>
              {course.code && (
                <Chip className="text-muted-foreground tabular shrink-0">{course.code}</Chip>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <Chip className="text-muted-foreground tabular">
                <Layers className="w-3 h-3" aria-hidden="true" />
                {formatNumber(cardCount)} بطاقة
              </Chip>
              <Chip className={cn("tabular", openTaskCount > 0 ? "text-gold" : "text-muted-foreground")}>
                {formatNumber(openTaskCount)} مهمة مفتوحة
              </Chip>
            </div>
          </div>
          <div className="text-end shrink-0">
            {hasItems ? (
              <>
                <p className={cn("text-[18px] font-bold tabular leading-none", gradeTone(gradeCurrent))}>
                  {formatNumber(gradeCurrent)}%
                </p>
                <p className="mt-1 text-[9.5px] text-muted-foreground">الدرجة الحالية</p>
              </>
            ) : (
              <p className="text-[10.5px] text-muted-foreground/80">بلا بنود درجات</p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ═══ الشاشة ═══ */
export function LearningScreen() {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const goToCalendar = useUIStore((s) => s.goToCalendar);

  const [courseDlgId, setCourseDlgId] = useState<string | null>(null);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);

  /* ─── القراءة التفاعلية الوحيدة ─── */
  const data = useLive(async (): Promise<LearningData> => {
    const [courses, flashcards, tasks, blocks] = await Promise.all([
      db.courses.toArray(),
      db.flashcards.toArray(),
      db.tasks.toArray(),
      db.blocks.toArray(),
    ]);
    return { courses, flashcards, tasks, blocks };
  }, []);

  const today = todayISO();

  const activeCourses = useMemo(
    () => (data?.courses ?? []).filter((c) => !c.archived).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data]
  );
  const dueCards = useMemo(() => {
    const all = data?.flashcards ?? [];
    return all.filter((f) => f.nextReview <= today);
  }, [data, today]);

  /** متوسط الدرجات المرجّحة للمقررات التي لها بنود — null إن لا بنود إطلاقاً */
  const avgGrade = useMemo(() => {
    const graded = activeCourses
      .map((c) => courseGrade(c))
      .filter((g) => g.items.length > 0);
    if (!graded.length) return null;
    return Math.round((graded.reduce((a, g) => a + g.current, 0) / graded.length) * 10) / 10;
  }, [activeCourses]);

  const courseStats = useMemo(() => {
    const flashcards = data?.flashcards ?? [];
    const tasks = data?.tasks ?? [];
    const map = new Map<string, { cards: number; openTasks: number; grade: ReturnType<typeof courseGrade> }>();
    for (const c of activeCourses) {
      map.set(c.id, {
        cards: flashcards.filter((f) => f.courseId === c.id).length,
        openTasks: tasks.filter((t) => t.courseId === c.id && !t.done).length,
        grade: courseGrade(c),
      });
    }
    return map;
  }, [data, activeCourses]);

  const courseDlgCourse = useMemo(
    () => (data?.courses ?? []).find((c) => c.id === courseDlgId) ?? null,
    [data, courseDlgId]
  );

  function startSession() {
    if (!dueCards.length) return;
    setSessionCards(dueCards);
    setSessionOpen(true);
  }

  if (!data) return <LearningSkeleton />;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">التعلم والدراسة</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              مقررات ودرجات وبطاقات مراجعة متباعدة
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAddCardOpen(true)}
              aria-label="بطاقة مراجعة جديدة"
              title="بطاقة جديدة"
              className="glass w-11 h-11 rounded-2xl flex items-center justify-center text-muted-foreground transition-all duration-200 hover:bg-white/[0.09] hover:text-foreground active:scale-95"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setAddCourseOpen(true)}
              aria-label="مقرر جديد"
              className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/35 text-primary flex items-center gap-1.5 text-[13px] font-bold transition-all duration-200 hover:bg-primary/25 hover:scale-[1.02] active:scale-95 glow-gold"
            >
              <Plus className="w-4 h-4" />
              مقرر
            </button>
          </div>
        </div>
      </header>

      {/* ═══ بطاقة البطل ═══ */}
      <motion.div {...widgetEnter(0.04)}>
        <GlassCard className="p-4 mb-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="glass-soft rounded-2xl p-3">
              <p className="text-[10.5px] text-muted-foreground">المقررات النشطة</p>
              <p className="mt-1 text-[22px] font-bold tabular leading-none">
                {formatNumber(activeCourses.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeCourses.length) setCourseDlgId(activeCourses[0].id);
                else setAddCourseOpen(true);
              }}
              aria-label={
                avgGrade != null ? "متوسط الدرجات المرجّحة" : "أضف بنود درجات لمقرراتك"
              }
              className="glass-soft rounded-2xl p-3 text-start hover:bg-white/[0.07] transition-colors"
            >
              <p className="text-[10.5px] text-muted-foreground">متوسط الدرجات المرجّحة</p>
              {avgGrade != null ? (
                <p className={cn("mt-1 text-[22px] font-bold tabular leading-none", gradeTone(avgGrade))}>
                  {formatNumber(avgGrade, 1)}%
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] font-medium text-primary flex items-center gap-1">
                  أضف بنود درجات ←
                </p>
              )}
            </button>
          </div>

          {/* البطاقات المستحقة اليوم */}
          <div className="mt-3 glass-soft rounded-2xl p-3.5 border border-primary/15">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">بطاقات مستحقة اليوم</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-[30px] font-bold tabular leading-tight text-primary">
                    {formatNumber(dueCards.length)}
                  </p>
                  {(data.flashcards.length > 0) && (
                    <p className="text-[10.5px] text-muted-foreground tabular">
                      من {formatNumber(data.flashcards.length)} بطاقة
                    </p>
                  )}
                </div>
              </div>
              {dueCards.length > 0 ? (
                <button
                  type="button"
                  onClick={startSession}
                  aria-label="ابدأ جلسة المراجعة المتباعدة"
                  className="h-12 px-4 shrink-0 rounded-2xl bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-1.5 glow-gold transition-transform active:scale-[0.97] hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  ابدأ جلسة المراجعة
                </button>
              ) : (
                <p className="text-[11px] text-mint/90 font-medium shrink-0 text-end leading-relaxed">
                  أنت مواكب ✓
                  <br />
                  لا مراجعات مستحقة
                </p>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ الروابط الحية ═══ */}
      <motion.div {...widgetEnter(0.09)} className="mb-4">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => openQuickAdd("expense")}
            aria-label="تسجيل رسوم ومستلزمات دراسية"
            className="glass rounded-2xl min-h-11 px-3.5 py-2.5 flex items-center justify-center gap-2 text-[12px] font-medium text-foreground/85 hover:bg-white/[0.07] transition-colors active:scale-[0.98]"
          >
            <Wallet className="w-4 h-4 text-cyan" aria-hidden="true" />
            رسوم ومستلزمات
          </button>
          <button
            type="button"
            onClick={() => goToCalendar()}
            aria-label="الانتقال إلى التقويم"
            className="glass rounded-2xl min-h-11 px-3.5 py-2.5 flex items-center justify-center gap-2 text-[12px] font-medium text-foreground/85 hover:bg-white/[0.07] transition-colors active:scale-[0.98]"
          >
            <CalendarDays className="w-4 h-4 text-gold" aria-hidden="true" />
            التقويم
          </button>
        </div>
      </motion.div>

      {/* ═══ قائمة المقررات ═══ */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <GraduationCap className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>المقررات</span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular">
            {formatNumber(activeCourses.length)}
          </span>
        </div>

        {activeCourses.length === 0 ? (
          <GlassCard className="p-4">
            <EmptyState
              icon={<GraduationCap className="w-6 h-6" />}
              title="لا مقررات بعد"
              hint="أضف مقررك الأول — سيتتبع النظام درجاتك المرجّحة وبطاقات مراجعتك ومهامك الدراسية في مكان واحد."
              actionLabel="أضف مقررك الأول"
              onAction={() => setAddCourseOpen(true)}
            />
          </GlassCard>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {activeCourses.map((c, i) => {
                const st = courseStats.get(c.id);
                return (
                  <CourseCard
                    key={c.id}
                    course={c}
                    gradeCurrent={st?.grade.current ?? 0}
                    hasItems={(st?.grade.items.length ?? 0) > 0}
                    cardCount={st?.cards ?? 0}
                    openTaskCount={st?.openTasks ?? 0}
                    delay={Math.min(i * 0.04, 0.24)}
                    onOpen={() => setCourseDlgId(c.id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ═══ الحوارات ═══ */}
      <AddCourseDialog open={addCourseOpen} onOpenChange={setAddCourseOpen} />
      <AddFlashcardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        courses={data.courses}
      />
      <CourseDialog
        open={courseDlgCourse != null}
        onOpenChange={(o) => {
          if (!o) setCourseDlgId(null);
        }}
        course={courseDlgCourse}
        flashcards={data.flashcards}
        tasks={data.tasks}
        blocks={data.blocks}
        goToCalendar={goToCalendar}
      />
      <ReviewDialog
        open={sessionOpen}
        onOpenChange={(o) => {
          setSessionOpen(o);
          if (!o) setSessionCards([]);
        }}
        cards={sessionCards}
        courses={data.courses}
      />
    </div>
  );
}
