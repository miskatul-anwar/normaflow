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
