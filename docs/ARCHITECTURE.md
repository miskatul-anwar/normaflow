# NormaFlow Architecture

How NormaFlow is structured, how data flows through it, and where the
important algorithms live.

## Overview

NormaFlow is a [Tauri 2](https://tauri.app) desktop app. All analysis runs in
TypeScript inside the webview; the Rust side only hosts the window. One
engine therefore serves the installed app and `npm run dev` in a browser, and
every result is the same regardless of file count or runtime.

```
┌──────────────────────────── WebView (frontend) ────────────────────────────┐
│  App.tsx (Workspace)                                                       │
│  ├── OperationPalette   add pipeline nodes (click or drag)                 │
│  ├── FlowCanvas         React Flow canvas rendering the pipeline           │
│  └── OutputPage         ERD, SQL, FDs, keys, normal forms, report          │
│                                                                            │
│  Hooks:     useWorkflowGraph (nodes, edges, undo/redo)                     │
│             useNormalization (run lifecycle)                               │
│                                                                            │
│  Engine (src/services):                                                    │
│    api/databaseService      orchestration: analyzeRows, processFile(s)     │
│    processors/fdMiner       partition-refinement FD mining                 │
│    processors/keySelection  primary-key choice, surrogate keys             │
│    processors/normalizationEngine   keys, closure, 2NF/3NF/BCNF, chase     │
│    processors/instanceVerification  lossless check on the data             │
│    processors/foreignKeyDetector    cross-file FKs from inclusion deps     │
│    processors/schemaGraph   merge per-file results, ERD, DDL input         │
│    nlp/semanticProfiler     column classification                          │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │ window only
┌──────────────────────────────────▼─────────────────────────────────────────┐
│ Rust shell (src-tauri): Tauri window, opener plugin, CSP                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## The processing pipeline

The canvas selects which operations run. `DatabaseService.analyzeRows`
executes them for one table; `processFile` and `processFiles` call it for one
file or for every file.

1. **Ingest** — `CSVProcessor` parses each file (delimiter sniffing, quoted
   fields, duplicate header repair; large files stream).
2. **Clean / profile** — empty and null-like cells are normalized; column
   types and multi-valued columns are reported. A column counts as
   multi-valued only if a large share of its cells are lists of short items
   and it is not free text.
3. **Classify** — each column gets an entity tag (e-mail, price, id, …) from
   column-name and value evidence.
4. **Mine FDs** — lattice search with partition refinement. Missing values are
   one value (`nullSemantics: 'equal'`, default) or all distinct. Exact and
   approximate dependencies are returned; **only exact ones** feed keys and
   normal forms unless `acceptApproximateFDs` is set. A time budget and an
   abort signal stop long searches and flag the result as truncated.
5. **Keys** — candidate keys by attribute closure; `chooseKey` picks one that
   is unique and has no missing cells, preferring identifier-like single
   columns, and adds a `row_id` surrogate when none exists.
6. **Normalize** — 1NF (non-destructive), 2NF, Bernstein 3NF synthesis, BCNF
   decomposition.
7. **Verify** — chase (lossless with respect to the FDs), re-join of the
   projections on the data (lossless on this data), and dependency
   preservation by projected closure. The report shows both lossless verdicts.
8. **Relate (multi-file)** — foreign keys are inclusion dependencies scored by
   containment, coverage, name similarity and type; accidental containment
   between dense id sequences is rejected; nullable foreign keys are marked
   optional.
9. **Assemble** — `buildSchema` gives every normalized relation a unique name,
   keeps the key chosen for each file on the relation that holds it, and
   attaches each cross-file foreign key to the relations that actually contain
   the columns.
10. **Emit** — Mermaid ER diagram, DDL (PostgreSQL, MySQL, SQLite or ANSI) with
    inferred sized types, `NOT NULL` and `UNIQUE`, tables ordered parents
    first, and a Markdown report. Text from the input files is escaped.

## Why the FD miner is fast enough

Columns are integer-encoded once. Partitions are refined along the LHS
lattice, reusing the parent's partition, and only the previous level is kept
in memory. `X → Y` holds exactly when refining π(X) with Y creates no new
classes; violation counts fall out of the same step, giving approximate FDs.
Supersets of keys and non-minimal determinants are pruned. Limits: LHS size is
capped (default 4) and the search stops at the time budget; both are reported.

## Natural-language workflow builder

```
NLCommandBar → useNLWorkflow → resolver (keywords, then embeddings) → planner → useWorkflowGraph
                                   └ EmbeddingProvider: bundled MiniLM in a Web Worker (ONNX/WASM) | none
```

- `src/services/nlp/workflow/` is pure TypeScript with no React: `planner.ts` (dependency closure of the requested operations, sorted by `order`), `anchors.ts` (aliases and example phrases per operation), `lexicalResolver.ts` (clauses, negation, options), `resolver.ts` (hybrid), `anchorIndex.ts` (embeds anchors once, caches in memory and IndexedDB keyed by model, framing and anchor hash), `ollamaProvider.ts`.
- `src/config/operations.ts` stays the only definition of operations and dependencies; a test fails if an operation has no anchors.
- The plan is previewed as chips (dimmed = added as a dependency). Apply replaces or extends the canvas; the toast Undo restores the previous snapshot in one step.
- The model (`public/models`, 23 MB, sha256-checked) and the ONNX WebAssembly runtime (`public/ort`, copied from `onnxruntime-web` by `scripts/prepare-nl-assets.mjs` before `dev`/`build`) ship inside the installer. `embed.worker.ts` loads them with remote loading disabled. The CSP gains only `'wasm-unsafe-eval'` (WebAssembly compilation, not JavaScript `eval`).
- Pitfall worth knowing: transformers.js only looks for local tokenizer files when `localModelPath` is a path rather than an http(s) URL, so the worker passes `/models/`.

## Workspace tabs

`AppShell` (`src/App.tsx`) hosts one `Workspace` per tab, each inside its own `ReactFlowProvider`. Inactive tabs, and all tabs while the Output page is open, stay mounted but hidden, so graphs, files, results and running jobs survive. State is per tab: the graph hook, uploaded files, result cache (`resultCache.ts`, keyed by tab id) and the engine worker for each run. The embedding worker is shared by all tabs (one copy of the model in memory). Anything DOM-global must be namespaced per tab: React Flow gets `id={tabId}` (marker ids), the edge gradient id and the NL input id include the tab id, and keyboard shortcuts only act in the active tab. Tab state is in `useWorkspaceTabs`; it is not persisted across launches.

## Workflow graphs

Canvas state (nodes = operations, edges = chain or manual connections) lives
in `useWorkflowGraph`.

- State updaters are pure; logging and id bookkeeping happen outside them
  (React StrictMode double-invokes render-phase functions).
- Snapshots are versioned JSON (`format: "normaflow-workflow"`, `version: 2`);
  the legacy format still loads.
- Operations are registered in `src/config/operations.ts`, the single source
  of truth for phases, dependencies and ordering.

## Security notes

- Untrusted text (headers, cell values) reaches Markdown and Mermaid. Raw HTML
  in Markdown is not rendered, table/span text is escaped, Mermaid runs with
  `securityLevel: 'strict'`, and the webview has a strict
  Content-Security-Policy (`src-tauri/tauri.conf.json`).
- No network requests are made. The natural-language box uses a model bundled with the app; there is no server and no download.

## Testing

| Layer | Tool | Location |
|---|---|---|
| Algorithms (FD mining, keys, normal forms, chase, FK detection, SQL types) | Vitest | `src/**/*.test.ts`, `src/tests/` |
| End-to-end pipelines (single and multi-file) | Vitest | `src/tests/pipelineSoundness.test.ts`, `e2ePlatformIntegration.test.ts` |
| Types | `tsc` strict | CI |
| Rust shell | `cargo check` / `clippy` | CI |

CI (`.github/workflows/ci.yml`) runs typecheck → tests → build for the
frontend, and fmt → clippy → test for Rust on Linux, Windows and macOS.

## Release engineering

Tag-driven: pushing `vX.Y.Z` triggers `.github/workflows/release.yml`, which
builds installers (MSI, DMG x2 arches, deb/rpm/AppImage) via `tauri-action`
and publishes a GitHub Release. See `docs/RELEASING.md`.
