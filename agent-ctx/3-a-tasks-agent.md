# Task 3-a — tasks-agent — شاشة «المهام والوقت والتركيز»

## الملكية الحصرية
`src/components/systemy/tasks/` — لا تعديل على أي ملف مشترك (types/db/actions/app/ui-store/glass/ui-bits...).

## الملفات (5)
| ملف | الدور |
|---|---|
| `tasks-screen.tsx` | الشاشة الكاملة (استُبدلت النسخة التأسيسية) |
| `task-fields.tsx` | حقول النموذج المشتركة + مساعدو الروابط (TaskLinkOptions/TaskFormValue/formToTaskInput/taskLinkChips/PRIORITY_OPTIONS) |
| `task-form-dialog.tsx` | Dialog «مهمة جديدة» → addTask |
| `task-detail-dialog.tsx` | Dialog تفاصيل: عرض + toggleTask + addBlock+goToCalendar + updateTask (تعديل مباشر) + deleteTask بConfirmBar |
| `focus-timer-card.tsx` | بومودورو: 15/25/45/60 + Select مهمة + عدّ بطوابع زمنية + نغمة Web Audio + addBlock عند الاكتمال |

## الدوال المستخدمة (استهلاك فقط)
- قراءة: `useLive(() => Promise.all([db.tasks, db.projects, db.courses, db.people, db.goals, db.trips, db.blocks].toArray()))` — واحدة.
- كتابة: `addTask` / `updateTask` / `toggleTask` / `deleteTask` / `addBlock`.
- تنقل: `goToCalendar(date?)` / `setView("projects")` من ui-store.
- مكونات مشتركة: GlassCard/widgetEnter (glass) · EmptyState/ChipRow/Field/FormShell/inputCls/textareaCls/ConfirmBar/iconByName (ui-bits) · shadcn Dialog + Select · sonner toast · framer-motion.

## عقود داخلية يستحق معرفتها من يبني عليها
- `taskLinkChips(task, links)` → `[{label, icon, color}]` لكل رابط موجود (مشروع/مقرر/شخص/هدف/رحلة).
- `formToTaskInput(v)` يرسل **undefined** للروابط الفارغة — لازم لمحو رابط عند التعديل عبر updateTask.
- جلسة التركيز تُحفظ: `{title:"جلسة تركيز: X", type:"work", date, startTime, endTime, taskId?, icon:"timer"}` — عدّاد الأسبوع في الشاشة = كل كتل type:"work" خلال آخر 7 أيام.
- «التالي» في الهيرو = أقدم (date+time) بين الموقوتات غير المنجزة؛ إن كانت ماضية تظهر بوسم «فات وقتها».

## التحقق
- `bunx eslint src/components/systemy/tasks/` → exit 0.
- `bunx tsc --noEmit` → صفر أخطاء في ملفات المهمة (والمشروع المفلتر نظيف).
- dev.log → «✓ Compiled» + GET / 200، بلا أي error.

## قرارات معمارية
1. المؤقت حالة داخل `FocusTimerCard` المركّبة **دائماً** في جذر الشاشة (بلا تصيير شرطي) → التقدم لا يضيع عند تبديل الفلاتر/فتح الحوارات داخل الشاشة؛ الدقة بطوابع `elapsedBase + (now - runStart)` لا بفواصل ساذجة.
2. نغمة الاكتمال عبر Web Audio (3 نغمات صاعدة) بلا أي ملف صوتي خارجي؛ يُنشأ السياق عند ضغطة «ابدأ» (سياسة autoplay) وتُبتلع أي استثناءات.
3. الإنهاء المبكر ≥ دقيقة يسجّل جلسة بوقت البدء الفعلي؛ أقل من دقيقة يُصفَّر بلا تسجيل (توست محايد).
4. «جدّولها على التقويم»: task.time إن وُجد وإلا nowHHMM، مدة estimatedMinutes (≥15)، ثم goToCalendar(task.date) — يترك تذكير addBlock التلقائي (سلوك actions المشترك) كما هو.
5. تُظلم رقائق المهمة العاجلة بمرجاني #FF8E7A (border-coral) تحديداً بلا indigo/blue.
