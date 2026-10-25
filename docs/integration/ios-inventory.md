# Legacy App Inventory — «Life-os» (Jh4k5/Life-os)

> Evidence-based inventory produced by a read-only audit of the preserved
> snapshot `/home/z/life-os` (tag `legacy-snapshot`, commit `0c50b87`,
> extracted from GitHub default branch `claude/read-files-build-app-rw8fqi`).
> Every claim cites `file:line`. Audit date: 2026-10-25.

## 0. Headline correction to the integration brief

The brief anticipated "a legacy iOS application … may use a completely
different architecture, such as SwiftUI/UIKit." **It does not.** Evidence:

- `package.json`: `expo ~54.0.0`, `react-native 0.81.4`, `react 19.1.0`,
  `expo-router ~6.0.0`, `nativewind ^4.1.23`, `zustand ^5.0.0`,
  `@supabase/supabase-js ^2.108.2`, `i18next` + `react-i18next`.
- Config files: `app.json`, `eas.json`, `metro.config.js`,
  `babel.config.js`, `nativewind-env.d.ts`.
- Zero `.swift` files in the repo; no Xcode project.

**Life-os is an Expo/React-Native/TypeScript app** — same language family
as Systemy. This materially changes the migration calculus (see
`architecture-decision.md`): features can be ported TypeScript→TypeScript
with adaptation to the web/Dexie runtime, rather than translated from
Swift. Native iOS capabilities (below) are the only layer that cannot
carry over directly.

## 1. Screens (48 route files; tabs = home + more only)

| Route | Status | Notes |
|---|---|---|
| `/` entry router | Wired | demo→tabs, live→`auth.currentUser()` (network call) `app/index.tsx:16-27` |
| `(auth)/welcome`, `sign-in`, `sign-up` | Wired | demo mode **fakes success** (`services/auth.ts:16,23`) |
| `(tabs)/home` (586 L) | **Fully wired — hero screen** | Dual view: AI capture (mic/text/OCR → ReviewLayer → persist) + Dashboard (Now card, attention chips, stats, mood sparkline, DayTimeline, insights) |
| `more/tasks` list/new | Wired | filters/quick-add/optimistic toggle |
| `more/tasks/[id]` | Partial | subtask toggles **local-only**; edit button no-op; `desc` dropped on save |
| `more/habits` + `[id]` + `new` + `templates` | Wired | 91-day heatmap from real `habit_logs`; **reminders/days/note/retro dropped on save** (`habits/new.tsx:41-45` vs `:52`); templates **don't prefill** |
| `more/journal` + `[id]` + `new` | Partial | new/index wired; detail shows **90-char preview only** (`repository.ts:376`), edit no-op |
| `more/study` + `[id]` + `flashcards` + `new-course` + `new-exam` | **Fully wired** | exam readiness heuristic, weak topics, revision planner→ReviewLayer, SM-2 review |
| `more/learning` + `new` | List wired / **Create is a stub** | "Create" = `router.back()`; `addLibraryItem` has zero callers |
| `more/focus` | **Fully wired (best-in-class)** | 4 techniques w/ phase engine, notifications, **honest partial-session logging** |
| `more/schedule` + `build` | Partial | header "+" no-op; week strip hardcodes dates; builder **fabricates fallback rows** offline |
| `more/health` | Wired | metrics, meals CRUD, photo→AI nutrition, TDEE/BMI; **BMR profile hardcoded** `{male,25}` |
| `more/exercise` | Wired | full CRUD + editor |
| `more/dopamine` (Wellbeing) | **Fully wired** | healthy/draining activities, net week chart, **self-set rules w/ real reminders** |
| `more/areas` + `new` + `[id]` + project screens | Mixed | areas wired; **new-project is a stub**; new-goal writes a **dead `goals` collection** |
| `more/ai-hub` (Intelligence) | Wired | memory search, insights inbox, teach-AI-facts |
| `more/ai-studio` + `[id]` | UI wired / **not persisted** | RAM-only workspaceStore + fabricated sample seeds |
| `more/memory` | Wired | flat node search |
| `settings` modal (315 L) | Wired | theme/accent/font/density/lang/haptics/notifications; export; delete account |
| `trust-center` modal | Wired (static) | privacy explainer + "why AI" |
| `search` modal | Wired | 9-kind debounced global search w/ routes |

## 2. Data layer

### 2.1 Local store — `db/local.ts` (AsyncStorage, one JSON array per collection)

23 collections; every row `id, created_at, updated_at, _dirty, _deleted`
(soft-delete). API: `list/get/find/insert/update/upsert/remove/dirty/
markClean/mergeRemote/exportAll/clearAll`.

Key collections & fields (as actually written):
`tasks{title,priority,energy,due,area_id,icon,color,done}`,
`habits{name,icon,color,type,target,unit,freq,time_pref,area_id}` (**no
reminder columns — DIAGNOSIS §3 verified**),
`habit_logs{habit_id,day,value,done}`,
`journal_entries{title,content,mood,tags[],pinned,area_id,icon,color}`,
`journal_signals{entry_id,mood_score,stress,energy,topics[],people[]}`,
`study_courses{name,teacher,color,icon,status,progress}`,
`exams{course_id,name,exam_date,chapters_count,ai_plan[]}`,
`flashcards{course_id,front,back,ease,interval_days,reps,due_date}`,
`learning_items{title,author,type,status,progress}`,
`meals{name,calories,protein_g,carbs_g,fat_g,ai_estimated,eaten_at}`,
`health_metrics{day,water_ml,sleep_min,steps,weight_kg}`,
`workouts{name,mode,duration_min,exercises,done_at}`,
`events{title,starts_at,ends_at,all_day,source,location}`,
`memory_nodes{type,label,data:{entityType,entityId}}`,
`memory_edges{from_node,to_node,relation}`,
`wellbeing_activities{name,type}`, `wellbeing_logs{activity_id,day}`,
`wellbeing_rules{text,time,enabled}`,
`focus_sessions{task,duration_min,energy_before,technique}`,
`areas{name,emoji,color,description}`,
`projects{area_id,name,emoji,color,status,due,progress,goals[],tasks[],journals[]}` (**embedded arrays**),
`goals{title,detail,area_id,project_id,target_date,icon,color,progress,done}` (**dead — no reader**).

### 2.2 `services/repository.ts` (1156 L) — the single data seam

~70 public methods incl. the capture pipeline:
`persistAccepted(items)` → filter → `applyDetected` (create/update/delete)
→ `persistMemory` → `scheduleReminders` (reminder/appointment only,
60-min nudge). `routeFor` deep-links (exam→schedule — **no exam detail
screen exists**).

### 2.3 Supabase server schema (3 migrations, 30+ tables, full RLS)

`0001_init.sql`: profiles, areas, projects, goals, habits (+habit_logs),
tasks, journal_entries, workspaces, captures, files, memory_nodes/edges,
shares + private buckets. `0002_phase2_domains.sql`: study
courses/exams/flashcards/study_sessions, learning paths/items/highlights,
health/meals/workouts, **events with RFC5545 rrule (unused client-side)**,
analytics_events, wellbeing. `0003_intelligence.sql`: insights,
journal_signals.

### 2.4 Sync — **does not exist**

`db/local.ts:4-5` references a `db/sync.ts` that is **absent**; the
`_dirty`/`_deleted`/`mergeRemote` machinery has zero callers. Only
`insights` + `analytics_events` ever reach Supabase, and only when signed
in. All domain data is device-local forever. (DIAGNOSIS §7 "no account =
no product" stands.)

## 3. AI capabilities

- **Local parser** `services/aiService.ts`: keyword classification
  (MSA + Gulf/Egyptian/Levantine + English cue-word lists per type:
  exam/meal/workout/study/appointment/habit/reminder/task/checklist),
  command grammar (delete/update verbs), suggestion generation.
  Cue-word-less sentences → `note` → **silently dropped from actionable
  items** (kept only as a journal blob).
- **Edge functions (Deno + Gemini 2.0 Flash)**: `ai-parse` (Arabic
  system prompt, strict JSON, injects known entity labels), `transcribe`
  (audio→text), `ocr` (image→structured lines), `insights` (aggregates
  only — never raw text), `nutrition` (photo→macros, honest null),
  `delete-account` (service-role cascade; **not in the deploy workflow's
  function list**).
- **Voice** `hooks/useVoice.ts`: continuous recognition, 7 languages
  (ar-SA, en-US, fr-FR, tr-TR, es-ES, de-DE, ur-PK), honest failure.
- **Capture → Review → Persist**: `ReviewLayer.tsx` (accept/edit/ignore/
  clarify per item, delete double-confirm, "Added ✓ · View" deep-links).
  Reused by Home, Study planner, Schedule builder.
- **Memory graph**: label-substring match + 1-hop neighbors; entity ids
  live in a JSON blob (no FK); rendered by `ConnectedLayer` with
  deep-links. `services/memory.ts` (typed graph class) is orphaned.
- **Intelligence engine** `services/intelligence.ts`: 8 local
  correlators (exam-without-plan, due cards, urgent load, streak-at-risk,
  mood trend, stress recurrence + top person, low sleep/water) +
  `nextAction()` priority ladder + `extractJournalSignals` (mood/stress/
  energy/topics/people incl. Arabic name extraction).

## 4. Native capabilities (the layer that cannot port directly)

| Module | Usage | Quality |
|---|---|---|
| expo-notifications | foreground handler, one-shot scheduling (focus phases, wellbeing rules, section reminders, capture reminders) | Solid one-shot; **no recurring engine, no re-arm, no push** |
| expo-haptics | centralized 8-pattern feedback, settings-gated | Excellent |
| expo-speech-recognition | continuous voice, Expo-Go-safe shim | Very good |
| expo-image-picker | camera+gallery → base64 → OCR/nutrition | Good |
| expo-blur | frosted SmartCard glass | Premium |
| expo-localization | locale→language init | Minimal |

## 5. i18n

`locales/{ar,en,fr,tr,es,de,ur}.json` — **700 keys each**, i18next with
`fallbackLng:'ar'`, persisted `@lang`, manual RTL mirroring in 30 files
(`hooks/useRTL.ts`). AI-generated strings (aiService, intelligence,
modeStore, workspaces, dateResolve) are hardcoded Arabic by design.
~611 `t()` call sites.

## 6. Feature gems (candidates for porting — with evidence)

1. **Habit templates catalog** — `data/mock.ts:257-287`: 21 templates ×
   4 categories (health 8 / productivity 5 / learning 4 / discipline 4),
   ready-made Arabic onboarding content.
2. **SM-2 flashcards** — `services/srs.ts:17-37` (pure SuperMemo-2 with
   ease formula, lapse reset, `REVIEW_GRADES`); weak-topic detection =
   `ease<2.3 && reps>0`.
3. **Exam readiness heuristic** — `study/[id].tsx:24-29`:
   `progress*0.7 + 20(hasPlan) + 10(daysLeft>7)` clamped 0-100.
4. **Focus sessions** — `focus/index.tsx`: 4 techniques (pomodoro 25/5/15×4,
   52-17, deep 90/20×2, custom), phase machine, honest partial logging on
   abandon, energy-before 1-5, task linking, weekly stats.
5. **Wellbeing/dopamine** — user-defined healthy/draining activities +
   net ±1 weekly chart + self-set rules with real reminders; honest
   "no OS Screen-Time API" framing.
6. **Theme system** — dark/light/system + 6 jewel accents + typography
   role scale + motion tokens + density multipliers.
7. **Density & font-scale** — `hooks/useDensity.ts`, `lib/textScale.ts`.
8. **Trust-center** — privacy explainer + "why did the AI suggest this".
9. **Global search** — 9 kinds w/ routes, 220 ms debounce.
10. **ConnectedLayer + memory deep-links** — cross-domain "connected" strip.
11. **Intelligence engine** — §3 above.
12. **dateResolve** — `services/dateResolve.ts`: full Arabic/English
    natural-date resolver (Arabic-Indic digits, weekday table with
    dialects, بعد بكرة/الأسبوع القادم/بعد N أيام, ص/م times).
13. **Adaptive modes** — `store/modeStore.ts`: 6 modes (normal/study/
    travel/stress/sick/focus) reshaping Home.
14. **DayTimeline** — RTL vertical timeline w/ now/passed markers.
15. **SectionCustomizeSheet + sectionPrefs** — per-section goals/units/
    reminder/hidden-cards/icon/accent/default-view with store migration.

## 7. Verified broken / fake (all DIAGNOSIS claims re-checked + new finds)

| # | Issue | Evidence |
|---|---|---|
| 1 | Demo-mode auth fakes success | `services/auth.ts:16,23` |
| 2 | CI APK demo-mode — **FIXED** (env now injected, fails loudly if missing) | `.github/workflows/build-apk.yml` |
| 3 | No session restore (network `getUser`; zero `getSession`/`onAuthStateChange`) | `services/auth.ts:60-65` |
| 4 | Habit reminders collected then dropped; no recurring engine | `habits/new.tsx:41-45` vs `:52` |
| 5 | Goals dead path (collection written, never read; double model) | `new-goal.tsx:26`, `project/[pid].tsx:74-78` |
| 6 | Exam deep-link → schedule (no detail screen) | `repository.ts:212-214` |
| 7 | ~43 silent catches (was 26) | repo-wide grep |
| 8 | `learning/new.tsx` stub | `:97`; `addLibraryItem` zero callers |
| 9 | `new-project.tsx` stub | `:35,:66`; `addProject` zero callers |
| 10 | Journal detail = 90-char preview only | `repository.ts:376` |
| 11 | Sync layer absent; `_dirty` machinery dead | `db/local.ts:4-5` |
| 12 | `delete-account` fn not in deploy list | `.github/workflows/deploy-supabase.yml` |
| 13 | `supabase/schema.sql` stale (phase-1 only) | vs 3 migrations |
| 14 | AI Studio not persisted + fabricated seeds | `workspaceStore`, `services/workspaces.ts:11-38` |
| 15 | Signed-out insights RAM-only | `intelligence.ts:49` |
| 16 | Health BMR hardcoded `{male,25}` | `health/index.tsx:32` |
| 17 | Schedule builder fabricates fallback sessions | `scheduleService.ts:31-33` |
| 18 | Dead settings fields (habitsView/tasksSort/retroTasks/sounds) | `settingsStore.ts:9-13` |
| 19 | `study_session` capture creates a COURSE | `repository.ts:153-154` |
| 20 | `services/memory.ts` orphaned | imported nowhere |

## 8. Migration-mapping cautions (Systemy side should absorb these)

- `projects.goals/tasks/journals` embedded arrays vs Systemy's flat
  linked tables.
- Local `goals` carries `area_id/detail/icon/color/done` — Systemy goals
  are money-pots (`targetAmount/savedAmount`); a Life-os "goal" is closer
  to a Systemy **project outcome or milestone task**, not a money goal.
- `wellbeing_logs{activity_id,day}` local vs `{day,activity,kind,impact}`
  server — neither maps 1:1 without a new Systemy schema (see plan).
- `tasks.energy` has no Systemy column (map → priority heuristics or drop).
- `events` local has no `rrule`; Systemy blocks are single-day.
- Arabic i18n keys: 700 namespaces — Systemy is hardcoded Arabic already,
  so porting *strings* is unnecessary; porting the *architecture* is a
  separate (deferred) decision.
