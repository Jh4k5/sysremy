# Task 16-c — تنبيهات ميزانية الصرف + أزرار تقرير HTML

Task ID: 16-c · Agent: full-stack-developer · Systemy v2.1

## What I did (only 3 files, contracts untouched)

### 1. `src/lib/alerts.ts` — section 3-b (budget pacing alerts)
- Added `budgetPacing` to the existing `./money` import (no other import changes).
- New section **3-b** inserted right after envelope alerts (section 3), before safe-zero (section 4):
  - `pacing = budgetPacing(settings, categories, txs)` — consumes Task 15 engine as-is.
  - Only when `pacing.status !== "unset"`:
    - `status === "over"` → danger «تجاوزت ميزانية الشهر» (detail: صرفت X من Y — الباقي من جيبك, targetView money, actionLabel «افتح الميزانية», dismissKey `budget-month-YYYY-MM`).
    - else `projectedOver > 0` → warning «بهذا الإيقاع ستتجاوز الميزانية» (المتوقع نهاية الشهر … — تجاوز …, dismissKey `budget-projected-YYYY-MM`).
    - else `delta > 0` → info «خلف وتيرة ميزانيتك بـ X» (الوتيرة المستهدفة حتى اليوم …, dismissKey `budget-pace-YYYY-MM`).
    - Independent check `weekRemaining < 0 && spent > 0` → warning «تجاوزت حصة الأسبوع» (متبقي الأسبوع … — عدّل من تبويب الميزانية, dismissKey `budget-week-YYYY-MM`).
  - All four also got `targetView: "money"` + `actionLabel: "افتح الميزانية"` (file principle: كل تنبيه يقود لإجراء). Icon `"gauge"` (already in ALERT_ICONS map of alerts-center.tsx).
- Max-6 cap and severity ordering logic untouched (used existing `push` helper + final sort).

### 2. `src/components/systemy/insights/insights-screen.tsx` — report button
- Imports: `useState`, `FileText`, `Loader2`, `toast` (sonner), `downloadHTMLReport` (@/lib/report).
- `reportBusy` state + `makeReport` exactly per spec (busy guard, success toast with filename, error toast, finally reset).
- Button «مستخلص HTML» in the main screen header row, grouped with the Sys AI chip (`flex items-center gap-2 shrink-0`): `h-11 min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary px-3.5` (matches onboarding's gold-accent button pattern), Loader2 `animate-spin` when busy, disabled while busy, aria-label «تنزيل مستخلص HTML للتقرير الشهري». Empty-state header left untouched.

### 3. `src/components/systemy/more-screen.tsx` — two new tiles
- Imports: `useState`, `Gauge`, `FileText`, `Loader2`, `toast`, `downloadHTMLReport`; `goToMoney` grabbed from `useUIStore` hook (not getState).
- Tile model extended (`key/onClick/ariaLabel/busy`) so action-tiles coexist with view-tiles; **grid stays `grid-cols-2`** → now 6 tiles = 3 clean rows.
- «الميزانية» (Gauge, mint #6EE7A8): `goToMoney("budget")`, subtitle «متبقي اليوم/الأسبوع/الشهر». NOTE: money-screen's TABS guard falls back to overview until 16-a lands the `budget` tab — deep-link will activate automatically then.
- «مستخلص HTML» (FileText, coral #FF8E7A): busy-state + `downloadHTMLReport()` + same toast as insights.
- Tiles are now `motion.button` with the exact GlassCard classes (`glass rounded-3xl relative overflow-hidden p-4 h-full w-full text-start` + interactive transform classes) → identical visuals, native a11y (aria-labels Arabic on all 6 tiles, keyboard focus, ≥44px targets). Rows/profile card unchanged; trailing `export { cn, Download }` preserved.

## Verification
- `bunx eslint src/lib/alerts.ts src/components/systemy/insights/insights-screen.tsx src/components/systemy/more-screen.tsx` → **exit 0**.
- `bunx tsc --noEmit | grep -E "alerts|insights-screen|more-screen"` → **empty** (no errors in my files).
- `tail -60 dev.log` → only «✓ Compiled» + 200s, zero errors/warnings.
- No agent-browser run (orchestrator verifies later). No other files touched.

## For the orchestrator / next agents
- When 16-a adds the `budget` tab to money-screen TABS, the MoreScreen «الميزانية» tile deep-links automatically (moneyTab hint already set to `"budget"`).
- Alert week/month keys are per-YYYY-MM so they re-arm each (finance) month; dismissal is daily via existing getDismissed()===today logic.
