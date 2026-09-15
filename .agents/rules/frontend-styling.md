# Desktop styling

Apply when changing Desktop renderer components, CSS, themes or visual states.

- Read `app/desktop/src/renderer/styles.css` and the affected component before choosing tokens. The stylesheet is the token inventory; do not duplicate it here.
- Reuse semantic surface, text, border, accent and status tokens. Define missing tokens in the existing token structure for every supported theme.
- Follow existing component variants and styling conventions. Runtime user-selected colors and data-driven graphics are valid exceptions to semantic colors.
- Check contrast, keyboard focus, disabled/loading/error states and overflow in affected themes and viewport sizes.
- Complete the Desktop runtime verification gate in `AGENTS.md`; a CSS build alone does not verify the result.
