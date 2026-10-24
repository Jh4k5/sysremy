# Task 3-c — شاشتا «التعلم والدراسة» و«الملاحظات والمعرفة» (التنفيذ الكامل)

Task ID: 3-c · Agent: learning-notes-agent · Systemy v3

## الملفات (ملكية حصرية — لم يُلمس أي ملف مشترك)

### learning/ (7 → 5 ملفات)
1. **`src/components/systemy/learning/learning-screen.tsx`** (استُبدل كاملاً)
   - قراءة واحدة `useLive` موازية: courses + flashcards + tasks + blocks → Skeleton أثناء null.
   - **بطاقة البطل**: المقررات النشطة (عدد) · متوسط الدرجات المرجّحة (`courseGrade` لكل مقرر ثم المتوسط — إن لا بنود إطلاقاً يُخفى الرقم وتظهر «أضف بنود درجات ←» كزر يفتح أول مقرر أو حوار الإنشاء) · البطاقات المستحقة اليوم (`nextReview <= todayISO()`) كرقم 30px ذهبي + «من إجمالي X بطاقة» + زر «ابدأ جلسة المراجعة» (أو «أنت مواكب ✓» عند الصفر).
   - **الروابط الحية**: زران glass — «رسوم ومستلزمات» → `openQuickAdd("expense")` و«التقويم» → `goToCalendar()`.
   - قائمة المقررات: بطاقة لكل مقرر نشط (أيقونة بلون المقرر عبر `courseGlyph`/createElement لتفادي قاعدة static-components، الاسم + الكود chip، الدرجة المرجّحة `%` بلون `gradeTone` (mint≥90/cyan≥75/gold≥60/coral)، بطاقات N، مهام مفتوحة N) → الضغط يفتح CourseDialog. فراغ → EmptyState بفعل «أضف مقررك الأول».
   - ترويسة أزرار: «بطاقة جديدة» (glass) + «مقرر» (primary glow-gold). جلسة المراجعة تُبنى من **لقطة** dueCards لحظة البدء (state محلي) حتى لا تتأثر بتحديثات liveQuery أثناء الجلسة.
2. **`src/components/systemy/learning/course-dialog.tsx`** (جديد)
   - رأس: أيقونة/لون + اسم + كود/مدرّس + chips (الدرجة الحالية/بطاقات/مهام مفتوحة/جلسات 30ي).
   - **بنود الدرجات**: صفوف (اسم + درجة من كامل + نسبة + وزن% + حذف `removeGradeItem` بالفهرس) + سطر «الدرجة الحالية: X% — بتغطية Y% من الأوزان» (من `computeCourseGrade`) + تحذير ذهبي لطيف «الأوزان المسجلة Y% من 100» عند عدم التساوي + نموذج FormShell (الاسم/الوزن/الدرجة/الكامل → `addGradeItem`).
   - **مهام المقرر**: آخر 5 (فرز تاريخ ثم createdAt تنازلياً) مع checkbox → `toggleTask` + مؤلف سريع «مهمة دراسية» (Enter/زر) → `addTask` بتاريخ اليوم وcourseId.
   - **جلسات مذاكرة**: عدّ blocks type=learning بcourseId ضمن آخر 30 يوماً + زر «جدول جلسة» → `addBlock` (learning/courseId/اليوم/الساعة القادمة الكاملة +1h/لون وأيقونة المقرر) ثم `onOpenChange(false)` + `goToCalendar(today)`.
   - **تعديل** (قسم قابل للفتح: اسم/كود/مدرّس/ColorSwatches/IconGrid → `updateCourse`) + **حذف** بـConfirmBar بنص يوضح أن بطاقاته (N) تُحذف ومهامه تبقى → `deleteCourse`.
   - تصفير النماذج keyed بـ`courseId` (لا بالكائن) حتى لا تُمسح عند أي re-emit لبيانات.
3. **`src/components/systemy/learning/review-dialog.tsx`** (جديد — ملء الشاشة)
   - DialogContent `w-screen h-[100dvh] max-w-none sm:max-w-none rounded-none p-0` + close مخصص 44px.
   - تدفق: شرائح سياق (مقرر بلونه + «صندوق N» لايتنر) → السؤال 20px bold في glass → زر «أظهر الجواب» h-12 → الجواب glass-soft → زرا «تذكرتها ✓» (mint) / «نسيت ✗» (coral) → `reviewFlashcard(id, true/false)`.
   - شريط تقدم (role=progressbar + aria-valuenow) + عدّاد «M من N · حفظت K» + عند النهاية ملخص «راجعت N بطاقة — حفظت M منها» مع شرح لايتنر وزر «إنهاء الجلسة». انتقالات AnimatePresence خفيفة (سؤال ينجلِي أفقياً).
4. **`src/components/systemy/learning/add-dialogs.tsx`** (جديد)
   - `AddCourseDialog`: اسم (إلزامي)/كود/مدرّس/ColorSwatches/IconGrid (14 أيقونة تعليمية) → `addCourse` بgradeItems:"[]" وarchived:false.
   - `AddFlashcardDialog`: سؤال/جواب (textareas) + مقرر اختياري عبر Select زجاجي («بدون مقرر» + المقررات النشطة) → `addFlashcard`.
5. **`src/components/systemy/learning/course-utils.ts`** (جديد): `parseGradeItems` (JSON آمن)، `courseGrade` (يغلّف `computeCourseGrade`)، `gradeTone`، `courseGlyph` (createElement — نفس نمط SysGlyph في systems-screen).

### notes/ (4 → 4 ملفات)
6. **`src/components/systemy/notes/notes-screen.tsx`** (استُبدل كاملاً)
   - `useLive(db.notes.toArray())` → عرض **type==="note" فقط** (اليوميات نظام منفصل).
   - بحث نصي (عنوان+محتوى) بحقل glass مع زر مسح + شرائح فلترة أفقية no-scrollbar: الكل/المثبتة/المفضلة + وسوم فريدة (حتى 10، مستخرجة من ملاحظات المعرفة، بدون وسم المفضلة الداخلي) مع عدادات حية.
   - ترتيب: المثبتة أولاً ثم updatedAt الأحدث. فراغ → EmptyState «معرفتك المرجعية تبدأ هنا» بفعل «أنشئ ملاحظة»؛ لا نتائج → EmptyState compact بفعل مسح البحث والفلتر.
7. **`src/components/systemy/notes/note-dialog.tsx`** (جديد)
   - عرض/تعديل/إنشاء: عنوان + محتوى (textarea min-h-48) + وسوم + مفاتيح مثبتة (Pin)/سرية (Eye) → `updateNote` أو `addNote` بنوع "note" وتاريخ اليوم.
   - «حوّلها مهمة» → `addTask` بعنوان الملاحظة وتاريخ اليوم + toast.success «أُنشئت مهمة من الملاحظة» · «دوّن يومية» → `setView("journal")` · حذف بـConfirmBar → `deleteNote`.
   - مزامنة المحرر keyed بـ`noteId` (تفادي فقدان التعديلات غير المحفوظة عند re-emit).
8. **`src/components/systemy/notes/notes-utils.ts`** (جديد): `parseTags` (فاصلة عربية/لاتينية)، و«المفضلة» كوسم داخلي `FAV_TAG="مفضلة"` في حقل tags (النوع Note المشترك بلا حقل favorite — حل متوافق مع البيانات والنسخ الاحتياطي): `isFavorite`/`visibleTags`/`withFavorite`. يُخفى من شرائح الوسوم ومن حقل الوسوم في المحرر، ويُدار من أيقونة النجمة (w-11 h-11) على البطاقة عبر `updateNote(tags)`.
   - بطاقة المعرفة: عنوان + line-clamp-2 + وسوم chips + وقت نسبي `timeAgo(updatedAt)` + تثبيت/تفضيل سريعان (stopPropagation) + السرية تُموّه المحتوى (blur) وتكشف بالنقر (نمط الدفتر).

## القرارات المعمارية
- **المفضلة بلا تعديل types.ts**: وسم «مفضلة» داخلي في tags — ينتصر للعقد («ممنوع تعديل الملفات المشتركة») مع بقاء الحالة محفوظة وقابلة للنسخ الاحتياطي.
- **أيقونات المقررات الديناميكية**: عبر `createElement(iconByName(...))` في دالة مساعدة (رضا قاعدة react-hooks/static-components التي رفضت `const Icon = ...` أثناء التصيير).
- **جلسة المراجعة لقطة ثابتة**: تُبنى عند «ابدأ» حتى لا يقفز المؤشر عند تحديث liveQuery بعد كل `reviewFlashcard`.
- **تفادي مسح النماذج**: effects الحوارات keyed بالمعرفات (courseId/noteId) لا بكائنات البيانات.
- كل الكتابات عبر actions الجاهزة حصراً؛ لا fetch ولا خادم؛ Skeleton عند null وEmptyState بفعل حقيقي عند الفراغ؛ aria-labels عربية وأهداف ≥44px (أزرار w-11/h-11 وh-12).

## التحقق
- `bunx eslint src/components/systemy/learning/ src/components/systemy/notes/` → **exit 0، صفر أخطاء/تحذيرات**.
- `bunx tsc --noEmit` → **صفر أخطاء في src/ كلها** (لم يظهر أي خطب في ملفاتي في أي مرحلة؛ أخطاء وكلاء آخرين في home/tasks ظهرت مؤقتاً ثم أُصلحت من مالكيها).
- `dev.log` → 44 «✓ Compiled» فقط، لا أخطاء (الخادم توقف مؤقتاً من إدارة البيئة قبل الجولة الحية — لم أُشغّل خادماً بديلاً امتثالاً للتعليمات).

## للمنسّق / الوكلاء التالين
- الشاشتان تحقّقان كل بنود المواصفة: البطل بالأرقام الحية، تفاصيل المقرر ببنود الدرجة المرجّحة والتحذير، جلسة لايتنر الملخصة، الروابط الحية (expense/التقويم)، البحث والفلترة بالوسوم في الملاحظات، والتحويل لمهمة بيومية.
- ملاحظة للفحص الحي: بطاقات جديدة (`addFlashcard`) تستحق فوراً (nextReview=اليوم) فتظهر في عدّاد البطل مباشرة.
