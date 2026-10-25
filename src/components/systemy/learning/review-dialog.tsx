"use client";

/**
 * Systemy v3 — جلسة المراجعة المتباعدة (لايتنر) — حوار ملء الشاشة
 * تعرض البطاقات المستحقة (nextReview <= اليوم) واحدة تلو الأخرى:
 * السؤال → أظهر الجواب → تذكرتها / نسيت → التالي… ثم ملخص الجلسة.
 * كل الكتابة عبر reviewFlashcard — القراءة لحظية في الشاشة الأم.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Check, Eye, PartyPopper, X } from "lucide-react";
import { reviewFlashcard } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import type { Course, Flashcard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReviewDialog({
  open,
  onOpenChange,
  cards,
  courses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** لقطة البطاقات المستحقة لحظة بدء الجلسة */
  cards: Flashcard[];
  courses: Course[];
}) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const [answering, setAnswering] = useState(false);

  /* تصفير الجلسة عند كل فتح */
  useEffect(() => {
    if (open) {
      setIdx(0);
      setRevealed(false);
      setRemembered(0);
    }
  }, [open]);

  const total = cards.length;
  const finished = idx >= total;
  const card = finished ? null : (cards[idx] ?? null);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const cardCourse = card?.courseId ? (courseById.get(card.courseId) ?? null) : null;

  async function answer(good: boolean) {
    if (!card || answering) return;
    setAnswering(true);
    try {
      await reviewFlashcard(card.id, good);
      if (good) setRemembered((m) => m + 1);
      setIdx((i) => i + 1);
      setRevealed(false);
    } finally {
      setAnswering(false);
    }
  }

  const progressPct = total > 0 ? Math.round((Math.min(idx, total) / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="glass-deep rounded-none border-0 p-0 w-screen h-[100dvh] max-w-none sm:max-w-none overflow-y-auto sys-scroll"
      >
        <div className="min-h-full flex flex-col px-5 pt-5 pb-8 max-w-lg mx-auto w-full">
          {/* ═══ رأس الجلسة + التقدم ═══ */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold leading-tight">جلسة المراجعة المتباعدة</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground tabular">
                {formatNumber(Math.min(idx, total))} من {formatNumber(total)} · حفظت{" "}
                {formatNumber(remembered)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="إنهاء الجلسة"
              className="w-11 h-11 shrink-0 rounded-2xl glass-soft flex items-center justify-center text-muted-foreground transition-all hover:bg-black/[0.05] hover:text-foreground active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* شريط تقدم الجلسة */}
          <div
            className="mt-3 h-2 rounded-full bg-black/[0.04] overflow-hidden"
            role="progressbar"
            aria-label="تقدم جلسة المراجعة"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.min(idx, total)}
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          {/* ═══ جسم الجلسة ═══ */}
          {finished ? (
            /* ملخص النهاية */
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10"
            >
              <span className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                <PartyPopper className="w-7 h-7" aria-hidden="true" />
              </span>
              <h3 className="text-[19px] font-bold">انتهت الجلسة ✓</h3>
              <p className="text-[14px] text-foreground/90 leading-relaxed">
                راجعت <span className="font-bold text-primary tabular">{formatNumber(total)}</span>{" "}
                بطاقة — حفظت{" "}
                <span className="font-bold text-mint tabular">{formatNumber(remembered)}</span> منها
              </p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-[280px]">
                البطاقات التي تذكرتها ستعود بعد فواصل أطول، والتي نسيتها تعود غداً — هكذا يثبت
                الحفظ.
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-2 h-12 px-8 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold glow-gold transition-transform active:scale-[0.98]"
              >
                إنهاء الجلسة
              </button>
            </motion.div>
          ) : card ? (
            <div className="flex-1 flex flex-col justify-center py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* شرائح السياق */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    {cardCourse && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium glass-soft"
                        style={{ color: cardCourse.color }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: cardCourse.color }}
                          aria-hidden="true"
                        />
                        {cardCourse.name}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium glass-soft text-muted-foreground tabular">
                      صندوق {formatNumber(card.box)}
                    </span>
                  </div>

                  {/* السؤال — كبيراً */}
                  <div className="glass rounded-3xl p-6 min-h-[180px] flex items-center justify-center">
                    <p className="text-[20px] font-bold leading-relaxed text-center">
                      {card.question}
                    </p>
                  </div>

                  {/* الجواب */}
                  <AnimatePresence initial={false}>
                    {revealed && (
                      <motion.div
                        key="answer"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-3 glass-soft rounded-3xl border border-primary/20 p-5"
                      >
                        <p className="text-[10.5px] font-semibold text-primary/80 mb-1.5">الجواب</p>
                        <p className="text-[15px] leading-relaxed text-foreground/95">
                          {card.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>

              {/* ═══ أزرار التحكم ═══ */}
              <div className="mt-5 space-y-2.5">
                {!revealed ? (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98]"
                  >
                    <Eye className="w-5 h-5" aria-hidden="true" />
                    أظهر الجواب
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-2 gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => void answer(true)}
                      disabled={answering}
                      aria-label="تذكرت البطاقة — إجابة صحيحة"
                      className="h-12 rounded-2xl bg-mint/15 border border-mint/40 text-mint text-[14.5px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" aria-hidden="true" />
                      تذكرتها ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => void answer(false)}
                      disabled={answering}
                      aria-label="نسيت البطاقة — إجابة خاطئة"
                      className="h-12 rounded-2xl bg-coral/15 border border-coral/40 text-coral text-[14.5px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                      نسيت ✗
                    </button>
                  </motion.div>
                )}

                {!revealed && (
                  <p className="text-center text-[10.5px] text-muted-foreground/70">
                    حاول تذكر الجواب قبل الكشف — التذكر الجاد هو ما يثبّت المعلومة
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className={cn("flex-1 flex items-center justify-center text-[12px] text-muted-foreground")}>
              لا بطاقات في هذه الجلسة
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
