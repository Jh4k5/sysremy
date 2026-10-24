# Task 7 — Local-first Data Layer (standalone APK mode)

**Agent:** full-stack-developer (local-first)
**Status:** ✅ مكتمل ومُتحقق منه تفاعلياً

## ما بُني
طبقة بيانات محلية كاملة تجعل التطبيق يعمل 100% بلا خادم داخل WebView (file://android_asset):

1. **`scripts/export-snapshot.ts`** — يصدّر كل جداول SQLite عبر Prisma إلى `src/lib/snapshot-data.ts` (`SNAPSHOT: SnapshotData`). شُغّل فعلياً: 96.2KB، accounts 5 · categories 14 · transactions 82 · habits 6 · habitLogs 128 · moods 30 · tasks 7 · notes 12 · goals 4 · systems 8 · recurrings 6 · assets 4 · debts 2.
2. **`src/lib/local-db.ts`** — قاعدة في الذاكرة: `loadLocalDb()` (localStorage key `systemy.localdb.v2` → JSON.parse، وإلا deep-clone من SNAPSHOT مع تحويل ISO→Date)، `getDb/nextId/touch/persistNow/resetLocalDb`، حفظ debounce 300ms، تعريف `SnapshotData` وجميع صفوف الذاكرة (WithDates).
3. **`src/lib/local-api.ts`** (2280 سطراً) — `installLocalApi()/uninstallLocalApi()`: معترض fetch يحوّل `/api/**` النسبية إلى منطق محلي ويعيد `new Response(JSON.stringify(data), {status, headers})`، وما عداها يمر للـ fetch الأصلي. المنطق منقول من كل الـ routes: today/habits+toggle (streak متسامح)/tasks/mood/notes/insights (مع score.step)/money/systems/transactions (فلاتر + تصنيف keywords + عكس الرصيد)/capture+preview (محرك القواعد العربي كاملاً بلا LLM)/search (أوامر مدمجة)/sys (ردود قواعدية: قهوة/أسبوع/دخل/عادات/fallback هادئ). حسابات finance منقولة محلياً.
4. **`src/lib/standalone.ts`** — `isStandalone()`: NEXT_PUBLIC_STANDALONE=1 أو ?standalone أو userAgent يحوي SystemyWebView (+ standaloneServerSnapshot/subscribeNever للـ hydration الآمن).
5. **`app.tsx`** — `useState(() => { if (isStandalone()) installLocalApi(); })` قبل أي fetch من الأبناء + إخفاء StatusBar في standalone. **`page.tsx`** — standalone → `<div className="h-dvh w-full overflow-hidden"><SystemyApp /></div>` فقط؛ الوضع الطبيعي كما هو بكسلياً. **`next.config.ts`** — `output/assetPrefix` الشرطيان بـ BUILD_EXPORT + `images.unoptimized`.

## ممنوعات محترمة
- لا استيراد لـ `@/lib/db`/Prisma/`z-ai-web-dev-sdk` في أي ملف يُحزَّم للعميل (تم التحقق بgrep: فقط db.ts وfinance.ts الخادمية تستوردهما).
- لم تُلمس: `src/app/api/**`، الشاشات (سوى app.tsx المسموح)، `types.ts`، `prisma/**`، البقية.

## نتائج التحقق الفعلية
- `bun run lint` نظيف (exit 0) + tsc بلا أخطاء في ملفات المهمة.
- curl: `/` → 200 و`/?standalone=1` → 200.
- **اختبار حاسم**: route-abort لكل `**/api/**` في الشبكة ثم إعادة تحميل standalone → التطبيق يعمل كاملاً (تحية/أرقام/عادات) — صفر اعتماد على الخادم.
- التقاط: «قهوة 18 من ستاربكس» → معاينة (مصروف/18/قهوة/ستاربكس) → حفظ → toast «سُجل في أقل من 3 ثوانٍ» → tx في localStorage (id `l…`، حساب نقد 620→602) → إعادة تحميل → المعاملة ظاهرة (timeline 5:16م/18 + شاشة المال) — استمرارية مؤكدة.
- عادة «النوم قبل 12»: toggle → السلسلة 1→2 في الواجهة وlocalStorage وbestStreak=4 محفوظ، وبقت 2 بعد reload.
- Sys محلي: «كم صرفت على القهوة؟» → «234 ر.س من 13 معاملة» (216+18 ✓)؛ «لخص أسبوعي» → أرقام حية 1,293 (1,275+18 ✓).
- Insights standalone: درجة 65 «جيد جداً» + step + كل الأقسام — مطابق للخادم.
- حساب Safe-to-Spend من SNAPSHOT نظيفاً = 613 مطابق للخادم حرفياً (expectedIncome 15802/commitments 262/goals 2800/spent 4773).
- الوضع الطبيعي غير متأثر: لا معترض (fetch أصلي)، صافي الثروة 103,650 من الخادم (standalone: 103,632 = −18 للقهوة المحلية)، StatusBar ظاهر، bumpRefresh يعمل (toggle عادة عبر الخادم 1→2→1 وأُعيدت الحالة الأصلية في القاعدة).
- لا أخطاء console في الحالتين (فقط تحذيرات framer-motion strokeDashoffset مسبقة في شاشة الرؤى — ليست من طبقتنا ولا تُصلَح دون لمس الشاشة الممنوع).
- لقطات: `upload/task7/verify-*.png` + `standalone-*.png`.

## ملاحظات للوكلاء التالين
- سجلات المهام السابقة إن وُجدت في `/agent-ctx` فغير متاحة هنا (المجلد غير قابل للإنشاء على الجذر) — أنشئت `agent-ctx/` داخل المشروع.
- لإعادة توليد اللقطة بعد أي تعديل على قاعدة البيانات: `bun scripts/export-snapshot.ts`.
- بناء APK: `BUILD_EXPORT=1 NEXT_PUBLIC_STANDALONE=1 bun run build` → `out/` ثم حزمه في android_asset.
