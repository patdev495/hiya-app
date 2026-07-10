# System Sync And Responsive Audit - 2026-07-10

## Scope

Audit requested for whether the current system features operate correctly, remain internally synchronized, and are stable on desktop and mobile.

Checked surfaces:

- Prediction engine and betting signal engine.
- History entry, history display, correction affordances, settings, mode cards, mobile tabs, and mobile bottom sheet.
- Desktop viewport: 1440 x 900.
- Mobile viewport: 390 x 844.

## Verification Run

- `npm run build`: passed.
- `npm run test`: passed, 3 files / 41 tests.
- `npm run lint`: passed.
- Browser smoke test via Vite dev server on `http://127.0.0.1:5174/`.

## Findings

### P1 - History correction is not reachable

`CONTEXT.md` defines History Correction as the ability to correct any recorded outcome inside the active history window.

The currently visible history panel at `data-layout="top-history-panel"` is read-only. It renders index and outcome only. The older full history panel that contains edit/delete controls exists later in `src/App.tsx`, but it is wrapped in `className="hidden"`, so the correction workflow is inaccessible on both desktop and mobile.

Impact: users can add outcomes and clear the full history, but cannot correct a mistaken entry without direct storage manipulation.

### P1 - Mobile has horizontal overflow

At 390 px viewport, `documentElement.scrollWidth` measured 478 px. The visible overflow came from the header badge row (`Entropy`, `RTP`) and the absolute glow background elements.

Impact: mobile users can get sideways page movement and clipped header badges. This undermines the claim that the app is stable on mobile.

### P2 - Mobile tab labels fall back to raw translation keys

`MobileTabBar` calls `t('tabRecord') || '...'`, but `t()` returns the key string when a translation is missing. The fallback text is therefore never used.

Observed mobile bottom bar text:

- `tabRecord`
- `tabPredict`
- `tabAnalyze`

Impact: mobile primary navigation is functional but visibly unfinished.

### P2 - Several UI strings still contain mojibake in source

Some visible or reachable strings in `src/locales.ts`, `src/utils.ts`, `src/components/ModeCard.tsx`, and other components contain corrupted text such as `ChÆ°a ra`, `Nháº­p`, and similar mojibake.

Some high-traffic strings render correctly, but source-level corruption remains and appears in hidden or fallback surfaces.

Impact: Vietnamese UX is inconsistent and future UI exposure may surface corrupted text.

### P3 - Settings close button is not localized

The settings modal close action always renders `CLOSE` while the app defaults to Vietnamese.

Impact: not functionally broken, but inconsistent with the localized product surface.

## Working Behaviors Confirmed

- Build, lint, and test suite pass.
- Desktop main layout has no measured horizontal overflow at 1440 px.
- Adding an outcome from the record panel updates visible history count and prediction state.
- Mobile tabs switch between record and prediction views.
- Mobile mode card opens the bottom sheet with detailed prediction, evidence, regime, betting signal, and Kelly bet data.
- Settings modal opens on mobile and exposes the expected configuration controls.
- Browser console showed no error or warning logs during the smoke test.

## Recommended Next Fix Order

1. Restore an accessible edit/delete correction workflow in the visible history panel, or replace the visible read-only panel with the editable one.
2. Fix mobile overflow by constraining decorative absolute elements and making the header badge row truly contained.
3. Add `tabRecord`, `tabPredict`, and `tabAnalyze` translations instead of relying on unreachable fallbacks.
4. Clean mojibake strings in locale/utils/component source files.
5. Localize the settings close button.

## Resolution - 2026-07-10

Implemented in the follow-up fix:

- The visible history panel now exposes edit, delete, save, and cancel controls.
- Mobile horizontal overflow is resolved at the checked 390 px viewport.
- Mobile tabs now use real localized labels instead of raw translation keys.
- Reachable mojibake/fallback strings in the touched UI paths were normalized.
- The settings close action is localized.

Verification after the fix:

- `npm run build`: passed.
- `npm run test`: passed, 3 files / 41 tests.
- `npm run lint`: passed.
- Mobile browser smoke at 390 x 844: `scrollWidth` and `clientWidth` both measured `390`; history edit/save was exercised; settings showed localized `Đóng` and `Ngôn ngữ`; no raw tab keys were visible.

## Open Domain Question

Should "History Correction" allow editing/deleting only entries inside the active history window, or any retained full-history entry? `CONTEXT.md` currently says "inside the active history window", while the hidden implementation was capable of editing all retained rows.
