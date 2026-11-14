# Design system

Built with real shadcn/ui (`radix-nova`, Radix primitives) on Tailwind v4. Tokens live in `apps/web/src/index.css`.

## Direction
- **Product:** a finance workspace where owners read their money by asking in plain language and prepare payments they confirm themselves.
- **Character:** exact, calm, deliberate (the discipline of a pre-flight checklist).
- **World:** cockpit instruments, annunciator lamps and checklists. It tints the accent and the signature, not the surfaces.
- **Signature:** the amber annunciator lamp ("Synthetic data · Payments are simulated"). It is the only place amber appears outside warnings.
- **Moments (where colour and craft live):** the cash-flow chart, and the payment receipt built as a perforated ticket stub.
- **Pre-flight check:** confirming a payment first reads every line back in an `AlertDialog`; nothing executes until the explicit button.

## Tokens
- **Neutrals:** one graphite ramp (light `#f7f7f8` / `#17181c`; dark `#0e0f11` / `#ecedef`). Three text roles. Hairline borders, no gradients, no glows, no coloured shadows.
- **Accent:** one cobalt "signal" (`#2744e8` light, `#6f86ff` dark chart mark, `#9aabff` dark link text). Primary buttons are ink (off-white in dark mode).
- **Semantic:** positive `#1b7a4b`, negative `#b3382c`, lamp `#f5a524`. A status is always a dot **plus** a word.
- **Type:** Instrument Sans (interface) and JetBrains Mono (IDs, tool names, receipts), weights 400/500, sentence case, tabular figures for money. Loaded from `@fontsource-variable` (no third-party font requests).
- **Shape and spacing:** 4px grid; controls 8–10px radius, cards 14px. One easing curve, one entrance on load, `prefers-reduced-motion` respected.
- **Money:** always integer cents, one display format (cents shown) everywhere on a screen.

## Chart (dataviz procedure)
Validated with the skill's `validate_palette.js`:
- Light `#2744e8` + `#8d92a0` on white: lightness band, CVD separation (ΔE 23), normal-vision floor (ΔE 28) and contrast all pass.
- Dark `#6f86ff` + `#6d727e` on `#16171a`: all pass (the first candidate `#8fa2ff` failed the lightness band and was replaced).
- **Documented exception:** the validator's *chroma floor* flags the neutral second series. That is intentional (one accent, one quiet neutral). Identity never relies on colour alone: legend, tooltip, a direct label on the current month, and a table view (`Chart | Table`).

## Accessibility
- Automated: axe-core (WCAG 2 A/AA + 2.1 A/AA) on every route in light and dark, desktop and mobile, failing on serious/critical (`e2e/tests/a11y.spec.ts`). It found and we fixed: tabs without panels, low-contrast inactive tabs, a label/name mismatch on the search button and a horizontally scrolling table.
- Keyboard: skip link, visible focus rings, Radix focus management in dialogs and sheets, `Ctrl/Cmd+K` palette.
- Not covered: automated checks catch only part of the problems. Manual screen-reader and keyboard walkthroughs have not been done.

## Notes
- `src/components/ui/*` is shadcn-generated (excluded from lint). Local edits: tab contrast, overlay scrim (a plain dim instead of a blur), theme from Redux instead of `next-themes`.
- shadcn `radix-nova`'s `CommandDialog` does not provide the cmdk root; `CommandPalette` wraps its children in `<Command>`.
- `cn` comes from the shadcn-org `cn` package, as installed by the shadcn CLI.
