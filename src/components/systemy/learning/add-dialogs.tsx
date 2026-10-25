"use client";

/**
 * Systemy v3 — حوارا الإضافة لشاشة التعلم: مقرر جديد + بطاقة مراجعة جديدة
 * كل الكتابة عبر actions (addCourse / addFlashcard) — القراءة تتم في الشاشة.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers } from "lucide-react";
import {
  ColorSwatches,
  Field,
  FormShell,
  IconGrid,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";
import { addCourse, addFlashcard } from "@/lib/actions";
import type { Course } from "@/lib/types";

/** أيقونات مناسبة للمقررات — كلها موجودة في خريطة ui-bits */
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

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-black/[0.07] px-4 text-[13.5px] text-foreground focus:ring-0";

/* ═══════════════ حوار إضافة مقرر ═══════════════ */
export function AddCourseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [color, setColor] = useState<string>("#F5B95C");
  const [icon, setIcon] = useState<string>("graduation-cap");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setInstructor("");
      setColor("#F5B95C");
      setIcon("graduation-cap");
    }
  }, [open]);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await addCourse({
        name: name.trim(),
        code: code.trim() || undefined,
        instructor: instructor.trim() || undefined,
        color,
        icon,
        gradeItems: "[]",
        archived: false,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-[15px] font-bold text-start">مقرر جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          <Field label="اسم المقرر">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تحليل نفسي ٢"
              aria-label="اسم المقرر"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="الرمز (اختياري)">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PSY-302"
                aria-label="رمز المقرر"
                className={inputCls}
              />
            </Field>
            <Field label="المدرّس (اختياري)">
              <Input
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="د. أحمد"
                aria-label="اسم المدرّس"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="لون المقرر">
            <ColorSwatches value={color} onChange={setColor} />
          </Field>

          <Field label="أيقونة المقرر">
            <IconGrid value={icon} onChange={setIcon} choices={COURSE_ICONS} />
          </Field>

          <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف المقرر" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════ حوار إضافة بطاقة مراجعة ═══════════════ */
export function AddFlashcardDialog({
  open,
  onOpenChange,
  courses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: Course[];
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setQuestion("");
      setAnswer("");
      setCourseId("none");
    }
  }, [open]);

  async function save() {
    if (!question.trim() || !answer.trim() || busy) return;
    setBusy(true);
    try {
      await addFlashcard({
        question: question.trim(),
        answer: answer.trim(),
        courseId: courseId === "none" ? undefined : courseId,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-[15px] font-bold text-start flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
            بطاقة مراجعة جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          <Field label="السؤال" hint="ستظهر البطاقة في جلسة المراجعة عند استحقاقها">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب السؤال…"
              aria-label="سؤال البطاقة"
              className={textareaCls}
            />
          </Field>

          <Field label="الجواب">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="اكتب الجواب…"
              aria-label="جواب البطاقة"
              className={textareaCls}
            />
          </Field>

          <Field label="المقرر (اختياري)">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className={selectTriggerCls} aria-label="مقرر البطاقة">
                <SelectValue placeholder="بدون مقرر" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-black/[0.08] bg-white">
                <SelectItem value="none">بدون مقرر</SelectItem>
                {courses
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[13px]">
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف البطاقة" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
