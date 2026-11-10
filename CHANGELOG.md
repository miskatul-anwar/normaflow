# Changelog

All notable changes to NormaFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- App icon: the source image had a 1 px semi-transparent grey line down its left edge, which was carried into every generated size (taskbar, dock, installer). The edge is cleared and the whole set regenerated with `tauri icon`; `bundle.icon` now lists the files the Tauri docs recommend (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` with the 32 px layer first) instead of `logo.ico` and a `.webp`.
- The upload button no longer shows a `1` badge before any upload: the preloaded sample dataset is not counted, and the button's tooltip says when the sample is in use. The count is now exactly the files you uploaded.

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
