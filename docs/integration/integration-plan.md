# Integration Plan — Systemy ⇄ Life-os

> Executing plan derived from `architecture-decision.md` (Option A).
> Status markers updated as slices complete. Branch:
> `integration/life-os-merge` (base v5.0 @ `463f319`).

## Guardrails (from the brief, enforced)

- Both source projects preserved: Systemy tag `pre-integration-backup`
  @ `463f319`; Life-os tag `legacy-snapshot` @ `0c50b87` (read-only dir
  `/home/z/life-os`).
- No destructive migrations: every schema change is a **new Dexie version
  with additive stores only**; existing tables are never reshaped.
- Data conversion runs on **copies** (export JSON), never on live DBs.
- No push/publish/release without explicit authorization (local commits
  only until then).
- No certificates/keys/secrets in commits (signing stays in
  `/home/z/.systemy-secrets/`).

## Slice map

| Slice | Content | Layer | Status |
|---|---|---|---|
| **E0** | Shared data layer: new Dexie v4 stores (`wellbeingActivities`, `wellbeingLogs`, `wellbeingRules`, `focusSessions`), entity types, actions, backup-table registration, `wellbeing` system registry entry (#16) | data | ✅ done |
| **E1** | Habit-templates catalog + prefill in habit form + templates sheet; Trust-center view; Wellbeing screen (activities/logs/rules/week chart) wired into systems hub + more screen | UI | ✅ done |
| **E2** | Focus-session engine upgrade (4 techniques w/ phases, partial logging, energy-before, technique stats → `focusSessions`) + capture date-grammar upgrade (port Life-os `dateResolve` into `capture-rules`) | UI+logic | ✅ done |
| **E6** | Migration tool `scripts/migrate-lifeos.ts` — Life-os `exportAll` JSON → Systemy `BackupFile` v2 (opt-in, copy-based, dry-run mode) | tooling | ✅ done |
| Phase 2 (deferred) | Capture review-layer (multi-item), journal-signal extraction, memory/connections enrichment, Web Speech voice, OCR via `/api/sys`-style route, light theme, i18n architecture, exam readiness view, Supabase accounts/sync | — | 📋 planned |

## Slice detail

### E0 — Shared data layer (additive only)

- `src/lib/types.ts`: add `WellbeingActivity`, `WellbeingLog`,
  `WellbeingRule`, `FocusSession` (+ `FOCUS_TECHNIQUES` const) — pure
  additions, zero edits to existing types.
- `src/lib/db.ts`: **Dexie version 4** adding 4 stores with indexes;
  `DEFAULT_SYSTEMS` gains `wellbeing` (#16) — registration is additive
  and re-seeds safely via the existing `seedSystems()` v3 migration
  path (upsert-by-key, customization untouched).
- `src/lib/actions.ts`: wellbeing CRUD + `logWellbeing` upsert +
  `toggleWellbeingToday` + `wellbeingWeek` derivation; focus actions
  (`addFocusSession`, `listFocusSessions`, `focusWeekStats`).
- `src/lib/backup.ts`: new tables appended to the backup table list —
  old backups (without the new tables) still import cleanly.
- **Quality gate**: `tsc` clean; existing backup file imports unchanged.

### E1 — Habit templates + Trust center + Wellbeing UI (agent A)

- `habits/habit-templates.ts`: 21 Arabic templates (ported data from
  Life-os `data/mock.ts:257-287`, adapted to Systemy's Habit shape:
  target/unit/cadence/timerMinutes) + picker sheet; habit form gains
  "قوالب جاهزة" entry that **prefills** (fixing Life-os's known gap).
- `trust-center.tsx`: privacy-transparency view (4 guarantees + "why
  did Sys suggest this" row) — port of Life-os `trust-center.tsx`
  content into the Systemy ribbon design; entry from More screen.
- `wellbeing/wellbeing-screen.tsx`: activities (healthy/draining) with
  one-tap day logging, net-week bar chart (±), self-set rules with
  reminder scheduling through the **existing reminders engine** (fixes
  Life-os's dropped-reminders class of bug by construction).
- Systems hub + More screen rows with live indicators; ribbon styling
  per V5-0 rules (`.ribbon-soft` chips, `.press`, widgetEnter, stagger).

### E2 — Focus engine + capture grammar (agent B)

- `tasks/focus-timer-card.tsx`: technique selector (pomodoro 25/5×4,
  52-17, deep 90/20×2, custom), phase machine (focus→short→long),
  **honest partial-session logging** on abandon/complete →
  `addFocusSession` (+ keeps the existing auto-block behavior),
  energy-before 1-5 chips, technique stats footer from
  `focusWeekStats`.
- `capture-rules.ts`: merge Life-os `dateResolve.ts` grammar — dialect
  weekday table (MSA/Gulf/Egyptian/Levantine), بعد بكرة/باجر variants,
  بعد/قبل + N أيام/أسابيع/شهور, time-with-ص/م, Arabic-Indic digit
  normalization is already present (kept single-source). Pure rule
  additions; every existing capture test case keeps its outcome
  (additions only extend coverage).

### E6 — Migration tool

- `scripts/migrate-lifeos.ts` (Bun): reads a Life-os `exportAll` JSON
  (their format: `{collections:{<name>:rows}}`), maps → Systemy
  `BackupFile` v2, `--dry-run` prints per-table counts + skipped
  fields, `--out` writes `systemy-import-<date>.json` for the existing
  Settings → Data → Import flow. Mapping table (from the audits):
  tasks→tasks (energy→priority heuristic, desc→description),
  habits→habits (freq→cadence, time_pref→remindAt), habit_logs→habitLogs,
  journal_entries→notes(type=journal), study_courses→courses,
  flashcards→flashcards (SM-2 ease/interval→Leitner box estimate),
  events→blocks, learning_items→notes(type=note), health_metrics→
  healthLogs (water_ml/sleep_min/steps/weight_kg→water/sleep/steps/weight),
  workouts→healthLogs(exercise, minutes), focus_sessions→focusSessions,
  wellbeing_*→wellbeing*, areas/projects→projects (goals→milestone
  tasks), exams→high-priority task + calendar block, meals→skipped
  (documented), insights/memory→skipped (documented).
- Id strategy: prefix `lo-<uuid>` guarantees no collision with Systemy
  ids; merge-import mode never overwrites existing rows.

## Quality gates (per slice, from Phase F of the brief)

1. `bunx tsc --noEmit` — zero errors in `src/`.
2. `bun run lint` — clean.
3. agent-browser end-to-end on `?standalone`: slice's golden path
   (create→persist→reload→verify), plus regression pass of the 4 core
   flows (onboarding, quick-add save, budget tab render, systems hub).
4. Backup round-trip: export → import on a copy.
5. Migration tool: dry-run on the synthetic Life-os export fixture
   (built from the audited schema), verify counts + spot-check rows.
6. Dev-server log: 200s only, no runtime errors.
7. No iOS/Xcode claims are made anywhere — no macOS environment exists
   here; Life-os native paths are documented as not-buildable in this
   environment (per the brief's honesty rule).

## Rollback

Each slice is one commit on `integration/life-os-merge`;
`git revert <slice-commit>` restores the previous state without
touching data (additive-only schemas mean old data survives rollback —
Dexie v4 stores simply stop being read).

## Remaining work before production launch (priority order)

1. **P1**: capture review-layer (multi-item) — the biggest UX gap vs
   Life-os's hero flow.
2. **P1**: notification delivery in APK (MainActivity JS bridge +
   POST_NOTIFICATIONS) — both apps' reminders are in-app only today.
3. **P2**: journal-signal extraction + memory/connections enrichment.
4. **P2**: voice input via Web Speech API (verify in WebView).
5. **P2**: light theme study; i18n architecture decision.
6. **P3**: recurring-event rrule for calendar; exam-readiness view;
   SM-2 vs Leitner evaluation with real usage data.
7. **P3**: Supabase accounts/sync design doc (if multi-device becomes a
   requirement).
8. Update APK version → v5.1 (versionCode 10) after authorization.
