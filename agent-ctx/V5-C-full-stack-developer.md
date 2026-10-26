# V5-C — Quick-Add + Systems «الشريط» redesign (final record)

Boundary files (ONLY these): quick-add/quick-add-sheet.tsx, quick-add/amount-pad.tsx, systems/systems-screen.tsx.
Previous agents' full records: /home/z/my-project/worklog.md (V5-0/V5-A/V5-B sections at the end).

## Status: COMPLETE + live-verified (tsc/lint/errors zero, 8 screenshots in upload/v5c/)

## Key facts discovered
- vaul 1.1.2 animates the sheet via INJECTED CSS (`[data-vaul-drawer]{animation-duration:.5s;...}`, keyframes slideFromBottom/slideToBottom) and overlay via `[data-vaul-overlay]...{animation-duration:.5s}` → durations/easings are overridable with higher-specificity selectors. shadcn drawer.tsx is NOT in my boundary, so I scope overrides with `#quick-add-sheet` id + `body:has(...)` for the overlay, rendered through a React 19 `<style href precedence>` tag inside my component. VERIFIED in browser: style hoisted to <head> (data-precedence="high"), computed animation 0.4s cubic-bezier(0.22,1,0.36,1), overlay fadeIn 0.25s.
- vaul uses the content's `::after` for its bg-extension hack → `.ribbon-hairline` (also ::after) CANNOT be used on DrawerContent; a real 2px `.ribbon` div at sheet top (inset-x-[14%]) is used instead.
- React 19 `<style href precedence>`: the href attribute is NOT rendered to the DOM (query by textContent, not by [href]).
- Tailwind v4: `ease-in-out` = cubic-bezier(.4,0,.2,1) by design; `rotate-180` uses the CSS `rotate` property (check `getComputedStyle().rotate`, not `.transform`); `transition-transform` covers transform,translate,scale,rotate.
- TERMINAL ARTIFACT: git diff / rg / grep outputs show `duration-[150ms]` as `duration-s]` — the tool's renderer eats `[150m` as an ANSI code. File bytes are correct (hexdump-verified). Don't "fix" phantom corruption.
- Bottom-nav active indicator = `motion.span layoutId + .ribbon h-[3px] w-6` — mirrored for quick-add money segments (24×3px ribbon pill, layoutId="qa-money-kind-pill", 250ms smooth-out).
- Seed: 15 systems. FAB (bottom-nav center ⊕) → openQuickAdd(). «المزيد» sheet → "افتح شاشة الأنظمة".
- glass-soft = plain bg+border (no transition), so `.press` + instant `active:bg-white/10` compose cleanly.

## Decisions (implemented)
- Save button & big amount: unified GOLD for all money kinds (V5 rule: gold = primary action, money = gold).
- Active money segment/entity chip: `ribbon-soft` bg + `text-foreground`; ribbon gradient pill via layoutId on money segments.
- Context line: on-track → `text-[var(--ribbon-cyan)]` (verified rgb(0,205,254)); over-budget keeps coral; income/saving keep mint.
- Sheet: open 400ms ease [0.22,1,0.36,1] + inner wrapper scale .97→1 & blur 2→0; close 350ms via custom `qa-sheet-close` keyframe (early fade @70% = softer, no scale); backdrop 250 in / 150 out; sections stagger 40ms mount-only (0/.04/.08/.12).
- Options accordion: chevron 250ms symmetric ease-in-out; height expand/collapse 350ms (AnimatePresence + exit).
- Save label swap: contextual icon anim — scale 0.25→1, blur 4→0, spring 0.3 bounce 0.
- Systems: ribbon-soft chip behind count «15 نظاماً» (no text gradient); 45 feature chips ribbon-soft + text-white/70; live indicator in glass-soft pill (dot keeps sys color) + 2px ribbon fill only when live.text ≠ ""; card press 0.96; stagger 20ms (15×20 = 280ms cap); «تم» 0.96 (fixed from 0.95).
- No current-system concept on systems grid → ribbon-hairline skipped there (per spec).
- Hit areas ≥44px everywhere (h-9→h-11 on chips/buttons in sheet; pad keys 56–64px).

## Live verification (agent-browser 390×844, ?standalone)
- Browser DB had monthlyBudget 0 → reset to 1300/800 (per brief assumption) to exercise the context line.
- FAB ⊕ → sheet opens; typed «شاورما» + 492 via pad; context cyan + amount gold verified via computed styles.
- Tab switch مصروف→دخل: layoutId pill moved, ribbon-soft bg followed; income context mint.
- Options accordion: chevron rotate 180deg / 250ms; chips 44px.
- Save → immediate close; during close: `qa-sheet-close 0.35s`, overlay gone ≤150ms, sheet unmounted after.
- Smart capture «قهوة 18» → parse preview (kind chip ribbon-soft) → apply fills desc+amount.
- Systems: 15 cards, count chip ribbon-soft, 45 feature chips, 15 live pills (1 ribbon fill — only money has activity), customize mode full (drag/arrows/switch/expand color+icon), reorder persisted to db then restored.
- `agent-browser errors` empty; VLM review of 4 screenshots passed (ribbon hairline visible, pill under active segment, no clipping/overlap/RTL breaks).
- `bunx tsc --noEmit` zero src/ errors; `bun run lint` clean; dev.log 200s only (v5.0 APK 404 is a pre-existing stage issue outside this task).
