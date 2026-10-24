# V5-B — Today + Money «الشريط» redesign (working notes)

Boundary files (ONLY these): today/today-screen.tsx, money/budget-section.tsx, money/overview-section.tsx.
Context read first: worklog.md (V5-0 at end), skills/make-interfaces-feel-better (SKILL/surfaces/animations), skills/transitions-polish (motion tokens), upload/91a5dc7c…png (ribbon robot logo), globals.css V5 utilities.

## Key facts discovered
- **Turbopack stale-CSS bug (critical for all V5 agents):** after main's V5-0 edits to globals.css, the dev server kept serving an OLD CSS chunk — `:root` ribbon vars were present but `.ribbon/.ribbon-soft/.ribbon-hairline/.press` class RULES were missing (bottom-nav active indicator rendered as an invisible 22×3px transparent bar). Fix without touching file content: `touch src/app/globals.css` → recompile → rules appear in served chunk. If a future agent sees missing ribbon styles, touch globals.css (mtime only, content untouched).
- `.ribbon` on a span with w-1.5 h-1.5 rounded-full works as a gradient status dot (BP_META.good.dot = "ribbon").
- `text-[color:var(--ribbon-cyan)]` compiles in Tailwind 4 to `color: var(--ribbon-cyan)` (verified in emitted CSS).
- `.press` (globals) uses the `transition` shorthand → conflicts with Tailwind `transition-colors` (globals.css loads after utilities, so `.press` wins and kills color transitions). Therefore I used a self-contained const instead in all 3 files:
  `press = "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]"`.
- GlassCard (glass.tsx, not in my boundary) already does interactive active:scale-[0.96]; widgetEnter already y12+blur2 400ms.
- PrivateAmount always renders with `.tabular`; `.num-display` = tabular+bold. Money numbers verified tabular everywhere.
- V5-C agent works in parallel on quick-add/systems (quick-add-sheet.tsx was mid-edit with TS errors during my verification window — not my boundary; waited for it to compile).

## Decisions
- **Today:** greeting = GlassCard `ribbon-hairline` + logo-128 mascot 32px rounded-[10px] tile (next/image, priority); day budget bar fill = `var(--grad-ribbon)`, overspend keeps coral #FF8E7A; habit rings keep their hue (gradient stroke skipped — SVG risk); stagger normalized to index*0.04 capped 0.28s; mood whileTap 0.82→0.96; habit/task/empty-state buttons got press; habits + timeline empty states show mascot 64px opacity-90 above friendly Arabic line (tasks empty left as text — positive state).
- **Budget:** `budgetBarColor()` now returns `var(--grad-ribbon)` (only `over` keeps #FF8E7A) so PaceBar fill is THE ribbon signature; PaceBar track → bg-white/[0.08]; pace marker → 2px dashed white/40 (`border-s-2 border-dashed`); BP_META.good.dot → "ribbon"; month hero card = `ribbon-hairline` (the ONE hairline moment on money tab); week micro-bars: soft ribbon vertical gradient (DAY_BAR_SOFT), today = full ribbon DAY_BAR_TODAY + ring-1 ring-white/70 + column bg-white/[0.04]; daily-limit chip = `ribbon-soft` box + number `text-[color:var(--ribbon-cyan)]` (coral when overWeek); savings card gained an honest derived metric — savings share of liquid balances (liquidTotal added to the existing useMemo) rendered as a `ribbon` bar (piggy icon stays mint); envelopes/uncategorized bars keep status colors (restraint); all buttons (quick actions, QuickAmountForm, settings chips, carry radios, clear links, pencil) got press.
- **Overview:** net-worth hero = `ribbon-hairline` (num-display already tabular); month summary gained «شكل الشهر» mini-chart — income mint bar / expense coral bar (each vs monthMax) + full-width h-1 ribbon envelope strip (aria via role=img label); budget brief card button transition-all→specific props + active 0.99→0.96; سدد/account chips/QuickLink/الفئات buttons got press; 14-day pace chart intentionally NOT ribbon-ized (restraint — the budget hero is the money-screen ribbon moment).
- **Stagger everywhere:** delays renormalized to 0/0.04/0.08/…/0.28 (40ms steps, <300ms total, mount-only via widgetEnter).

## Verification (final — session V5-B re-run)
- `bunx tsc --noEmit`: **0 errors in src/**. `bun run lint`: **clean**. dev.log: all 200s, no runtime errors.
- agent-browser 390×844 (standalone mode `/?standalone`): onboarding completed (سلطان) → budget set (دخل 1300 / معيشة 800) → expense قهوة 25 + شاورما 14 via quick-add → both screens verified live.
- DOM-verified: budget tab = exactly 1 `.ribbon-hairline` (hero), PaceBar fill = `var(--grad-ribbon)` computed gradient, pace marker `border-style: dashed` white/40, 7 week micro-bars (today = full DAY_BAR_TODAY gradient + `ring-white`, height 52px max), daily-limit chip `.ribbon-soft` + number `rgb(0,205,254)` ribbon-cyan, on-track BP dot `.ribbon`. Overview = 1 `.ribbon-hairline` (net-worth hero), net-worth `.num-display` → `tabular-nums lining-nums`, month-shape chart present (mint income + coral expense + ribbon envelope strip).
- Today: greeting mascot tile 32px `border-radius: 10px`, day budget bar fill = ribbon gradient, on-track dot = ribbon (unified with BP_META), 2×64px mascot empty states (habits + tasks, opacity .9) + timeline (when empty).
- VLM review (glm-4.6v) of 4 key screenshots: ribbon gradient clearly visible on bars/hairlines, gold/mint/cyan money colors correct, zero clipping/overlap/broken text, RTL intact. Only note: dev-toolbar "Compiling…" overlay (dev-mode artifact, not app UI) + landing APK footer (page.tsx chrome, out of boundary).
- 13 screenshots archived in `upload/v5b/` (01–13).

## Final polish edits (this session, on top of the interrupted run)
- `today-screen.tsx`: removed the last `transition-all` (task title → `transition-colors duration-150`); tasks empty state now shows mascot 64px opacity-90 + friendly Arabic line (spec #6 compliance — was text-only); on-track dot `bg-cyan` → `ribbon` (unified with budget BP_META); all mascot images got `outline outline-1 -outline-offset-1 outline-white/10` (image-outline rule from make-interfaces-feel-better).
- Files final size: today 691 / budget 1157 / overview 550 lines. Worklog entry V5-B appended.
