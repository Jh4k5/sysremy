# Architecture Decision — Unified Systemy

> Decision record for combining Systemy (primary) with Life-os (legacy).
> Based on evidence in `systemy-inventory.md`, `ios-inventory.md`, and
> `feature-parity-matrix.md`. Date: 2026-10-25.

## Decision

**Option A — keep Systemy's architecture (Next.js 16 + TypeScript +
Dexie/IndexedDB + WebView APK) and port selected Life-os features into
it, TypeScript→TypeScript.** Rejected: Option B (dual clients + shared
backend) and Option C (cross-platform rewrite). Rationale below.

## The evidence that decided it

### 1. Both apps are the same language family — the brief's core risk dissolved

The brief's critical constraint anticipated a Swift/UIKit legacy app.
The audited reality (`ios-inventory.md` §0): **Life-os is Expo 54 /
React Native 0.81 / TypeScript** — `package.json` evidence, zero `.swift`
files. The feared "paste Swift into TypeScript" hazard cannot occur.
What actually exists is a *port* problem between two React-family
TypeScript codebases with different runtimes (RN-native vs web/DOM).

### 2. Systemy is the more complete, working product

- **26 Dexie tables + ~60 actions + a 313-line precise budget engine**
  vs Life-os's 23 AsyncStorage collections with **no money domain at
  all** — money is the flagship of the product vision ("finance" listed
  first in the brief).
- Systemy's 15 registered systems are wired end-to-end with honest live
  indicators; Life-os ships 5 stub/broken screens (learning create,
  project create, goals dead path, journal 90-char preview, exam route)
  and ~43 silent catches (`ios-inventory.md` §7).
- Life-os's "cloud" story is a façade: `db/sync.ts` does not exist,
  `_dirty`/`_deleted` flags are dead, only insights/analytics ever reach
  Supabase, and demo-mode auth fakes success (`services/auth.ts:16,23`).

### 3. Life-os's unique value is portable logic, not infrastructure

The audit's feature-gems list (`ios-inventory.md` §6) is dominated by
**pure TypeScript modules** that port cleanly into Systemy's runtime:
`dateResolve.ts` (Arabic natural dates), `srs.ts` (SM-2), the wellbeing
domain logic, habit-template data, the exam-readiness heuristic,
journal-signal extraction, and the review-layer interaction pattern.
None of these depend on Supabase or native modules to deliver value.

### 4. Life-os's un-portable layer is small and replaceable

Native capabilities (voice recognition, OCR, haptics, notifications)
sit behind thin seams (`services/speech.ts`, `captureService.ts`,
`feedback.ts`). Their Systemy equivalents are web-platform concerns
(Web Speech API, the existing `/api/sys` route, `navigator.vibrate`,
Web Notifications) — to be addressed as separate platform slices, not as
a reason to keep a second app alive.

### 5. Why not Option B (two clients, shared backend)?

- The only working "shared backend" today is Supabase migrations that
  the Life-os client **never actually syncs with** — there is no sync
  layer to share.
- Maintaining two clients doubles every feature forever; the brief
  explicitly warns against "two applications glued together."
- Systemy's local-first identity (verified: 100% offline APK, JSON
  export/import, PIN lock) is the product's differentiator; a mandatory
  account backend would invert it.
- **Verdict:** B buys nothing A doesn't, at double maintenance cost.

### 6. Why not Option C (cross-platform rewrite, e.g. unify on RN/Expo)?

- Systemy's entire 15-system surface (≈90 components, 1157-line budget
  UI, week grid, quick-add sheet) is DOM-based; rewriting on RN
  discards the working majority to adopt the weaker minority.
- The Android distribution path (aapt2→apksigner, 3.3 MB APK, no
  EAS dependency) is fully owned and working; an Expo path reintroduces
  external build services and the exact env/auth failure modes Life-os's
  audit documents.
- The one genuinely native-class experience Life-os has (voice) is
  achievable on the web runtime in phase 2.
- **Verdict:** C's long-term benefit does not justify migration risk —
  the brief's own bar for choosing C.

## What Option A commits us to

1. **Systemy stays the single product**: one identity (v5 ribbon), one
   data layer (Dexie), one navigation (systems hub), Arabic-first RTL.
2. **Life-os is preserved read-only** at `/home/z/life-os` (tag
   `legacy-snapshot`) and on GitHub; nothing is overwritten.
3. Ported features land as Systemy-native implementations (Dexie tables,
   actions, ribbon-styled screens) — never as RN code paths.
4. Data migration is a **one-way, opt-in converter** (Life-os export →
   Systemy backup JSON), tested on copies; Systemy's own data is never
   touched by it.
5. Supabase/cloud remains an open future option for Systemy (accounts,
   sync) — documented as deferred, not foreclosed.

## Trade-offs accepted

| Trade-off | Why acceptable |
|---|---|
| Voice/OCR not in phase 1 | Web Speech API needs platform verification; core value first |
| Life-os i18n architecture not ported | Systemy is deliberately Arabic-first; 700-key × 7-lang translation is a product pivot, not integration |
| Light theme not ported | v5 ribbon identity is dark-native; light mode is a separate design project |
| Life-os "areas" nesting dropped | Systemy's flat projects + 15-systems hub already fill the mental model; nested areas were half-broken in Life-os |
| SM-2 not adopted | Systemy's Leitner 5-box is wired, simpler, verifiable; revisit only with evidence of quality gap |
| Memory graph reduced to typed links | Systemy's typed foreign keys (task.projectId etc.) already out-perform Life-os's label-substring graph; enrichment later |

## Consequences for the plan

The integration plan (`integration-plan.md`) sequences six concrete
slices (E0–E5) + a migration tool, each independently testable, none
touching existing business logic beyond additive changes, all styleable
in the v5 ribbon language. Deferred items are listed with the evidence
that would justify revisiting each.
