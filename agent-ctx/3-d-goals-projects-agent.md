# Task 3-d — goals-projects-agent

## المهمة
بناء شاشة «الأهداف والادخار» وشاشة «المشاريع والعمل» كاملتين (Systemy v3) — استبدال النسختين التأسيسيتين داخل المجلدين المملوكين حصرياً.

## الملفات (كلها داخل ملكيتي — صفر تعديل على أي ملف مشترك)
- `src/components/systemy/goals/goals-screen.tsx` (34 → ~300 سطراً)
- `src/components/systemy/goals/goal-form-dialog.tsx` (جديد ~230)
- `src/components/systemy/goals/goal-details-dialog.tsx` (جديد ~640)
- `src/components/systemy/projects/projects-screen.tsx` (34 → ~400 سطراً)
- `src/components/systemy/projects/project-form-dialog.tsx` (جديد ~215)
- `src/components/systemy/projects/project-details-dialog.tsx` (جديد ~560)

## نمط معماري ملتزم به
- جذر الشاشة: `h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28` + ترويسة mb-4 (22px bold + سطر 12px muted) + زر + 44px.
- قراءة: useLive حصراً (الأهداف: settings/goals/tasks/habits/txs/accounts — المشاريع: settings/projects/tasks/blocks/txs). تحميل → Skeleton pulse، فراغ → EmptyState بفعل حقيقي (فتح نموذج الإنشاء).
- كتابة: actions فقط — addGoal/updateGoal/deleteGoal/contributeGoal/withdrawGoal/addTask/toggleTask و addProject/updateProject/deleteProject/addTask/toggleTask/addBlock/openQuickAdd.
- Details كـ Drawer سفلي (نمط SheetShell/دليل المال) — ليس Dialog مركزياً (أفضل للجوال مع محتوى طويل scrollable max-h-74vh).
- PrivateAmount لكل المبالغ، أرقام tabular، aria-labels عربية، لمس ≥44px (h-11/min-h-11)، widgetEnter متدرج، whileTap على أزرار الرأس.
- framer-motion خفيفة. ألوان: mint/gold/coral/cyan/primary — صفر أزرق/نيلي (حتى ColorSwatches مقيّدة بقائمة فرعية بلا #8EC5FF/#C4B5FD).

## الأهداف — التفاصيل المنفذة
1. **البطل**: إجمالي الادخار (PrivateAmount كبير mint) + «N هدف نشط» + chip ذهبية «أقرب موعد: {emoji} {name} — {تاريخ} (بعد N يوماً)».
2. **البطاقة**: emoji بدائرة tint(color)، الاسم، شريط تقدم بلون الهدف (متدرج ذهبي→نعناعي عند الاكتمال + glow-gold)، سطر: متبقٍ (PrivateAmount ذهبي) + النسبة + شهرياً + chip «يكتمل {تاريخ}» ذهبية أو «متأخر» مرجانية + «بعد/فات N يوماً». اللمسة تفتح التفاصيل.
3. **التفاصيل**: مساهمة سريعة (أزرار 50/100/200 + مخصص + منتقي حساب chips radiogroup «بدون ربط»/حسابات) → contributeGoal؛ سحب (عند savedAmount>0، تحقق ≤ المحفوظ) → withdrawGoal؛ محاكاة «ماذا لو» (chips 100–2000، الافتراضي monthly الهدف) → «يكتمل في ~N شهراً» بصيغ عربية سليمة (شهر/شهرين/أشهر/شهراً) + «محاكاة فقط — لا تُنشئ شيئاً»؛ مهام goalId (checkbox toggleTask + إضافة addTask بgoalId، Enter يعمل)؛ عادات goalId (أيقونة+اسم+«+X / إنجاز») + زر «افتح العادات» setView("habits")؛ زر «سجل المساهمات في المال» goToMoney("transactions") + chip عدد الحركات (txs.goalId)؛ تعديل (يفتح النموذج) + حذف ConfirmBar. الدرج يبقى مفتوحاً بعد المساهمة ليرى المستخدم التقدم الحي يتحرك.
4. **النموذج**: الاسم/emoji (8)/اللون/المستهدف (NumberPad)/الشهري/الموعد → addGoal أو updateGoal (التعديل لا يمس savedAmount).

## المشاريع — التفاصيل المنفذة
1. **البطل**: «دخل المشاريع هذا الشهر» (PrivateAmount mint — txs حيث projectId+income ضمن الشهر **المالي** financeMonthStart/End بmonthStartDay من الإعدادات) + chip «N مشروع نشط» + chip «N مهمة مفتوحة» (projectId && !done).
2. **فلاتر**: chips 44px radiogroup — النشطة/المتوقفة/المنجزة/الكل (مع عدّادات بين قوسين)؛ فراغ الفلتر → EmptyState مضغوط بفعل مشروع جديد.
3. **البطاقة**: أيقونة lucide بفقاعة tint(color) (عبر ProjectGlyph — إغلاق خريطة آمن لقاعدة react-hooks/static-components)، الاسم + chip الحالة (mint/gold/primary)، «لا مهام بعد» أو شريط تقدم done/all بلون المشروع، الموعد chip («فات الموعد» مرجانية إن فات وغير منجز) + أيام، سعر الساعة إن وجد.
4. **التفاصيل**: وصف؛ شريط تقدم المهام؛ **الحالة** radiogroup → updateProject؛ **مهام المشروع**: آخر 6 (createdAt desc) checkbox toggleTask + إضافة (عنوان/تاريخ/أولوية chips) → addTask(projectId)؛ **وقت المشروع**: عدد جلسات blocks + المدة formatDurationAr (مجموع دقائق end−start) + «القيمة القابلة للفوترة ≈ X» (ساعات × ratePerHour — PrivateAmount ذهبي) + زر «سجّل جلسة عمل (ساعة من الآن)» → addBlock(type work, projectId, اليوم، now→+60min بminutesToHHMM، بلون وأيقونة المشروع)؛ **المال المرتبط**: بلاطتا دخل (mint)/مصروف (coral) + آخر 4 معاملات (وصف/±مبلغ ملون) + زرا «دخل مشروع»/«مصروف مشروع» openQuickAdd("income"/"expense") (يغلق الدرج أولاً) + ملاحظة أن الربط التفصيلي من تبويب المعاملات؛ تعديل + حذف ConfirmBar بنص «مهامه وجلساته ومعاملاته تبقى — بلا ربط» (مطابق لسلوك deleteProject في actions).
5. **النموذج**: الاسم/الوصف/الأيقونة (16 اختياراً)/اللون/الموعد/سعر الساعة اختياري → addProject (status active) أو updateProject.

## التحقق
- `bunx eslint src/components/systemy/goals/ src/components/systemy/projects/` → **exit 0** (بلا تحذيرات).
- `bunx tsc --noEmit` → **صفر أخطاء** في ملفاتي (الأخطاء المتبقية في tsc كلها لملفات وكلاء موازيين: home/shared.ts، tasks/focus-timer-card.tsx، tasks/task-detail-dialog.tsx).
- dev.log: كل حفظات ملفاتي ولّدت «✓ Compiled» بلا أي خطأ (آخر GET / 200). ملاحظة: خادم dev النظامي توقف ~09:58 أثناء الجولة (بلا علاقة بملفاتي — كان نظيفاً حتى آخر لحظة) ولم يُسمح لي بتشغيله؛ التحقق الساكن الكامل يغطي.

## قرارات معمارية موثقة
1. **Drawer سفلي بدل Dialog مركزي للتفاصيل والنماذج** — مواصفة «Dialog تفاصيل» تُفهم كطبقة حوار؛ الدرج السفلي هو نمط Systemy الموحد للطبقات الغنية (SheetShell في المال، HabitFormDialog في العادات) وأفضل في الجوال RTL.
2. **goToMoney("transactions")** لزر «سجل المساهمات في المال» (بدل goToMoney() العام) — تحويلات الادخار source:"goal" تظهر في تبويب المعاملات تحديداً.
3. **الشهر المالي** (financeMonthStart/End بmonthStartDay) لدخل المشاريع «هذا الشهر» — اتساقاً مع مفهوم الشهر في كل مكان بالتطبيق بدل الشهر التقويمي.
4. **مساعدات tint/SectionTitle/daysLeftAr/monthsAr محلية داخل المجلدين** (مكررة صغيرًا) بدل الاستيراد من money/money-screen — عزل ملكية كامل عن ملفات وكيل المال المتغيرة بالتوازي.
5. **الد densities**: إغلاق خريطة `[name].map()` للأيقونات الديناميكية (ProjectGlyph) — الحل المعتمد في habits-screen لقاعدة react-compiler «Cannot create components during render».
6. **مساهمة/سحب يبقيان الدرج مفتوحاً** — الوعاء يتحرك حياً أمام المستخدم (useLive) — أفضل تجربة من الإغلاق؛ حذف/تعديل يغلقان.
