# Systemy Inventory — v5.0 «الشريط» Baseline

> Evidence-based inventory produced by a read-only audit of branch
> `integration/life-os-merge` @ `463f319` (identical to the pushed GitHub
> `main`). Every claim cites `file:line`. Audit date: 2026-10-25.

## 1. Verified architecture (matches the stated audit constraint)

| Aspect | Value | Evidence |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | `package.json:56,58` |
| Language | TypeScript (strict) | `tsconfig.json` |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + framer-motion 12 | `package.json:57`, `src/app/globals.css` |
| Data | **Dexie 4.4.6 / IndexedDB, DB name `SystemyDB`** | `src/lib/db.ts:38,68` |
| State | Zustand 5 (UI-only) + Dexie `liveQuery` | `src/store/ui-store.ts:66`, `src/lib/db.ts:266-276` |
| Direction | Arabic-first RTL (`lang="ar" dir="rtl"`, IBM Plex Sans Arabic) | `src/app/layout.tsx:6-11,44` |
| Android | Static export wrapped in a Java `WebView` Activity (no JS bridge) | `apk/java/com/systemy/app/MainActivity.java`, `scripts/build-web-export.sh` |
| AI | `/api/sys` route (z-ai-web-dev-sdk, GLM) + offline rule engine; **API route is stripped from the APK build** | `src/app/api/sys/route.ts:36-56`, `scripts/build-web-export.sh:21-22`, `src/lib/standalone.ts:13-22` |

Confirmed: Next.js/React/TypeScript + Dexie/IndexedDB local-first + Android
WebView wrapper — exactly as the integration brief states.

## 2. Screen & system inventory (20 views, 15 registered "systems")

View switching is a flat conditional map over a `ViewId` union in
`src/components/systemy/app.tsx:140-159` (`src/lib/types.ts:535-555`).
All screens read via one `useLive` liveQuery (`src/lib/db.ts:266-276`)
and write only through `src/lib/actions.ts`.

| Screen | Key file(s) | Highlights | Data tables |
|---|---|---|---|
| Today | `today/today-screen.tsx` (643 L) | Greeting + Hijri date, budget-today hero w/ CountUp, 7-day habit SVG rings, unified day timeline (txs+habit logs+done tasks), mood widget, year-ago memory, next-action | settings, transactions, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories |
| Money (8 tabs) | `money/money-screen.tsx:54-73` | overview / budget / transactions / accounts / categories / recurring / goals / assets-debts | all money tables |
| ↳ Budget | `money/budget-section.tsx` (1157 L) | The precise-budget UI: month hero, this-week card (carry/daily-limit/day columns), savings & sweep card, outside-budget, uncategorized, envelopes | weeklyStatus, transactions, settings |
| ↳ Transactions | `money/tx-section.tsx` (801 L) | Search+filters, day grouping, full edit, CSV export, pagination | transactions, accounts, categories |
| ↳ Accounts | `money/accounts-section.tsx` | Derived balances, CRUD, auto-archive | accounts, transactions |
| ↳ Categories | `money/categories-section.tsx` | Envelope budgets + capture keywords | categories, transactions |
| ↳ Recurring | `money/recurring-section.tsx` | Due-status list, 1-tap pay, pause | recurrings, reminders |
| ↳ Goals | `money/goals-section.tsx` | Pots w/ %, monthly, celebrate, contribute/withdraw | goals, transactions |
| ↳ Assets & Debts | `money/assets-debts-section.tsx` | Settle/receive → linked txs | assets, debts, accounts |
| Tasks | `tasks/tasks-screen.tsx` + `focus-timer-card.tsx` | Filters, Pomodoro timer 15/25/45/60 w/ Web-Audio chime + auto calendar block, task↔project/course/person/trip/goal links | tasks, blocks, reminders |
| Habits | `habits/habits-screen.tsx` (839 L) + `habit-timer.tsx` | 7-day dots, one-tap complete, +1 counters, full-screen timer, streaks, 30-day heatmap, save-amount→goal link | habits, habitLogs, goals |
| Calendar | `calendar/calendar-screen.tsx` + `week-grid.tsx` | **RTL week grid 7d × 16h (07:00–23:00)**, unified events from blocks+tasks+recurrings+timed habits, golden "now" line | blocks, tasks, recurrings, habits |
| Journal | `journal/journal-screen.tsx` (872 L) | Entries + mood, **secret notes w/ reveal**, templates, on-this-day | notes(type=journal), moods |
| Insights | `insights/insights-screen.tsx` (1138 L) | Local analytics: score 40/40/20, correlations (mood↔spend/achievement), **cash predictions 30/60/90d + critical day**, anomaly detection | all core tables |
| Systems | `systems/systems-screen.tsx` (765 L) | The 15-systems hub: honest live indicators, feature chips, **customize mode** (drag-reorder, enable/disable, color/icon) | systems + counts from 22 tables |
| More | `more-screen.tsx` | Profile, tiles (incl. HTML report), v3 rows w/ live badges | many |
| Settings | `settings/settings-screen.tsx` | 7 sections: profile, appearance (5 accents, digits latn/arab), notifications, **PIN lock (SHA-256)**, finance (income/budget/carry/sweep), data (export/import/reset/delete), about | settings, backup |
| Learning | `learning/*` + `course-dialog.tsx` | Courses w/ **weighted grade items**, tasks, sessions, **Leitner 5-box spaced repetition** `[0,1,3,7,14,30]` | courses, flashcards, tasks, blocks |
| Travel | `travel/*` + `trip-details-dialog.tsx` | Trips w/ budget bar, packing list, itinerary blocks, linked expenses/tasks | trips, listItems, blocks, transactions, tasks |
| Vault | `vault/*` | Document metadata registry (8 types), expiry windows, favorites, **auto reminder 30d before expiry** | documents, reminders |
| Home | `home/*` | 4 tabs: grocery list, home bills (1-tap pay), home tasks, possessions w/ warranty/service reminders | listItems, recurrings, tasks, homeItems, transactions |
| People | `people/*` | CRM: relations, last-contact, favorites, neglect counter, person file w/ debts settle/receive, shared txs, birthday | people, debts, transactions, tasks, reminders |
| Notes | `notes/*` | Pinned/favorite/tag filters, editor, note→task | notes(type=note) |
| Projects | `projects/*` | Status filters, task-progress, **billable value = hours × ratePerHour**, linked income/expense | projects, tasks, blocks, transactions |
| Health | `health/*` + `sparkline.tsx` | 6 metrics w/ targets, ±steppers, 7/30-day SVG sparklines, week streak | healthLogs, moods, habits |
| Goals | `goals/*` | Pots + details w/ **what-if simulation**, linked tasks/habits | goals, tasks, habits, transactions, accounts |
| Quick Add | `quick-add/quick-add-sheet.tsx` (1137 L) | 4 money kinds (incl. saving→addToSavings, commitment→outsideBudget), 10 entity tabs, smart-capture toggle, live budget context line, recent chips | settings, accounts, categories, transactions |
| Sys chat | `capture/sys-chat.tsx` | Online GLM via `/api/sys` w/ local context; offline rule engine (spent-on/week summary/income/habits/goals) | read-only of 9 tables |
| Command bar | `capture/command-bar.tsx` | Ctrl+K, 11 commands, live search (txs/notes/habits/goals/blocks), smart capture ≥4 chars | 6 tables |
| Alerts center | `alerts-center.tsx` | Derived alerts (max 6) + reminders w/ open/complete/snooze/dismiss | buildAlerts + reminders |
| Lock | `lock/lock-screen.tsx` | PIN gate 4-6 digits, SHA-256 vs `settings.pinHash`, shake-on-error | settings |
| Onboarding | `onboarding/onboarding.tsx` | 3 steps → seeds categories+systems+cash account | settings, accounts, categories, systems |
| Landing | `src/app/page.tsx` | v5 day-world + PhoneFrame live preview + APK DownloadCard | — |

## 3. Data model — 26 Dexie tables (`src/lib/db.ts` v1→v3)

| Table | Indexes | Entity |
|---|---|---|
| `settings` | `id` | `Settings` (currency, monthStartDay, weekStart, digits, accent, monthlyIncome/Budget/weeklyBudget, carryOver, autoSweep, pinHash, …) `types.ts:16-44` |
| `accounts` | `id, type, archived, order` | `Account` `types.ts:50-62` |
| `categories` | `id, kind, archived, order` | `Category` (envelope budget + capture keywords) `types.ts:64-77` |
| `transactions` | `id, date, type, accountId, categoryId, recurringId, goalId` (+v3 `projectId, tripId`) | `Transaction` (source: manual/capture/recurring/goal/import/sweep; outsideBudget; tags/person/notes) `types.ts:81-107` |
| `habits` | `id, archived, order, remindAt` | `Habit` (target/unit, cadence, timerMinutes, remindAt, **saveAmount→goalId**, systemKey) `types.ts:177-199` |
| `habitLogs` | `id, habitId, date` | `HabitLog` (count, minutes) `types.ts:201-208` |
| `moods` | `id, date` | `Mood` (score 1-5, factors) `types.ts:231-238` |
| `tasks` | `id, date, done, priority` (+v3 links) | `Task` (priority, estimatedMinutes, courseId/projectId/personId/tripId/goalId) `types.ts:242-262` |
| `notes` | `id, type, pinned, secret, date, updatedAt` | `Note` (type note/journal, mood, tags, **secret**) `types.ts:264-276` |
| `goals` | `id, archived, order` | `Goal` (target/saved, targetDate, monthly) `types.ts:135-148` |
| `recurrings` | `id, active, nextDate, type` | `Recurring` (frequency, reminderDays, essential, home, outsideBudget) `types.ts:112-132` |
| `assets` / `debts` | `id` / `id, direction, dueDate` | `Asset` / `Debt` (payable/receivable) `types.ts:150-171` |
| `blocks` | `id, date, type, taskId, habitId` (+v3 links) | `TimeBlock` (07–23h grid entity) `types.ts:455-472` |
| `reminders` | `id, dueAt, done, sourceType, sourceId` | `Reminder` (10 source types) `types.ts:476-486` |
| `systems` | `id, key, order` | `SystemModel` (enabled, config JSON) `types.ts:503-515` |
| `chat` | `id, role, createdAt` | declared, **never written** |
| `healthLogs` | `id, date, kind` | `HealthLog` (6 kinds w/ targets) `types.ts:282-299` |
| `courses` / `flashcards` | `id, archived` / `id, nextReview, courseId` | `Course` (gradeItems JSON) / `Flashcard` (Leitner box 1-5) `types.ts:310-336` |
| `projects` | `id, status` | `Project` (ratePerHour) `types.ts:342-353` |
| `people` | `id, favorite` | `Person` `types.ts:359-369` |
| `documents` | `id, type, expiryDate` | `DocumentRecord` `types.ts:394-406` |
| `trips` | `id, status, startDate` | `Trip` `types.ts:412-422` |
| `listItems` | `id, scope, done, ownerId` | `ListItem` (grocery/trip) `types.ts:426-436` |
| `homeItems` | `id, nextService` | `HomeItem` `types.ts:440-449` |

Seeds: 14 Arabic categories w/ budgets + capture keywords
(`db.ts:166-181`), **15 default systems** (`db.ts:184-200`).

## 4. Business logic highlights

- **Budget engine** `src/lib/budget-engine.ts` (313 L): finance-month
  slicing into weekStart-anchored weeks (`:53-81`); `weeklyStatus()`
  (`:172-268`) = month pulse + week carry-in (`"next"` mode sums
  previous unspent weeks; `"reset"/"savings"` → 0) +
  `weekRemaining = weeklyBudget + carryIn − weekSpent` +
  `dailyLimit = max(0, weekRemaining) ÷ daysLeft`; month-end
  `sweepMonthLeftover()` (`actions.ts:292-349`, single-flight, transfer
  `source:"sweep"` → savings) runs at boot (`app.tsx:76-78`).
- **Smart capture** `src/lib/capture-rules.ts` (315 L, rule-based, no LLM):
  Arabic-Indic digit normalization, #tags, relative dates (قبل/بعد+N,
  بكرة/باجر, weekday names), times (ص/م), amount parsing, kind detection
  (TASK/MOOD/INCOME/BLOCK regexes `:182-185`), person extraction via
  من/لـ/الى, category keyword matching, mood scoring.
- **Alerts** `src/lib/alerts.ts`: 7 families, max 6, severity-sorted,
  daily-dismissable. Note: uses the older `budgetPacing`
  (`money.ts:207-273`) while the Budget tab uses `weeklyStatus` —
  **two coexisting pacing engines** (known inconsistency).
- **Backup** `src/lib/backup.ts`: JSON `{app:"Systemy",version:2,tables:{…}}`,
  replace/merge import, `peekBackup`, PIN hash, scoped reset.
- **Notifications** `src/lib/notifications.ts`: Web Notification API —
  **inert inside the APK WebView** (no `window.Notification`); reminders
  surface only as in-app toasts via `ReminderScheduler`
  (`app.tsx:241-306`, 30 s interval).

## 5. Working / partial / missing

- **Working (verified across sessions)**: all 15 systems above; precise
  budget math; export/import; PIN lock; RTL; landing+onboarding+APK
  pipeline (v5.0 versionCode 9 served from `public/downloads/`).
- **Partial**: theme = dark-only w/ 5 accents (no light mode);
  i18n = Arabic-only (digits toggle only); Sys AI = web-only (stripped
  from APK); notifications = in-app only in APK.
- **Missing**: no voice/OCR input, no file attachments, no cloud sync
  (by design), no share target, no widget/Siri, no cross-entity
  "memory graph", no wellbeing/dopamine domain, no habit template
  catalog, no multi-line capture review layer.

## 6. Build & packaging

- Web static export: `scripts/build-web-export.sh` (isolated copy,
  hardlinked node_modules, **moves `src/app/api` out**, builds with
  `BUILD_EXPORT=1 NEXT_PUBLIC_STANDALONE=1`, copies `out/` →
  `apk/web-assets`).
- APK: `apk/build-apk.sh` 8 steps (aapt2 compile/link → ECJ → d8 →
  zip → zipalign → apksigner v1+v2 → publish). Signing secrets from
  `/home/z/.systemy-secrets/env` — **never in repo**.
- `MainActivity.java` (105 L): full-screen WebView, JS+DOM storage
  enabled, UA suffix `SystemyWebView/1.0` (the standalone trigger,
  `standalone.ts:13-22`), external links → browser. **No
  `addJavascriptInterface`, no POST_NOTIFICATIONS, only
  INTERNET/ACCESS_NETWORK_STATE permissions** — the APK is a pure
  offline shell.

## 7. Risks relevant to a Life-os merge

1. `Recurring.outsideBudget` is vestigial — never set by forms, not
   propagated by `payRecurring` (`actions.ts:451-464`).
2. `chat` table declared but never written.
3. Goal pots are virtual (`"goal:"+id` accounts) — migration must
   decide where imported goal money lands.
4. Dual pacing engines (see §4).
5. APK has no JS bridge — any native feature needs `MainActivity` +
   manifest work.
