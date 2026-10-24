# Task 16-a — واجهات ميزانية الصرف (تبويب الميزانية + بطاقة اليوم + بطاقة النظرة العامة)

Task ID: 16-a · Agent: full-stack-developer

## ما نُفّذ (فوق محرك budgetPacing من Task 15 — استهلاك دون إعادة كتابة)

### 1. `src/components/systemy/money/budget-section.tsx` (جديد ~430 سطراً)
- **Hero «ميزانية الصرف الشهرية»**: PrivateAmount كبير (pacing.monthlyBudget بتوهج ذهبي + glow عند great) + شارة حالة (BP_META: great «أمام الوتيرة 👏» نعناعي / good «على المسار» / careful «خلف الوتيرة» ذهبي / over «تجاوزت الشهري» مرجاني) + سطر «منفصلة عن دخلك — منها نحسب متبقي اليوم والأسبوع والشهر» + رقاقة ذهبية «مشتقة تلقائياً من المظاريف — حدّد رقمك الخاص» عند pacing.derived.
- **زر «تعديل» (44px)** يفتح محرراً inline داخل الهيرو: إدخال inputCls رقمي (type=number/inputMode=decimal) + رقائق سريعة تملأ الحقل (اعتمد مجموع المظاريف · المبلغ — مخفية عند envelopesSum=0، و50%/70% من الدخل عند دخل>0) + «حفظ» (تحقق ≥0 ثم saveSettings({monthlyBudget}) → toast.success «حُدّدت ميزانية الشهر ✓» بوصف «≈ X يومياً عبر N يوماً متبقياً» محسوب من الميزانية الجديدة) + «إلغاء». عند status=unset: هيرو EmptyState بأيقونة Gauge («ابدأ بمجموع المظاريف» يحفظ envelopesSum إن>0 وإلا يفتح المحرر).
- **بطاقة الإيقاع**: 3 أعمدة glass-soft (متبقي اليوم كبير مرجاني عند السالب / متبقي الأسبوع + «N أيام» / متبقي الشهر + «N يوماً متبقياً») + **PaceBar**: شريط full-width بلون الحالة (over→coral/careful→gold/else mint) + علامة وتيرة بيضاء 2px عند min(100, expectedByNow/monthlyBudget)% بعنوان «الوتيرة المستهدفة حتى الآن» + سطر «صرفت X من Y» + جملة الدلتا (خلف/أمام الوتيرة بـ N / على الوتيرة تماماً) + توقع (ستتجاوز بـ N نهاية الشهر مرجاني / ستكمل الشهر داخل الميزانية ✓ نعناعي).
- **مصروف غير مصنّف**: بطاقة عند وجود مصروف الشهر بلا فئة (المبلغ + شريط ذهبي من إجمالي المصروف + «صنّفها في المعاملات» → onGoToTab("transactions")).
- **المظاريف كاملة**: كل الصفوف بترتيب percent desc (envelopes()) مثل صفوف النظرة العامة (IconBubble + نسبة ملونة + شريط ENV_COLOR + بقي/تجاوزت) داخل max-h-96 overflow-y-auto sys-scroll + زر رأس «تحرير المظاريف» → onGoToTab("categories") + نص فراغ «لا مظاريف بعد — أضف ميزانية للفئات من تبويب الفئات».
- صادرات مشتركة تستهلكها النظرة العامة: `BP_META` و`budgetBarColor` و`PaceBar` — مصدر واحد لحالة الميزانية بلا تكرار.

### 2. `money-screen.tsx`
- `"budget"` في MoneyTabId + TABS في الموضع الثاني `{ id: "budget", label: "الميزانية", icon: Gauge }` + تصيير BudgetSection بنمط الأقسام الأخرى. goToMoney("budget") يعمل تلقائياً عبر تلميح moneyTab.

### 3. `overview-section.tsx`
- `bp: budgetPacing(settings, categories, txs)` في view useMemo.
- بطاقة إيقاع مختصرة في الموضع 2 (بعد هيرو صافي الثروة، قبل الرصيد الآمن) — فقط عند status≠unset: زر <button> كامل (aria-label «فتح تبويب الميزانية») بترويسة «ميزانية الصرف — {financeMonthLabel}» + شارة الحالة + الرقم الكبير todayRemaining بlabel «متبقي اليوم» (مرجاني عند السالب) + «الأسبوع X · الشهر Y» + PaceBar بعلامة الوتيرة. أُعيد ترقيم تعليقات الأقسام 3..9.

### 4. `today-screen.tsx`
- useLive: أُضيف db.categories.toArray() (Promise.all + الإرجاع + التفكيك) + `pacing = budgetPacing(settings, categories, txs, today)`.
- عند status≠unset: **بطاقة «ميزانية اليوم»** تحل محل الرصيد الآمن: الرقم الكبير todayRemaining (CountUp + PrivateAmount، توهج ذهبي أو مرجاني عند السالب مع سطر «تجاوزت حصة اليوم بـ N») + شارة حالة (يوم مريح/على المسار/خلف الوتيرة/تجاوزت الشهري) + «حصة اليوم X · صُرف اليوم Y» + شريط رفيع لspentToday مقابل perDay (مرجاني عند التجاوز) + رقاقتا «الأسبوع/الشهر» + زر «الميزانية ←» (min-h-11) → goToMoney("budget").
- عند unset: بطاقة الرصيد الآمن كما هي حرفياً + زر ذهبي full-width (min-h-11) «حدّد ميزانية صرف شهرية ←» → goToMoney("budget"). بقية البطاقات لم تُمس.

## التحقق
- `bunx eslint` على الملفات الأربعة → **exit 0**.
- `bunx tsc --noEmit | grep (budget-section|money-screen|overview-section|today-screen)` → **صفر مخرجات** لملفات المهمة.
- dev.log: «✓ Compiled» متكرر بلا أي خطأ + GET / 200 بعد التعديلات.
- صفر fetch/Prisma — كل القراءة useLive (Dexie) والكتابة saveSettings فقط؛ لمسات ≥44px وaria عربية على كل العناصر التفاعلية.
