# UI conventions

One button, one icon set, one shape. Keep new UI inside these rules; a test
(`src/components/ui/button.test.tsx`) guards the button part.

## Buttons

Use `Button` / `IconButton` from `src/components/ui/button.tsx` for every clickable action.
Do not write one-off `<button className="…">` styles.

| Variant | Look | Use for |
|---|---|---|
| `primary` | solid teal | the single main action of a region: Run, Download, Apply, Build |
| `secondary` (default) | white, bordered | every other action: Open, Save, Upload, Copy, Output, Back |
| `ghost` | borderless | low emphasis: Cancel, Show all, per-row actions, undo/redo |

- **Shape:** `rounded-lg` always. Heights: `sm` 32 px, `md` 36 px, icon buttons the same square.
- **No gradients, no second accent colour** (teal is the only primary; emerald is not used).
- **Labels:** actions show an icon *and* a text label. The header collapses labels to icons below 1180 px wide; the tooltip and `aria-label` keep the name.
  Icon-only buttons are allowed for undo/redo, tab chrome, and per-row actions, and must use `IconButton`, which requires a `label` (tooltip + accessible name).
- **Disabled** buttons keep their tooltip so they can say why ("Upload a CSV file first").
- **Icons:** `lucide-react` only.

## Not buttons

Status chips and tags (for example the pipeline step chips) are small rounded rectangles and are not clickable. Underlined tabs
(Normal Forms) and the Output page navigation are navigation, not actions.

## Consistency rules (checked by `npm run audit:design`)

"Seamless, connected, well crafted" is judged by people, but its parts are measurable, so they are measured:

| Rule | Value |
|---|---|
| Typefaces | Inter, plus one monospace face for identifiers and code |
| Text sizes | 10, 11, 12, 13, 14, 16, 24 px (seven steps, none smaller than 10) |
| Buttons | 32 px (36 px in the header) with an 8 px radius; compact filter chips 24 to 26 px with 6 px; full-width list rows are square |
| Cards and panels | 8 px, 4 px for code blocks, 13.6 px for the page panels |
| Colour | Neutral surfaces; teal for the main action and for keys; green, amber and red only for status dots and verdicts; no gradients |
| Motion | One 150 ms ease for hover and focus on every button; section content fades in over 180 ms; everything stops under `prefers-reduced-motion` |
| Themes | Every colour comes from a token, so light and dark are the same layout |

`npm run audit:design` reads computed styles on the pipeline page and every Output tab in both themes and fails when a
view drifts outside these values. `npm run audit:ui` checks layout, errors and accessibility on 144 views.
