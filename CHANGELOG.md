# Changelog

All notable changes to NormaFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added ("run everything" in the request box)
- A request such as "run all steps", "run everything", "use every option", "the whole pipeline" or "end to end" now builds the pipeline from **every operation in the sidebar** (all 19). Before, these words were ignored and the request matched nothing. Skips still apply: "run everything except the report" gives 18 steps, and "run all steps without 3NF" also drops the steps that need 3NF (BCNF, Relation Generator, SQL Generator). A SQL dialect and "run" in the same request still work. Plain requests such as "normalize all tables to 3NF" are unchanged.

### Changed (operation renamed)
- The **NER Classifier** operation is now the **Column Classifier**. It was never named-entity recognition: it is a rule-based step that labels each column (identifier, person name, price, date, ...) from its header and sample values, and the labels are shown in the multi-file overview only. Saved pipelines, scripts and command-line calls that use the old name still work, and "run ner" still finds the step.

### Changed (quality document)
- `docs/QUALITY.md` now states that NormaFlow follows the ISO/IEC 25000 SQuaRE series as a self-assessment (not a certification), with current numbers (646 tests, 0 accessibility violations), the Windows, Linux and macOS install check, and the limits of the on-device naming model.

### Removed
- Root-level leftovers: `NOT_DONE.md`, `IMPROVEMENTS.md` (the audit work list and its open-items file; both remain in git history), a duplicate `icon.png` (the app uses `public/icon.png`) and `shell.nix`.

### Fixed
- SQL dialect: a dialect named in the request box ("... generate SQL for PostgreSQL", also MySQL, SQLite, ANSI) was shown in the preview but never reached the engine, so the SQL always came out in the default dialect. It is now passed on each run in that workspace and kept until another dialect is requested. For a single file it switches to the dialect-aware generator (the one multi-file runs use); with no dialect requested, the single-file output is unchanged.
- Renaming a relation: the box opens with the current name selected, so typing replaces it instead of adding to it.
- Relation naming: when the decomposition uses a key equivalent to the table's own (for example `product_name` for `product_id`), no relation held the whole key and the file name went to the first relation, often the wrong one. The file name now goes to the relation holding the most key columns, then the one with the largest key of its own.
- Output page sidebar: the active row's teal outline was cut off along its top edge when it was the first row under a section heading (Overview, Normal Forms, ERD Diagram); the sticky heading covered it. There is now a little space under each heading.

### Changed (floating workspace tabs)
- The workspace tabs are now floating, fully rounded pills with the same radius and shadow as the header, instead of file-folder tabs joined to it. The space is even: 12 px above the strip, 12 px between the strip and the header, 12 px at the left edge, 8 px between tabs. The active tab has a teal outline; a tab colour shows as a bar along its top edge. The header still takes the active tab's tint.

### Added (model-based relation names)
- Relations created by normalization are no longer named by joining column names (`address_city_zip`). The engine gives each new relation an opaque id (`relation_1`, ...); the relation that holds the table's key keeps the file name; the others are named by a small on-device model (SmolLM2-360M-Instruct, 4-bit, Apache-2.0) as one noun phrase, or stay "unnamed" with their id when there is no answer. No naming rules are written by hand.
- The model sees the **column names only** (never rows) and runs in a Web Worker with remote loading off, so data stays on the machine. Only the relations of the final schema are named (one model call per distinct set of columns, about 1 s each in Node; about 58 s for a 3-relation table including the first model load in Chromium).
- Names are marked **suggested** (model) or **unnamed**, with a **rename** link. A name you type is remembered for the same table and columns and wins over the model on the next run. Output text (ERD, SQL, report) uses these names; a rename shows in the relation list at once and in generated text on the next run.
- Measured quality: 15 of 22 tables named correctly (68%) on Chinook and Northwind; junction tables tend to come out as one of their parents. Treat names as suggestions. See `docs/notes/model-naming-spike.md`.
- **Installer size:** the model is about 373 MB and is fetched at build time by `scripts/prepare-nl-assets.mjs` (SHA-256 checked, git-ignored); release builds fail if it cannot be fetched. This is a conscious departure from the "no multi-hundred-MB model" goal, accepted by the project owner.
- Tests, the CLI and builds without the model name relations by id (`relation_N`) and say so; existing tests now assert structure rather than concatenated names.

### Added (workspace naming)
- The app asks for a workspace name when it opens, and the **+** button (or Ctrl/Cmd+T) asks for a name before adding a workspace. Enter confirms, Escape or Cancel adds nothing (the first prompt cannot be dismissed, since a workspace must exist), an empty name is refused, and a duplicate name is allowed with a note. A name you choose is kept when you upload a file (a file used to rename an untouched tab). The dialog is modal: the page behind it is inert and Tab stays inside.

### Added
- **Light and dark mode.** A switch at the end of the workspace strip (so it is on both the pipeline and the Output page) toggles the theme. With no choice made, the app follows the operating system; the choice is remembered. Diagrams stay on a light page in dark mode so their colours stay true.
- `docs/QUALITY.md`: the app assessed against the ISO/IEC 25010 characteristics and ISO/IEC 25012 data quality, with the evidence for each and what is not covered. `npm run quality` runs the automated gates; `npm run audit:a11y` runs an axe-core audit of the pipeline page and every Output tab in both themes (currently 0 violations).

### Changed (pipeline and Output page, a calmer look)
- **Pipeline canvas:** steps now wrap into rows of five (they used to run in one line, so a full pipeline fitted at an unreadable zoom), the view re-frames when steps are added, and wrapped links route as right-angle steps. Nodes are flat cards with a small accent chip; the glowing emerald Start node, pulsing halo, travelling pulses, marching dashes and teal-to-violet gradient edges are gone.
- **Output page:** every summary strip uses one neutral `StatCard` (the number in ink, a small dot for good / watch / problem) instead of green / yellow / red / blue tinted boxes; the column-classification pills are neutral except primary and foreign keys; section headings are in order.
- Cardinality and Keys lose their leftover blue / green / purple / yellow pills and tiles: neutral chips, teal accents only where something is a key.
- Removed about 800 lines of unused legacy CSS.

### Changed (design consistency)
- Large schemas (more than 12 relations) open the ERD as the compact entity / relationship overview instead of with every attribute drawn; **Show attributes** brings them back.
- Text sizes are down from nine to seven steps (the 10.5 and 11.5 px sizes folded into 11 px) and the pipeline step chips use the same 8 px radius as buttons. `npm run audit:design` measures typefaces, text sizes, button heights and radii, and card radii on every view in both themes, and the rules are written down in `docs/DESIGN.md`.

### Fixed (accessibility, WCAG 2.1 AA)
- Workspace tab buttons and the canvas zoom controls now ease on hover and focus like every other button (they snapped).
- The "added because a later step needs it" chips in the plan preview failed contrast in light mode; fixed.
- `npm run audit:ui` checks the whole interface in one pass: the pipeline page (empty and plan preview) and all ten Output tabs, for one table and for three, in light and dark at 900, 1300 and 1700 px (144 views), for page overflow, content running past its panel, console errors and axe violations. Currently clean.
- The workspace strip is a labelled navigation of real buttons (it nested buttons inside tabs, which screen readers cannot operate).
- Contrast: the main action (teal 700, 5.5:1), small grey text, locked operations (no longer faded), status badges, code comments and line numbers.
- Result panels and diagrams are focusable regions, so scrolled content works from the keyboard; the pipeline page has a heading and landmarks.
- `prefers-reduced-motion` now disables every animation and transition.
- Dev dependencies: vitest 3 to 5 clears the two critical advisories (tinypool); shipped dependencies have no high or critical advisories.

### Fixed (engine: fewer coincidental dependencies)
- **Over-decomposition on real data:** 11 Chinook tables came out as 48 BCNF relations, many of them built from coincidental dependencies. Dependency mining now (a) skips near-unique determinants (their dependencies hold by accident, which also makes mining about 3.7x faster on large tables) and (b) only uses determinants with no missing values. Chinook now yields 409 dependencies instead of 779 and 30 relations instead of 48, and the generated SQL loads into SQLite with foreign keys enforced and no violations (it did not load before).
- **Foreign keys:** a link is no longer drawn in both directions between a key and its child table (it produced a bogus 1:1 `invoice.InvoiceId -> invoiceline.InvoiceLineId`), and links where not every value matches are listed as unplaced instead of becoming a constraint that fails on load.
- **CSV:** the delimiter sniffer no longer misreads files with escaped quotes followed by delimiter-heavy text.

### Changed (small-sample guard)
- Tables with fewer than 10 rows now only use key determinants when mining dependencies: with so few rows almost any two columns look dependent by chance, and each such dependency split off a spurious relation. On Chinook this removes 25 coincidental dependencies (409 to 384) and takes the result from 30 to 25 relations, with the generated SQL still loading with foreign keys enforced. It is a heuristic: a genuine dependency in a table of under 10 rows is no longer found. The threshold is the `minRowsForNonKeyDeterminants` option (0 turns it off). The Chen diagram's 1 / M / N labels also sit further from the boxes.

### Added (Output page, part 6)
- **Small-table warning** on the Dependencies tab: when dependencies come from tables with fewer than 100 rows, a note says how many (Chinook: 295 of 409, from `customer`, `employee`, `genre`, `mediatype` and `playlist`) and that with so few rows a dependency can hold by chance, so they should be treated as candidates to check. It does not change what the engine mines.

### Fixed (Output page, part 5)
- **Narrow windows:** the dependency table no longer clips its **View** column below ~1000 px (Coverage and Quality columns hide as the window narrows). Checked at 900x640, 1300x820 and 1700x1000.
- **Generated SQL:** per-table comments no longer promise "Performance optimized" / "Optimized for reference queries" / "Optimized for analytical queries" (they now say what the table is), and the section banner no longer says "VALIDATED".
- **Cardinality** (single table and multi-table) and **Generated Files** at 900 px: the cardinality table no longer clips its last columns (Total values, Data type, Values matched and Confidence hide as the window narrows; relationship types shorten to 1:N / M:N), and file sizes no longer wrap onto three lines.
- **Normal Forms** at 900 px: the BCNF tab was cut off and long relation names ran into the attribute count; the tab labels shorten and the card header wraps.
- **Quality Assurance:** "Lost Dependencies: 0" is grey instead of an alarming red.
- **Chen ERD:** the 1 / M / N cardinality labels sit clear of the entity boxes.

### Fixed (Output page, part 4)
- **Crow's foot** has the **Show attributes** toggle too (the Mermaid diagram collapses to table names only), so all four ERD notations share the same controls.
- **Normal Forms** in the sidebar counted relations across all four levels (145 for 11 tables); it now shows the relations in the final schema.
- **Report:** the quality chips for a multi-table run read "Dependencies lost (9/11 tables)" when 9 of 11 were preserved; they now say "Dependencies preserved (9/11 tables)" and turn amber unless all pass. "Data retained" is no longer blank for multi-table runs.
- **Primary key choice:** when two candidate keys identify each other (an id and a unique name), 3NF synthesis now keeps the preferred one (the id) instead of whichever came first in the minimal cover. Album is keyed on `AlbumId`, not `Title`.
- **SQL header:** the generated DDL no longer claims "MATHEMATICALLY VALIDATED … GUARANTEES: lossless join + dependency preservation" or carries an author line; it states what it is and points to the per-run analysis for the checks.

### Changed (Output page polish, part 3)
- **Crow's foot** now has the same toolbar as the other notations: zoom, fit, Copy Mermaid, download `.mmd` and SVG. All four notations render through one viewer.
- **Chen** diagrams of large schemas (more than 10 relations) use a left-to-right tree layout instead of a force layout, so labels stay readable at 100%.
- **Copy buttons** (SQL, ERD source, generated-file previews) confirm with a check mark and "Copied" for a moment; a blocked clipboard no longer throws.
- **SQL tab** header matches the other panels (compact title, same corners).

### Added (ERD notations)
- The ERD tab now offers four notations: **Chen**, **Crow's foot**, **Barker** and **UML**. Barker shows rounded entities with `#` unique identifier / `*` mandatory / `o` optional attributes (optional is read from empty values in your data), dashed lines for optional relationships and a bar on the crow's foot when the relationship is part of the identifier. UML shows class boxes with typed attributes and «PK» / «FK» stereotypes and multiplicities (`1`, `0..1`, `0..*`, `1..*`). Chen, Barker and UML are drawn by the bundled Graphviz, with zoom, optional attribute lists and DOT / SVG download named after the notation. Large schemas lay out left-to-right so they grow downwards. Chen cardinality labels now sit beside the entity instead of under its edge.

### Changed (Output page polish)
- **Functional dependencies:** the table now fits its panel (it used to overflow and hide the View column), shows which table each dependency comes from, and has a confidence filter (All / High / Medium / Low), a search box and paging (50 at a time, with Show more / Show all) so hundreds of dependencies stay usable.
- **Multi-table runs now fill every tab.** Cardinality & Relations lists the foreign keys found between your tables (cardinality, share of values matched, confidence); Keys shows primary and candidate keys per table; Quality Assurance shows lossless-join and dependency-preservation per table with a summary and expandable detail. The report's quality chips use the same per-table verdicts. Before, these tabs said "No data" even though the checks had run.
- **Normal forms:** compact 1NF / 2NF / 3NF / BCNF tabs with counts, smaller card headings and section labels.
- **ERD:** zoom buttons (and Ctrl + scroll) plus fit-to-width, so large diagrams are readable.
- **Overview** for a single table now shows rows, columns, dependencies and duration plus the normalization journey (it was just four cards, two of them meaningless for one table); the multi-table column classification uses the same card style.
- **ERD:** small diagrams keep their natural size instead of stretching to the panel; large ones are packed so separate groups of tables sit side by side. Crow's-foot view uses the same compact header. Generated Files category chips scroll in one row instead of wrapping into four.
- **Transitions:** switching sections now eases in (the `nf-fade-in` animation was referenced but never defined, so nothing animated); hover and focus states are consistent, reduced-motion is respected, and leftover gradient headers and inline font styles are gone.

### Fixed
- **View** on a functional dependency now opens its analysis directly under that row instead of at the bottom of the whole list, so it works with hundreds of dependencies.

### Changed (smaller start-up bundle)
- The start-up JavaScript dropped from about 1.95 MB to about 0.8 MB (React, the flow canvas and the app). The Output page, Mermaid (crow's-foot diagrams) and the PDF library now load on first use. Build warning about large chunks is gone: what remains above 500 kB is Graphviz WebAssembly, Mermaid's diagram engines, the spreadsheet parser and the embedding worker, all loaded on demand from the installed app.

## [3.0.0] - 2026-11-11

### Changed (system notifications)
- Messages no longer pop up inside the app. Pipeline results, errors, warnings, saves and uploads are sent to the operating system's notification centre. The title is the **workspace name** (a renamed workspace shows its new name) and the text is the message; the OS already shows the app name and icon. Routine confirmations (adding a step, connecting two steps) are only logged. The in-app toast stack, the bottom status pill and the notification sound are removed, and the `sonner` dependency with them.
- The desktop app uses the Tauri notification plugin (permission is asked on first use); a plain browser falls back to the Web Notifications API; if neither is allowed nothing is shown.
- The **Undo** that used to sit on the "Pipeline built" toast is now an **Undo last build** button under the command bar.

### Added (Chen ER diagrams)
- The ERD tab now draws **Chen notation** by default: rectangles for entities (double border for weak entities), diamonds for relationships with 1 / M / N cardinality, ellipses for attributes with keys underlined. Foreign-key columns appear as relationships, and junction tables as one many-to-many relationship that carries their own columns. Layout is done by Graphviz compiled to WebAssembly and bundled with the app, so nothing needs installing and it works offline. Switch to **Crow's foot** (Mermaid) with the toggle, hide attributes for a compact overview, and download the diagram as SVG or DOT.

### Added
- The **Full Report** tab shows real components (summary, quality checks, normalization journey, strongest dependencies, performance, operations) instead of a Markdown preview. **Download PDF** builds a PDF from the generated Markdown, offline.
- Natural-language input is more robust: Unicode and zero-width cleanup, a 400-character cap, conservative typo repair, "don't run it" and "SQL is not needed" understood, embedding timeouts and vector validation, and no unhandled errors in the command bar.

### Fixed
- Performance report: **Memory (MB)** is no longer `N/A` in webviews without a heap counter (it shows an estimate of the loaded data, labelled), and **Cache Hit Rate** is measured (partition-cache hits during FD mining) instead of a constant 0.0%.

### Changed (header layout)
- Undo, redo and Reset now sit beside the logo on the left; Open, Save and Upload are centred in the header; Run and Output stay on the right. The three zones are a grid with equal side columns, so the middle group stays exactly centred.

### Changed (Output page look)
- The Output page now uses the same layout as the pipeline page: a rounded header card, a sidebar card styled like the operations palette (titled header, grouped sections, tinted icon tiles, name and one-line description per row) and a white rounded content panel.
- Removed the header labels "Workspace …", "Complete Pipeline Executed" and "N Tables Processed". The tab strip already says which workspace you are in, and the header now just reads "Analysis results" with the time the page was opened.

### Changed (tabs on every page)
- The workspace tab strip now sits above both the pipeline and the Output page, so you can switch, add, rename, recolour and close tabs from either one, in any order. Ctrl/Cmd+T, Ctrl/Cmd+W and Ctrl+Tab work on both pages.
- The Output page follows the active tab: each tab shows its own results (and resets to its Overview), and a tab that has not run yet shows "No results yet for …" with a button back to its pipeline. One tab's fresh results are never shown under another tab.
- The Output header takes the active tab's colour, continuing the tab like the pipeline header does.

### Fixed (Output page)
- The **SQL Schema** tab took seconds to open on large schemas. It used `react-syntax-highlighter` (Prism), which builds a React element for every token of every line before showing anything. It is replaced by a small virtualized viewer (`CodeViewer`) that renders and highlights only the rows on screen, with line numbers, horizontal scroll and its own SQL highlighting. `react-syntax-highlighter` and its types are removed from the dependencies.
- The Output page now says which workspace its results belong to: a badge with the tab's name and colour in the header (the header and its bottom border take the tab's colour). With several tabs open, results can no longer be mistaken for another tab's.

### Removed (header)
- The **Full 3NF** button. Build the pipeline from the sidebar or the text box instead.

### Added (spreadsheet input)
- Excel and LibreOffice/OpenDocument workbooks can be loaded next to, or instead of, CSV files: `.xlsx .xlsm .xlsb .xltx .xltm .xlam`, `.xls .xlt .xla .xlw` (Excel 2.x to 2003), Excel 2003 XML, `.ods .ots .fods`. Formats are read from the file's bytes, so a wrongly named file still loads.
- Each visible, non-empty sheet becomes one table (`book.csv`, or `book_Sheet.csv` when there are several), so multi-sheet workbooks get cross-table foreign-key detection. Hidden and empty sheets are skipped and logged.
- Dates become ISO 8601, cached formula results are used (formulas are never evaluated, macros never read), error cells become empty, float noise (`0.30000000000000004`) is removed, and text ids keep their leading zeros.
- Damaged, truncated and password-protected files are rejected with a message naming the file; tab-separated text saved as `.xls` is read as CSV.
- New dependency: SheetJS `xlsx` 0.20.3, installed from the SheetJS CDN (the npm `xlsx@0.18.5` has known CVEs). Loaded on demand (about 160 kB gzipped), only when a spreadsheet is opened.
- Workers are now built as ES modules (`worker.format: 'es'`), matching how they are already created, so they can lazy-load code.

### Changed (sidebar)
- The operations sidebar is now a list: every operation with its name and a one-line description, grouped by phase with per-phase and overall progress (`8/19`), and a filter box. Narrowing it gives an icon-only rail with tooltips; widths from 64 to 360 px; arrow keys move between operations.
- Each operation shows what a click will do: added (check mark), ready, or locked (a prerequisite is missing). Clicking a locked step now adds the steps it needs, in order, instead of failing with an error: "Added 3NF with 7 prerequisites: …".
- The default sidebar width and its saved setting changed, so old saved widths no longer apply.
- Removed about 425 lines of the old icon-grid and tooltip CSS.

### Removed
- The built-in sample dataset. Nothing is preloaded any more, so results always come from files you upload. Run, Full 3NF and Output now ask for an uploaded file instead of silently analysing four sample rows.

### Changed (UI consistency)
- One shared `Button` (primary / secondary / ghost, one radius, two heights) replaces the dozens of hand-styled buttons. Documented in `docs/DESIGN.md`.
- Header: every action now has an icon and a label (labels collapse to icons on narrow windows); "Run" is the only primary button and "Synthesize 3NF" became "Full 3NF". Undo and redo are the only icon-only buttons.
- Natural-language box: the particle-effect input is replaced by a plain text field and a "Build" button; Apply / Replace is primary, Apply & Run secondary, Cancel ghost.
- Output page: Back, Copy and Download use the shared buttons (emerald and gradient variants are gone); per-row actions are labelled icon buttons.
- Operation palette: rounded squares with the same radius and border as other buttons instead of bouncing circles.
- Removed unused UI code (the shadcn sidebar, sheet, tabs, tooltip, skeleton, separator, input, code-block and entity-analysis components) and the `react-icons`, `@tabler/icons-react` and four Radix dependencies that only they used. Icons are lucide-only.

### Fixed
- App icon: the source image had a 1 px semi-transparent grey line down its left edge, which was carried into every generated size (taskbar, dock, installer). The edge is cleared and the whole set regenerated with `tauri icon`; `bundle.icon` now lists the files the Tauri docs recommend (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` with the 32 px layer first) instead of `logo.ico` and a `.webp`.
- The upload button no longer shows a `1` badge before any upload. The count is exactly the files you uploaded.

### Changed
- The active workspace tab now joins the header with no gap: they share one surface colour and the header sits directly under the tab strip.
- The header shows only the app icon; the "NormaFlow" title and subtitle are gone.
- Removed the "Embeddings: ready/offline" label under the natural-language box. The bundled model needs no setup, and keyword matching works regardless.

### Added
- Tab colours: a dot on each tab opens a picker (nine presets, a custom colour, or none). The colour marks the tab and tints the header of the active tab. Also in the right-click menu.
- Workspace tabs: several independent workspaces in one window, each with its own canvas, files, results and running job. Click to switch, rename with the pencil on the tab, double-click, `F2` or the right-click menu (a new tab is named after its first uploaded file), `×` or middle-click to close (asks first if it holds a pipeline), `+` or `Ctrl/Cmd+T` for a new one, `Ctrl/Cmd+W` to close, `Ctrl+Tab` to cycle. Up to 12 tabs. Tabs and their state now also survive a visit to the Output page, which previously reset the canvas.
- Natural-language workflow builder: type a request ("convert it to 1NF"), preview the minimal pipeline with its dependencies, then Apply or Apply & Run; one-click Undo. Keywords match first; a bundled all-MiniLM-L6-v2 model (23 MB, runs in-app on WebAssembly) handles paraphrases. Nothing to install and no network use. The installer grows by about 37 MB (model plus WASM runtime); the CSP adds `'wasm-unsafe-eval'`.
- `npm run bench:nl` and a 77-case labelled eval set.
- Command-line mode: `npm run cli -- analyze data/*.csv --out out/ --dialect postgresql --json` runs the same engine as the app.
- Evaluation harness (`npm run bench`): precision/recall/F1 for primary keys, foreign keys and recovered relations on ground-truth schemas, with runtime.
- Normalized data export for multi-file runs: one deduplicated CSV per relation, `INSERT` script in dependency order, and orphan-check queries per foreign key.
- Composite foreign keys and junction (many-to-many) tables are detected; junction tables are noted in the ER diagram and report.
- 1NF moves multi-valued columns into child tables.
- Character-encoding detection for CSV input: UTF-8, UTF-16 (BOM or not) and Windows-1252.
- ESLint with a warning cap that may only go down (`npm run lint`, also in CI).
- Property-based tests (`fast-check`) for lossless decomposition and a differential test of the FD miner against brute force; golden-file tests for ERD and DDL.

### Changed (second round)
- Large files are read completely. FDs are mined on a reservoir sample and every reported FD is validated on all rows; rows that refute a candidate are added to the sample and mining repeats.
- The engine runs in a Web Worker; Cancel terminates it. It falls back to the main thread when needed.
- FD miner uses stripped partitions and skips constant columns in larger determinants.
- Single-file ER diagram and DDL use the shared sized-type inference and collision-free identifiers; single-file outputs run from a step table instead of inline blocks.
- Removed unused dependencies: `uuid`, `@tauri-apps/api`, `@tauri-apps/plugin-opener` (JS side), `@fontsource/dm-sans`, `@fontsource/dm-serif-display`, `autoprefixer`, `postcss`, `tw-animate-css`.
- CSP allows `worker-src 'self' blob:`.
- The logger no longer prints a trailing `undefined`.

### Changed
- One analysis engine. Multi-file runs no longer go to the native Rust engine, which only parsed files and never mined dependencies or normalized. Every file now runs through the same TypeScript routine as a single file and honours the nodes on the canvas.
- Multi-file ER diagram, DDL and report are built from the *normalized* relations, with cross-file foreign keys attached to the relations that hold the columns.
- Only dependencies that hold on every row feed key discovery and the normal forms. Approximate dependencies are still reported but need `acceptApproximateFDs` to be used.
- Missing values are now handled one way in the FD miner: all missing values in a column are one value (`nullSemantics: 'equal'`, default) or all distinct (`'distinct'`). No rows are dropped.
- Primary keys are chosen from candidate keys that are unique and complete; a surrogate `row_id` is added (and materialized) when none exists.
- Foreign keys are found from the data (inclusion dependencies scored by containment, coverage, name and type evidence) instead of requiring `<table>_id` column names; nullable foreign keys are marked optional.
- Column-level atomicity: text containing "and", "&", "+" or parentheses, and name/address columns with commas, are no longer reported as multi-valued.
- Generated DDL infers sized types (`VARCHAR(n)`, `DECIMAL(p,s)`, `BIGINT`, `BOOLEAN`, `TIMESTAMP`), keeps zero-padded digit strings as text, and emits `NOT NULL`/`UNIQUE` from the data. Identifiers that collide after sanitizing get unique names.
- Tables are created parents-first in multi-file DDL.
- Lossless-join reports the chase verdict and a re-join of the projections on the data; the "guaranteed" wording is gone.
- Results are kept in memory with a slimmed copy in `sessionStorage`, so large inputs no longer overflow the storage quota.

### Removed
- Native Rust analysis engine, SQLite history and their dependencies (`sqlx`, `tokio`, `csv`); the Rust side is now just the window shell.
- Unused modules: console, natural-language prompt bar, compatibility checker and its hook, JSON-from-LLM helpers.
- `rehype-raw`: reports embed text from CSV files, so raw HTML in Markdown is no longer rendered.
- `.xlsx` as an accepted file type (there was no spreadsheet parser).

### Security
- Strict Content-Security-Policy for the webview; Mermaid runs with `securityLevel: 'strict'`; Markdown tables and spans escape CSV-derived text.

### Fixed
- Removed the 100-row analysis cap that the UI hook applied to large files; truncation is now reported.
- FD mining can be cancelled and has a 30 s default time budget; a cut-short search is flagged.
- Dependency-preservation lists now use the same projected-closure test as the verdict.
- Notification sound resolved through the bundler instead of a dev-server path.

## [2.6.0] - 2026-08-24

### Added
- Circular icon-only operation rail: every pipeline operation is now a circular logo button grouped by pipeline phase; hovering reveals a slide-out card with the operation name, description and dependency hints (portal-rendered so it never clips).
- Shared visual identity (`operationVisuals`): per-operation lucide icons and phase accent palette (Prepare/teal, Analyze/cyan, Normalize/violet, Generate/amber) used consistently by the rail and the canvas nodes.
- Themed pipeline nodes: phase-colored gradient icon chips, accent side bar, operation descriptions, hover lift and selection glow; Start node features an emerald gradient with a breathing halo.
- Lively gradient pipeline edges: teal→cyan→violet gradient stroke with marching dashes, a travelling pulse dot (`animateMotion`) and glow underlay, per the official React Flow "Animating Edges" and "Turbo Flow" examples.
- React Flow theming via `--xy-*` CSS variables, glossy connection handles, phase-colored minimap nodes and a refined dotted canvas background.
- Auto fit-view framing the full chain after "Synthesize 3NF" builds it.

### Changed
- Operation palette search box and collapse toggles replaced by the compact icon rail (labels are revealed on hover).
- Node spacing increased (220 → 300 px) so pipeline edges are clearly visible between nodes.

### Fixed
- "Synthesize 3NF" built the full pipeline without any edges — the canvas is now properly wired node-to-node (`replaceGraph` derives chain edges when none are supplied).
- React Flow's base stylesheet was never imported, leaving controls/handles/edges unstyled.

## [2.5.0] - 2025-08-24

### Added
- Interactive canvas controls toolbar (`<Controls />`) supporting zoom in, zoom out, fit view, and interactive canvas lock.
- Directional arrow markers (`MarkerType.ArrowClosed`) and custom styling on all React Flow pipeline edges.
- Modern high-density dual-pane workspace architecture with transient toast notifications.

### Changed
- Removed redundant bottom console and natural-language prompt bar to maximize canvas viewport and performance.
- Streamlined toolbar controls for rapid schema synthesis and workflow state management.

## [2.4.0] - 2025-08-24

### Added
- FOSS project infrastructure: MIT `LICENSE`, `CONTRIBUTING.md`, Code of Conduct, security policy, issue/PR templates, CI pipeline and automated multi-platform release builds.
- Fast functional-dependency mining based on partition refinement with lattice pruning (replaces exhaustive pairwise re-validation).
- NLP-based semantic column profiler fusing column-name evidence with value-pattern evidence.
- Manual node creation: operation palette supports click-to-add and drag-and-drop onto the canvas.
- Rust engine: parallel per-file CSV processing, sampled value statistics, data-driven SQL type inference, value-overlap foreign-key verification, configurable Ollama endpoint.
- Unit tests (Vitest + cargo test) and `npm run typecheck` / `npm run test` scripts.

### Fixed
- Entity classifier corrupted table names by stripping every letter "s" instead of only a trailing plural.
- React StrictMode double-invocation caused duplicate nodes/edges when adding operations (side effects moved out of state updaters).
- Ollama chat over Tauri dropped conversation history (only last message was sent).
- LLM responses wrapped in Markdown code fences failed JSON parsing during flow generation.
- 3NF decomposition projected full original rows into decomposed relations instead of the relation's attributes.
- FD mining mutated arrays being iterated (`lhs.sort()` inside combination loop).
- Mermaid ERD emitted invalid trailing spaces after non-PK columns; identifiers are now sanitized.
- Duplicate dependencies removed (`reactflow` v11 alongside `@xyflow/react` v12, `framer-motion` alongside `motion`).

## [2.3.0] - 2025-08-02

### Added
- Multi-CSV pipeline with cross-table relationship detection.
- Rust core engine (`process_multi_csv_rust`) for high-speed parsing and ERD/SQL/report generation.
- Ollama AI analyst integration and natural-language workflow generation.
- Visual workflow canvas (React Flow), undo/redo, workflow save/load.
- Normalization reports, Mermaid ERDs and consolidated SQL DDL outputs.
