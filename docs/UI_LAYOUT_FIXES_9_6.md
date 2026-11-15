# Hexrota 9.6 — responsive layout corrections

Date: 2026-11-15. Reviewed baseline: `b2c59b968e871e973ffa701c464b095da37f098c` (PR #18).

## Reproduced problems

1. The native modal inherited `position:relative`, resolving to an absolute top-layer panel. Opening the pregame dialog after scrolling the home screen could put its top above the visible viewport. At 320×568, a real app flow in the local DOM/CSS harness measured top -313.17 px after 334 px of page scroll. Scrolling to a button made the old single-element tests pass while hiding the dialog header.
2. `#home-garden` retained a 9/12 px inline margin although home actions are now full-width blocks. Its edges no longer aligned with Oyna and the tutorial action.
3. The narrow life-summary row allowed a label/value combination to overflow its card. The 320 px probe measured the value's right edge beyond the dialog's right edge.
4. The extra Tavik portrait increased the compact home hero's height. On a 320×568 screen the initial play action required scrolling and could sit underneath the fixed bottom navigation.
5. Close buttons and long eyebrow headings did not reserve separate space; the reskinned ribbon needed an explicit corner exclusion.

These are presentation corrections, not game-balance changes.

## Changes

- Keep every themed dialog fixed to the viewport, with safe-area-aware width/height limits, internal vertical scrolling, and contained overscroll. Existing modal closing, focus, and transaction behavior remain unchanged.
- Align all full-width home actions; remove only the obsolete garden inline margin.
- Stack life-summary labels/values on narrow screens and allow long values to wrap.
- On compact portrait screens, hide the decorative book and duplicate text, reduce the Tavik portrait, and keep Oyna above the bottom dock. Tavik, the explanation, and the level label inside Oyna remain available.
- Reserve space for the close button beside a dialog eyebrow. No gameplay canvas sizes, tile geometry, input thresholds, currency, difficulty, save or C# logic change.
- Advance the complete offline shell and every current query reference together from v31 to v32.

## Regression coverage

The existing Comic Adventure browser suite now has 63 groups per browser across 320×568, 375×667, 390×844, 430×932, 844×390, 932×430 and 1280×900. It retains the previous image decoding, gameplay controls, inventory, settings and isolated kit checks.

Added checks include: complete modal-frame containment before helper scrolling; all dialog types opened from a scrolled menu; unchanged authoritative profile during those layout probes; aligned home action edges; initial compact-phone CTA visibility above the fixed dock; life values inside their card; title/close non-overlap; and rotating/resizing while a pregame dialog is open.

The `fits` helper explicitly centers ordinary content before asserting its bounds; it does not move or repair a dialog before the new whole-frame assertions. Existing clipping thresholds are unchanged.

## Evidence and limits

- Full local `npm test`: passed. Maintenance and protected-source checks passed, including 89 domain/source boundaries.
- Local Chromium: 63 groups passed with inline CSS/scripts and an isolated in-memory profile. Network navigation is restricted in this environment; this local run is not HTTP/PWA or physical-device evidence.
- Actual HTTP Chromium/WebKit, all 15 CI jobs, and production deployment are verified on the final review/merge commit; see PR #18 and its Checks tab for authoritative results.
- Physical iPhone/Android, Unity/IL2CPP and real ad/payment SDK checks were not performed.

The approved Tavik crop and its identity metadata are unchanged. Story unlocking remains a labelled UI-kit example; this patch does not replace botanical progression or change stars.
