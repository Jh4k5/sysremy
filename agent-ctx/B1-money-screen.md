# B1 — شاشة المال الموسّعة (Systemy v2.0)

**Task ID:** B1
**Agent:** B1 (Z.ai Code)
**Date:** 2026-10-19/20
**Scope:** إعادة بناء شاشة المال كاملة فوق عقود Task 13 (useLive/actions/money/format/ui-store) — بلا أي تعديل على ملفات العقود.

## الملفات الثمانية (كلها "use client")

كلها في `src/components/systemy/money/`:

| الملف | الوظيفة |
|---|---|
| `money-screen.tsx` | الشاشة الرئيسية: هيرو مصغر (صافي الثروة + زر خصوصية) + شريط تبويبات لاصق (7) + القسم النشط. تجمع `MoneyData` بuseLive واحد وتوزعه props على الأقسام |
| `overview-section.tsx` | هيرو صافي الثروة (glow-gold عند great) + runway chip + الآمن صرفه بالمعادلة + ملخص الشهر المالي (delta%) + مخطط أعمدة 14 يوماً (divs نقية ذهبي/سماوي) + أعلى 6 فئات + أظرف أعلى 3 + المستحق خلال 7 أيام مع «سدد» + روابط سريعة |
| `tx-section.tsx` | بحث + فلاتر (نوع/حساب ≤5 رقائق وإلا Select/فئة Select/نطاق شهر مالي-30ي-الكل) + ترتيب (الأحدث/الأكبر مبلغاً) + تجميع بالأيام برؤوس لاصقة + ترقيم 25+25 + ورقة تحرير كاملة (Drawer) |
| `accounts-section.tsx` | إجمالي + بطاقات أرصدة مشتقة + CRUD (نوع/أيقونة/لون/افتتاحي NumberPad) + أرشفة تلقائية عند وجود معاملات |
| `categories-section.tsx` | مجموعتا مصروف/دخل + أظرف بأشرطة تقدم + **تعديل الميزانية inline من Popover** + CRUD كامل (كلمات مفتاحية للتصنيف الذكي) |
| `recurring-section.tsx` | قائمة بحالة الاستحقاق (اليوم/غداً/متأخر) + سدد الآن (رقائق حساب inline إن لم يحدد حساب) + Switch إيقاف + CRUD كامل |
| `goals-section.tsx` | بطاقات أهداف (emoji/نسبة/شهري/شهور متبقية/احتفال 🎉 عند 100%) + ساهم/اسحب بحساب اختياري + CRUD مع منتقي إيموجي 16 |
| `assets-debts-section.tsx` | ملخص ما لك/عليك/أصول + الأصول CRUD + الديون مجموعتي عليك/لك + سدد/استلم (Dialog بحساب اختياري أو بدون معاملة) |

## صادرات money-screen.tsx للاستخدام العام

- `MoneyScreen({ onBack? })` — onBack اختياري (يعرض سهم رجوع). **التكامل الجديد يرندرها بلا props**.
- `MoneyData` (type) — حزمة {settings, accounts, categories, txs, recurrings, goals, assets, debts}.
- `MoneyTabId` (type) — "overview" | "transactions" | "accounts" | "categories" | "recurring" | "goals" | "assets".
- `SheetShell({title, desc, onClose, children})` — ورقة سفلية موحدة (vaul Drawer، max-w-430، مركزية، RTL) — تستخدمها كل أوراق المال ويمكن لأي شاشة أخرى.
- `SysIcon` / `IconBubble` / `tint` — **توافق خلفي**: today-screen وsystems-screen القديمة تستوردها من هنا (كانت في money-screen القديم). SysIcon الآن عبر `createElement(iconByName(name))` (لتمرير قاعدة react-compiler "لا مكوّنات أثناء الرسم").

## سلوك التبويب المسبق (goToMoney)

- `moneyTab` من ui-store **يتقدم على** الاختيار المحلي حتى أول نقرة تبويب (تُستهلك حينها عبر `consumeMoneyTab()`). هذا بلا setState-in-effect (قواعد react-hooks v7) — التبويب مشتق مباشرة أثناء الرسم.
- أسماء التبويبات الصالحة كما في الأعلى — مركز التنبيهات يستدعي `goToMoney("recurring")` أو `goToMoney("assets")` إلخ.

## ⚠️ عيب مكتشف في العقود (يحتاج إصلاح من صاحب db.ts — لم أعدّله لأنه عقد محظور التعديل)

**`reminders` جدول Dexie لا يفهرس `sourceId`** (المخطط: `"id, dueAt, done, sourceType"`) بينما actions.ts يستخدم:
```ts
await db.reminders.where("sourceId").equals(id).delete()
```
في `payRecurring` و`deleteRecurring` و`deleteDebt` و`deleteHabit` — يرمي Dexie `SchemaError: KeyPath sourceId on object store reminders is not indexed`:

- في payRecurring: المعاملة تُنشأ والتاريخ يتقدم (قبل السطر المخالف) لكن **toast النجاح لا يظهر ولا يُجدول التذكير التالي** (كل ما بعده لا يُنفذ).
- الإصلاح المقترح: في db.ts اجعل `reminders: "id, dueAt, done, sourceType, sourceId"` مع رفع `this.version(2).stores({...})` (أو تعديل v1 مباشرة قبل توزيع التطبيق — القاعدة ما زالت فارغة عند المستخدمين الجدد).

## نتائج التحقق (متصفح حقيقي — agent-browser على localhost:3000)

عبر shell مؤقت (أنظمة → المال): الشاشة تُرندر كاملة، ثم فُحص فعلياً:
1. إضافة حساب «الراجحي» نقد 9000 عبر ورقة CRUD + NumberPad → بطاقة فورية + toast «أُضيف الحساب ✓» + اختفاء EmptyState (liveQuery ✔).
2. إضافة التزام «نتفلكس» 16 شهري بحساب الراجحي (Selects فئات/حساب تعمل) → toast «أُضيف الالتزام ✓ يستحق …».
3. «سدد الآن» → المعاملة ظهرت فوراً في تبويب المعاملات + رؤوس الأيام والفلاتر كاملة (toast لم يظهر بسبب عيب sourceId أعلاه — البقية سليمة).
4. ورقة تحرير المعاملة فُتحت كاملة (نوع/مبلغ/لوحة أرقام…).
5. الكونسول: صفر أخطاء من ملفات المال (فقط trace عيب sourceId من actions).

## حالة الأدوات

- `bunx eslint src/components/systemy/money/` → **نظيف**. `bun run lint` كامل → **exit 0** (تحذير واحد pre-existing في db.ts).
- `bunx tsc --noEmit` → **صفر أخطاء في ملفات المال** (الأخطاء المتبقية كلها pre-existing في legacy: api/** القديمة وfinance.ts وlocal-api.ts والشاشات القديمة التي تستورد DTOs المحذوفة — تُحذف في مرحلة التنظيف).
- dev.log: `GET / 200` — أخطاء 500 في /api/today و/api/systems هي مسارات v1 القديمة (Prisma-style على Dexie) — لا علاقة لي وستُحذف.

## لمهمة التكامل (app-shell الجديد)

```tsx
{view === "money" && <MoneyScreen />}
```
- الجذر `h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28` — يحتاج أباً بارتفاع محدد (مثل باقي الشاشات).
- `openQuickAdd` من ui-store مستدعى من: EmptyState الحسابات (overview)، زر «إضافة» (tx)، EmptyState الأهداف — يتطلب QuickAdd Sheet من مهمة أخرى.
- ملاحظة: أثناء عملي كان app.tsx مؤقتاً smoke shell تجريبياً لـB2 (تقويم/عادات) — سيستعيده.

---

## إعادة تشغيل B1 (جلسة تحقق نهائية — 2026-10-20)

**سياق:** الجلسة السابقة أُنهيت قبل تسجيل worklog.md. هذه الجلسة راجعت الملفات الثمانية كاملة مقابل المواصفات، وأجرت تحققاً حياً شاملاً، وأصلحت 4 قيم افتراضية.

### تحقق حي (متصفح + بيانات مزروعة عبر IndexedDB الخام)
- Shell مؤقت ركّب MoneyScreen، تعبئة 2 حساب + 3 فئات + 4 معاملات (مصروف/دخل/تحويل) + التزام + هدف + أصل + ديينين → reload.
- **نظرة عامة**: صافي الثروة ظهر **86,042 ر.س** — مطابق يدوياً تماماً (21,342 حسابات + 65,000 أصل + 200 لك − 500 عليك ✓). الآمن صرفه + ملخص الشهر + أعمدة 14 يوماً + أعلى الفئات + الأظرف + «مستحق خلال أسبوع» بزر «سدد» كلها ظهرت.
- **كل التبويبات السبعة** فُحصت بالنقر: المعاملات (صفوف مجمعة بالأيام + قهوة الصباح تحت «اليوم») / الحسابات (الراجحي + الإجمالي المشتق) / الفئات (أظرف الميزانية + بقالة وطعام) / المتكررة (نتفلكس + سدد الآن) / الأهداف (لابتوب + ساهم) / الأصول والديون (كامري + خالد) — **كلها PASS**.
- **ورقة تحرير المعاملة** فُتحت كاملة (رقائق النوع + الوصف + الحساب + حذف) — PASS (تأخير vaul الأولي فقط كان سبب MISS زائف).
- صفر page errors. لقطات + VLM في /home/z/b1-verify/.

### إصلاحات هذه الجلسة (أيقونات افتراضية خارج ICON_MAP كانت تسقط إلى Shapes)
- recurring: افتراضي `repeat`→`calendar-days` (وفي قائمة الاختيار) · accounts: `repeat`→`star` · categories: افتراضي `tag`→`star` · assets: افتراضي `gem`→`package` (وفي الاختيار).
- `bunx eslint src/components/systemy/money/` exit 0 · tsc صفر أخطاء لملفات المال · `bun run lint` كامل **exit 0** (تحذير db.ts الوحيد pre-existing).

### عقد db.ts المؤكد (تكرار من الأعلى — مصدره واحد لكنه حاسم)
فُحص فعلياً: فهارس reminders في القاعدة الحية = `done, dueAt, sourceType` — **بلا sourceId** → كل `db.reminders.where("sourceId")` في actions.ts يرمي SchemaError. الإصلاح مطلوب من مالك db.ts قبل الإطلاق.

### ملاحظة تشغيل للوكلاء المتوازيين
app.tsx يعود لshell B2 (تقويم/عادات) — تعديلي المؤقت أُزيل أثناء الجلسة، لم أعد لمسه. خادم dev يعمل على 3000.
