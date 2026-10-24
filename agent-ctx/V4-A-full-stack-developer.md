# V4-A — إعادة تصميم قسم «الميزانية» وبطاقة النظرة العامة (شاشة المال)

**Task ID:** V4-A
**Agent:** full-stack-developer (Money/Budget)
**تاريخ التنفيذ:** مرحلة V4 — بعد V4-0 (الأساس)

## الملفات المعدلة (حصراً — لا شيء آخر لمس)

| الملف | التغيير |
|---|---|
| `src/components/systemy/money/budget-section.tsx` | إعادة تصميم كاملة (479 → 1092 سطراً) |
| `src/components/systemy/money/overview-section.tsx` | تحديث بطاقة الميزانية المختصرة فقط (497 → 507 أسطر) |

## ما بُني (بطاقات القسم بالترتيب)

1. **بطاقة «ميزانية الشهر — {monthLabel}»** (البطل): متبقي الشهر ذهبي كبير / «تجاوزت بـ» مرجاني إن سالب + سطر الحد/المصرف/الوتيرة + نقطة حالة BP_META + PaceBar بعلامة الوتيرة + سطر الإسقاط «بهذه الوتيرة ستُنهي الشهر عند {projected}» مع تحذير التجاوز. حالة unset → EmptyState يفتح ورقة الإعدادات.
2. **بطاقة «هذا الأسبوع — {week.label} من {weeksSpent.length}»**: تواريخ «{start} ← {end}» + صف ثلاثي (الحد/المرحّل بإشارة ±/المصرف) + متبقي الأسبوع البارز (نعناعي ≥0 / «⚠ تجاوزت» مرجاني <0) + «حدك اليومي المتبقي» ذهبي كبير + «لـN أيام متبقية · اليوم صرفت X» + أعمدة أيام الأسبوع المصغّرة (اليوم بحد ذهبي، مبلغ مصغر فوق كل عمود، محسوبة يومياً من txs بنفس شرط livingSpent) + رقائق أسابيع الشهر «أسبوع i: spent/budget» مع تمييز الحالي.
3. **بطاقة «الادخار والفائض»**: رصيد حسابات savings (مجموع accountBalance) أو «لا حساب ادخار بعد» + سطر آخر كنس sweep + زرا «سجّل دخلاً» (addIncome) و«حوّل للادخار» (addToSavings) بنموذج سريع داخلي + Switch «كنس فائض الشهر تلقائياً» (autoSweep — وعند التفعيل يستدعي sweepMonthLeftover() فوراً لأي فائض معلق).
4. **بطاقة «خارج ميزانية المعيشة»**: outsideSpent هذا الشهر + آخر 5 معاملات outsideBudget (أيقونة repeat ذهبية للالتزام المتكرر / receipt رمادية للاستثنائية) + حالة فراغ ممتازة + زر يفتح نموذجاً مصغراً داخلياً → ensureDefaultAccount + addTransaction(outsideBudget: true).
5. **بطاقة غير المصنّف** (شرطية كما كانت) + **قائمة المظاريف** (كما كانت).
6. **ورقة إعدادات الميزانية** (SheetShell + FormShell): الدخل الشهري / ميزانية المعيشة (مع رقائق: مجموع المظاريف، 50%/70% من الدخل) / حد الأسبوع (فارغ = تلقائي = الشهري ÷ عدد الأسابيع، مع زر «امسحه للاشتقاق التلقائي») / segmented مصير الفائض (next/savings/reset مع شرح لكل خيار) / Switch الكنس التلقائي. الحفظ saveSettings ثم toast «حُفظت إعدادات الميزانية ✓».

## قرار تصميمي مهم (وثّقه للوكيل التالي)

- النص الأصلي للمهمة قال: زر «سجّل التزاماً خارج المعيشة» يفتح `openQuickAdd("expense")` إن وجد في ui-store. **openQuickAdd موجود فعلاً لكن QuickAddSheet لا يدعم علم outsideBudget إطلاقاً** (تحقق: صفر مطابقات لـ outsideBudget في src/components). فتحه كان سيسجّل مصروفاً عادياً يخصم من حد المعيشة — عكس هدف الميزة تماماً. لذلك اختِرط المسار البديل المنصوص عليه في المهمة: **نموذج مصغّر داخلي مع outsideBudget: true**. لو أُضيف لاحقاً toggle لـ outsideBudget في QuickAddSheet يمكن التبديل إلى openQuickAdd.
- BP_META / budgetBarColor / PaceBar **ما زالت مُصدَّرة بنفس التواقيع** — overview-section يستوردها (لا تكسرها).
- إسقاط استخدام budgetPacing من القسمين؛ الحساب كله الآن عبر weeklyStatus (نقطة استدعاء واحدة).
- KPI «اليوم صرفت» في بطاقة النظرة العامة المختصرة يظهر todaySpent مباشرة.

## الفحوصات

- `bunx tsc --noEmit`: **صفر أخطاء src/** (بقية الأخطاء في examples/ وskills/ فقط — مُتجاهَلة بموجب التعليمات).
- `bun run lint`: نظيف 100%.
- dev.log: تجميعات نظيفة + GET / 200 بلا أخطاء تشغيل.

## الربط بمحرك weeklyStatus (خريطة الاستهلاك)

- month hero: monthLabel, month.{remaining,budget,spent,expectedByNow,projected,status,dayOfCycle,daysInCycle}
- week card: week.{label,start,end}, weeksSpent (رقائق + طول), weeklyBudget, carryIn, weekSpent, weekRemaining (سالب=أحمر), dailyLimit, todaySpent, daysLeftInWeek
- outside card: outsideSpent + monthWindow (فلترة txs خارج الميزانية)
- savings card: accounts(type=savings)+accountBalance + txs(source=sweep) + settings.autoSweep
- overview card: monthLabel, month.status (BP_META), weekRemaining, dailyLimit, todaySpent, week.label, month.{remaining,budget,spent,expectedByNow,status}
