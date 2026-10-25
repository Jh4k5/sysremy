# Feature Parity Matrix — Systemy v5.0 vs Life-os

> Classification legend: **SYS** = Systemy only · **IOS** = Life-os only ·
> **BOTH** = present in both · **SYS+** / **IOS+** = more complete in that
> app · **BROKEN(x)** = broken/incomplete in app x · **SHARE** = suitable
> for sharing across platforms (pure TS logic) · **NATIVE** = requires
> platform-specific implementation · **DECIDE** = requires a deliberate
> product decision. Evidence cites `file:line` (Systemy paths relative to
> `src/`, Life-os paths relative to `/home/z/life-os/`).

## A. Money & finance

| Capability | Classification | Evidence & notes |
|---|---|---|
| Accounts (cash/bank/wallet/credit/savings) w/ derived balances | **SYS** | Life-os has zero money domain (no tables, no screens — `db/local.ts` collection list). Systemy: `money.ts:59-77`, `accounts-section.tsx` |
| Precise budget engine (month→week→day, carryover, sweep-to-savings) | **SYS** | `budget-engine.ts:53-81,172-268`, `actions.ts:292-349` |
| Envelope budgets per category + capture keywords | **SYS** | `types.ts:64-77`, `categories-section.tsx` |
| Transactions CRUD + filters + CSV | **SYS** | `tx-section.tsx` (801 L) |
| Recurring commitments (1-tap pay, advance nextDate) | **SYS** (minor gap) | `actions.ts:437-474`; BROKEN(sys): `outsideBudget` not propagated by `payRecurring` (`actions.ts:451-464`) |
| Goals as money pots (contribute/withdraw/what-if) | **SYS** | `actions.ts:499-555`, `goal-details-dialog.tsx:418-421` |
| Assets & debts (settle/receive→tx) | **SYS** | `actions.ts:559-657` |

**Verdict:** money is Systemy's crown jewel; Life-os contributes nothing
here. Nothing to port.

## B. Tasks & productivity

| Capability | Classification | Evidence & notes |
|---|---|---|
| Task CRUD + filters + priority | **BOTH, SYS+** | Life-os: list/new wired but detail edit no-op, `desc` dropped (`tasks/new.tsx:49`); Systemy: full dialogs + links to 5 entities (`types.ts:242-262`) |
| Task energy field | **IOS** | `tasks{energy}` — Systemy has no column; **DECIDE**: map to priority or add field (we drop it in migration v1) |
| Subtasks | **BOTH, both partial** | Life-os toggles local-only (`tasks/[id].tsx:36-37`); Systemy has none (flat tasks) |
| Focus timer | **BOTH, IOS+ (engine)** | Life-os: 4 techniques w/ phase machine + partial-session logging + energy-before + technique stats (`focus/index.tsx:28-33,109-195`); Systemy: 15/25/45/60 single-phase w/ chime + auto-block (`focus-timer-card.tsx:1-12`). **Port the Life-os engine concepts into Systemy's card** (slice E5) |
| Focus session history | **IOS** | `focus_sessions` collection + `focusWeek` (`repository.ts:1143`); Systemy logs a block only |
| Areas (life areas) | **IOS** | `areas` + SEED_AREAS + project nesting; Systemy projects are flat. **DECIDE**: keep Systemy flat projects (Systemy's systems-hub already provides the "area" mental model) |

## C. Habits

| Capability | Classification | Evidence & notes |
|---|---|---|
| Habit CRUD + logging + streaks | **BOTH, SYS+** | Systemy: rings, heatmap 30d, +1 counters, full-screen timer, save-amount→goal (`types.ts:211-227`, `habits-screen.tsx`); Life-os: streak loop ≤400d, 91-day heatmap |
| Habit templates catalog (21 Arabic templates) | **IOS** | `data/mock.ts:257-287`; BROKEN(ios): templates screen doesn't prefill (`templates.tsx:41`). **Port catalog + fix prefill in Systemy's habit form** (slice E1) |
| Habit reminders | **BOTH, both broken differently** | Life-os: UI collects reminders then **drops them** (`habits/new.tsx:41-45` vs `:52`); Systemy: `remindAt:"HH:mm"` exists and fires via in-app scheduler only (`app.tsx:241-306`) — NATIVE for APK delivery |

## D. Calendar & time

| Capability | Classification | Evidence & notes |
|---|---|---|
| Week grid (visual) | **SYS** | RTL 7×16 grid, unified events, now-line (`week-grid.tsx`, `calendar-utils.ts:46-63`); Life-os: list/agenda only, week strip hardcodes dates (`schedule/index.tsx:76`) |
| Timed blocks + touch-to-create | **SYS** | `blocks` + `block-form-dialog.tsx` |
| Schedule builder from OCR | **IOS** (BROKEN fallback) | `schedule/build.tsx` + fabricated rows offline (`scheduleService.ts:31-33`) — not portable without OCR (NATIVE/web-API) |
| Recurring events (rrule) | **IOS schema only** | `0002_phase2_domains.sql:142-157` — never used client-side. Systemy recurrings are money-only. **DECIDE**: defer |

## E. Journaling & reflection

| Capability | Classification | Evidence & notes |
|---|---|---|
| Journal + mood + templates + memories | **BOTH, SYS+** | Life-os detail shows 90-char preview only (`repository.ts:376`); Systemy: full editor, secret notes w/ reveal, on-this-day (`journal-screen.tsx:68,157,183`) |
| Journal signal extraction (mood/stress/energy/topics/people) | **IOS** | `intelligence.ts:391-425` incl. Arabic name extraction "مع X". **Port as enrichment into Systemy's journal save** (slice E7 — scheduled phase 2) |
| Journal → insight correlators | **BOTH, different shapes** | Life-os: 8 local correlators; Systemy: insights screen w/ correlations & predictions (`insights-screen.tsx:320-381`) |

## F. Learning & study

| Capability | Classification | Evidence & notes |
|---|---|---|
| Courses w/ weighted grade items | **SYS** | `actions.ts:1021-1031`; Life-os courses have progress only |
| Flashcards spaced repetition | **BOTH** | Systemy: Leitner 5-box `[0,1,3,7,14,30]` (`types.ts:336`, `actions.ts:1054`); Life-os: **SM-2** w/ ease (`srs.ts:17-37`). **DECIDE**: keep Systemy's Leitner (wired to courses, simpler, verifiable); adopt SM-2 only if quality proves insufficient. Both lack a card-creation screen in Life-os |
| Exams w/ readiness heuristic + revision planner | **IOS** | `study/[id].tsx:24-29,47-82`; Systemy models exams as high-priority tasks. **DECIDE**: optional enhancement; migration maps exam→task+goal |
| Learning library (books/podcasts) | **IOS** (BROKEN create) | stub `learning/new.tsx:97`; Systemy notes cover this loosely. **DECIDE**: map to notes in migration |

## G. Health & wellbeing

| Capability | Classification | Evidence & notes |
|---|---|---|
| 6 health metrics + sparklines | **SYS+** | `healthLogs` 6 kinds w/ targets (`types.ts:292-299`); Life-os: water/sleep/steps/weight + meals |
| Meal tracking + AI nutrition | **IOS** | `meals` + edge fn `nutrition` (honest null offline). **DECIDE/NATIVE**: defer — Systemy health covers the core |
| Workouts w/ exercise editor | **IOS** | `workouts{exercises}`; Systemy has an "exercise" health metric only. **DECIDE**: map workouts→healthLogs exercise in migration |
| **Wellbeing / dopamine system** | **IOS, fully wired** | activities healthy/draining + net-week chart + self-set rules w/ real reminders (`dopamine/index.tsx:46-87`, `repository.ts:954-1040`). **Port as Systemy system #16** (slice E3) |

## H. Life-organization domains

| Capability | Classification | Evidence |
|---|---|---|
| Travel (trips, packing, itinerary, budget) | **SYS** | `travel/*` |
| Vault (documents + expiry alerts) | **SYS** | `vault/*`, `actions.ts:1127-1173` |
| Home (grocery, bills, possessions) | **SYS** | `home/*` |
| People CRM (+debts, neglect counter) | **SYS** | `people/*` |
| Notes (pinned/tags→task) | **SYS** | `notes/*` |
| Projects (rate/hour billing) | **SYS** | `projects/*` — supersedes Life-os areas/projects stubs |
| Life areas nesting | **IOS, partially broken** | projects create is a stub; goals dead path |

## I. Intelligence & capture

| Capability | Classification | Evidence & notes |
|---|---|---|
| Smart capture (rule-based) | **BOTH, complementary** | Systemy: `capture-rules.ts` (315 L, money-strong); Life-os: `aiService.ts` keyword classifier + **`dateResolve.ts` richer date grammar** (dialect weekdays, بعد بكرة, بعد N). **Port dateResolve into Systemy's capture** (slice E4) |
| Capture → **Review layer** (accept/edit/ignore per item) | **IOS** | `ReviewLayer.tsx:72-298` reused 3×; Systemy quick-add previews one item only. **Phase 2 port** (see plan) |
| Multi-line capture | **IOS** | parseDay per-line + suggestion; Systemy single-shot |
| Voice input | **IOS (NATIVE)** | `useVoice.ts` 7 languages. Web Speech API possible in browser/APK — **phase 2, platform-specific** |
| OCR capture | **IOS (NATIVE cloud)** | edge fn `ocr`; not in APK. Defer |
| Online AI assistant | **BOTH, different** | Systemy: `/api/sys` GLM w/ local context (web-only); Life-os: Gemini edge fns (gated off on device). **SHARE**: Systemy's approach is the keeper |
| Memory graph + Connected strip | **IOS (limited)** | label-substring + 1-hop, ids in JSON blob. **DECIDE**: Systemy already has typed links (task.projectId etc.); port the *concept* as "connections" enrichment — phase 2 |
| Adaptive modes (6) | **IOS** | `modeStore.ts`. **DECIDE**: defer — Systemy's today-screen already adapts |
| Insight engine | **BOTH, SYS+** | Systemy insights: score/correlations/cash-predictions/anomalies (1138 L); Life-os: 8 correlators + nextAction ladder |
| Global search | **BOTH, SYS+** | Systemy Ctrl+K command bar w/ live search + smart capture; Life-os 9-kind search w/ routes |

## J. Platform & experience

| Capability | Classification | Evidence & notes |
|---|---|---|
| i18n (7 languages, 700 keys) | **IOS** | `locales/*`, `lib/i18n.ts`. Systemy is Arabic-first hardcoded. **DECIDE (deferred)**: porting i18n architecture is a product pivot, not an integration slice |
| Light/dark theme + accents + font-scale + density | **IOS+** | `ThemeContext`, `tokens/*`; Systemy: dark-only + 5 accents. **DECIDE (deferred)**: v5 ribbon identity is dark-native; light theme = separate design project |
| Trust center (privacy explainer) | **IOS** | `trust-center.tsx:13-53`. **Port** (slice E2) — trivial, high-trust value |
| Notifications delivery | **BOTH weak, NATIVE** | Life-os: one-shot native, no recurring; Systemy: in-app only in APK (Web API inert). Both need platform work for real delivery |
| Export/import | **BOTH, SYS+** | Systemy JSON replace/merge + HTML report; Life-os exportAll share-sheet only |
| PIN lock | **SYS** | `lock-screen.tsx` SHA-256 |
| Cloud sync / accounts | **IOS (broken), SYS (by design)** | Life-os sync absent; demo auth fake. **DECIDE**: local-first is Systemy's stated identity — defer accounts |
| APK build + store pipeline | **SYS** | full aapt2→apksigner pipeline; Life-os has EAS config but broken auth/env story |

## Summary counts

- **Systemy-only domains**: money (7 capabilities), travel, vault, home,
  people, notes, projects-with-billing, week-grid calendar, PIN lock,
  insights analytics.
- **Life-os-only worth porting now**: habit templates, wellbeing system,
  trust center, dateResolve grammar, focus-session engine, focus history,
  journal signal extraction, review-layer pattern, memory-graph concept,
  adaptive modes, i18n/theme architectures (deferred).
- **Broken on the Life-os side** (not ported, documented): demo auth,
  dead goals, dropped habit reminders, stub create screens, fabricated
  fallbacks, ~43 silent catches.
- **Genuinely shared/portable (pure TS)**: dateResolve, srs.ts (SM-2),
  intelligence correlators, habit-template data, wellbeing logic,
  exam-readiness heuristic, trust-center content.
- **Requires native/platform work**: voice, OCR, notification delivery,
  haptics parity, file pickers.
