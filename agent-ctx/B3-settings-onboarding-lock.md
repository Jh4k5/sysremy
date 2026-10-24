# Task B3 — Settings + Onboarding + Lock (agent record)

**Agent:** B3 (Z.ai Code)
**Date:** 2026-02-19 (session)
**Scope:** شاشات الإعدادات والإعداد الأولي والقفل لـ Systemy v2.0 — فوق عقود الطبقة الأساسية (Task 13).

## الملفات المسلَّمة (3، كلها "use client")

1. **`src/components/systemy/lock/lock-screen.tsx`** (241 سطراً)
   - `LockScreen({ onUnlocked })` — بوابة القفل: avatar + "أهلاً بعودتك" + الاسم + نقاط PIN متغيرة (4-6) + لوحة أرقام digits-only + اهتزاز framer-motion عند الخطأ + "نسيت الرمز؟" بعد محاولتين.
   - تحقق: `hashPin(entered) === settings.pinHash` → onUnlocked(). تحقق تلقائي عند كل طول ≥ 4 (يدعم رموزاً أطول)، حارس token للتحقق المتزامن، مسح تلقائي بعد 1.2 ث من الخطأ، أثر هرمني 8ms.
   - أمان: إن تعرّض القفل بلا pinHash (استيراد جزئي) يفتح تلقائياً.
   - **صادرات إضافية مشتركة:** `PinPad` (لوحة 1-9/0/⌫ بروح NumberPad) و`PinDots` (نقاط مقنّعة) — تستوردها شاشة الإعدادات لنافذة الرمز.

2. **`src/components/systemy/onboarding/onboarding.tsx`** (509 أسطر)
   - `Onboarding` — معالج 3 خطوات بنقاط تقدم + سابق/تالي + انتقالات شريحة framer-motion (اتجاه RTL صحيح: الأمام يدخل من اليسار).
   - الخطوة 1: شعار 🌙 زجاجي + "نظام تشغيلك الشخصي" + الاسم (التالي معطّل بدونه) + منتقي 8 إيموجي.
   - الخطوة 2: عملة (chips 7 + مخصص) + بطاقتا سؤال قابلان للفتح على NumberPad: الدخل الشهري (اختياري) و"كم معك نقداً الآن؟" (اختياري + تخطي → cashBalance=null).
   - الخطوة 3: بداية الأسبوع ChipRow + بداية الشهر المالي (chips 1/15/25 + input 1-28 بتثبيت عند blur) + ملخص "جاهز!" + "ابدأ نظامي".
   - الإنهاء: `completeOnboarding({...})` (يبذّر 14 فئة + 8 أنظمة + ينشئ حساب "نقد" عند وجود cashBalance) ثم `useUIStore.getState().setView("today")`، مع toast خطأ عند الفشل.
   - يستورد الثوابت المشتركة (AVATAR_EMOJIS/CURRENCY_CHIPS/WEEK_START_OPTIONS) من شاشة الإعدادات — بلا تكرار.

3. **`src/components/systemy/settings/settings-screen.tsx`** (1367 سطراً)
   - `SettingsScreen` — الجذر `h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28` + هيكل عظمي أثناء null + بطاقة ملخص (avatar + الاسم + S الشعار + Chip v2.0).
   - **مكوّن Section قابل للطي** (AnimatePresence + height:auto) يُستخدم للأقسام السبعة.
   - 1) **الملف الشخصي**: شبكة إيموجي (8) + الاسم + العملة (chips + مخصص) + يوم الشهر (1-28) + بداية الأسبوع + حفظ → updateSettings + setCurrency. يُعاد تهيئة النموذج بمفتاح profileKey فقط عند تغير القيم المحفوظة.
   - 2) **المظهر**: أرقام ChipRow (123 / ١٢٣) → فوري؛ ألوان التمييز ACCENTS الخمسة (ذهبي/سماوي/نعناعي/مرجاني/بنفسجي) مع swatches + تسميات → updateSettings({accent}) + `--primary`/`--ring` حياً عبر `applyAccent` (يُطبَّق أيضاً عند التحميل بـ useEffect مع setCurrency).
   - 3) **الإشعارات**: Switch المتصفح → requestNotificationPermission ثم updateSettings (مع toast مناسب)؛ شارة الحالة (ممنوح/مرفوض/غير مدعوم/بانتظار)؛ زر تجربة عند المنح؛ Switch التنبيهات داخل التطبيق. قراءة الصلاحية بمُهيئ useState (آمن الترطيب لأن القسم لا يُركّب إلا بعد تحميل الإعدادات في العميل).
   - 4) **القفل**: Switch (تفعيل → set/verify، تعطيل → disable يتطلب الرمز الحالي) + تغيير الرمز + تحذير الفقدان. **PinDialog** مخصص (glass-deep، يغطي منطقة الشاشة): مراحل old/new/confirm بنقاط مقنعة + PinPad + اهتزاز + Escape، hashPin ثم updateSettings({lockEnabled, pinHash}).
   - 5) **المالية**: الدخل الحالي بformatMoney + تعديل NumberPad قابل للفتح + ملاحظة "الرصيد الآمن" + زر "فتح شاشة المال" عبر goToMoney.
   - 6) **البيانات** (الحرج): تصدير (exportBackup)؛ استيراد (input مخفي + peekBackup → معاينة أعداد بعناوين عربية + ChipRow دمج/استبدال + ConfirmBar خطر للاستبدال → importBackup)؛ **إعادة الضبط الانتقائي** لكل RESET_SCOPES عدا everything مع أعداد حية useLive لكل جدول (Chip لكل جدول + الإجمالي) + ConfirmBar → resetScope + toast "تمت إعادة الضبط"؛ **حذف الحساب نهائياً** بمنطقة خطر حمراء وتأكيد مزدوج (كتابة "حذف") → deleteAccountForever؛ **تشخيص** healthCheck قابل للطي بأعداد الجداول.
   - 7) **حول**: v2.0 + "يعمل محلياً على جهازك — لا خادم ولا حساب" + وعد الخصوصية + سطر التقنية.

## الالتزامات المعمارية
- القراءة: useLive + getSettings فقط (settings، أعداد الجداول عبر liveQuery). الكتابة: updateSettings/completeOnboarding/resetScope/backup helpers. **صفر fetch، صفر Prisma، صفر z-ai-sdk.**
- صادرات مسمّاة: SettingsScreen، Onboarding، LockScreen (+ PinPad/PinDots/الثوابت المشتركة كصادرات مساندة).
- عربي RTL كامل، لمسات ≥ 44px، aria-labels/roles/aria-expanded، skeletons عند null، أموال عبر formatMoney.

## التحقق
- `bunx eslint` على الملفات الثلاثة: **exit 0 — نظيف تماماً**.
- `bunx tsc --noEmit`: صفر أخطاء في ملفاتي (أخطاء src/app/api/** القديمة وملفات B1/B2 الجارية خارج نطاقي ولم أمسّها).
- dev.log: "✓ Compiled" وذكر صفر لملفاتي في أي خطأ (الملفات بانتظار مهمة التكامل التي ستربط app-shell الجديد).
- حُدّد وتصُحّح أثناء البناء: استيراد resetScope الناقص، معامِل displayDigit الثاني، setState-dans-effect (react-hooks/set-state-in-effect) عبر مُهيئ كسول، aria-controls بمعرّفات عربية (استُبدلت بمعرّفات ASCII).

## ملاحظات لمهمة التكامل (الوكيل التالي)
- `<Onboarding />` تُعرض عندما `settings && !settings.onboardingDone` (بدون props).
- `<LockScreen onUnlocked={...} />` تُعرض عند lockEnabled && pinHash (يفضَّل overlay absolute inset-0 فوق كل الطبقات، والأفضل استدعاء setLocked(true) عند الإقلاع إن كان القفل مفعّلاً).
- `<SettingsScreen />` تُعرض عند view === "settings".
- عند إقلاع التطبيق يُنصح بتطبيق `setCurrency(settings.currency)` و`applyAccent` من الإعدادات — شاشة الإعدادات تفعل ذلك ذاتياً عند تركيبها، لكن TodayScreen قد تحتاج setCurrency مبكراً من الـshell.
