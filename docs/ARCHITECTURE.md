# NormaFlow Architecture

This document explains how NormaFlow is structured, how data flows through the
system, and where the important algorithms live.

## High-level overview

NormaFlow is a [Tauri 2](https://tauri.app) desktop app: a React/TypeScript UI
running in the OS webview, backed by a Rust core process. The two halves talk
over Tauri's typed IPC bridge (`invoke`).

```
┌──────────────────────────── WebView (frontend) ────────────────────────────┐
│                                                                            │
│  App.tsx (Workspace)                                                       │
│  ├── OperationPalette   manual node creation (click + drag-and-drop)       │
│  ├── FlowCanvas         React Flow canvas rendering the pipeline           │
│  ├── AskAI              natural-language pipeline authoring                │
│  └── Console            live logs, validation, progress                    │
│                                                                            │
│  Hooks                                                                     │
│  ├── useWorkflowGraph     node/edge state, undo/redo, snapshots            │
│  ├── useOllamaConnection  model discovery + selection                      │
│  └── useNormalization     pipeline execution lifecycle                     │
│                                                                            │
│  Services                                                                  │
│  ├── databaseService      orchestrates the full pipeline                   │
│  ├── fdMiner              partition-refinement FD mining (TANE-style)      │
│  ├── normalizationEngine  keys · closures · 1NF/2NF/3NF synthesis          │
│  ├── semanticProfiler     NLP column classification                        │
│  └── relationDetector     cross-table FK detection + LLM enrichment        │
└──────────────┬─────────────────────────────────────────────────────────────┘
               │ invoke()                                        ▲
┌──────────────▼─────────────────────────────────────────────────────────────┐
│ Rust core (src-tauri)                                                      │
│  ├── engine::csv    single-pass parsing with per-column statistics         │
│  │                  (parallel per file via worker threads)                 │
│  ├── ner            semantic classification (name × value evidence fusion) │
│  ├── engine::fk     FK detection: name heuristics verified by sampled      │
│  │                  value containment; orientation-aware                   │
│  ├── engine::erd    Mermaid ERD generation (sanitized identifiers)         │
│  ├── engine::sql    DDL generation with inferred types                     │
│  ├── ollama         local-LLM client (OLLAMA_HOST configurable)            │
│  └── db             SQLite pipeline history (in-memory)                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## The processing pipeline

Regardless of entry point (manual graph, Run All, or AI-generated), a run:

1. **Ingest** — each CSV is parsed in one streaming pass. Per column we count
   filled/null values, integer/numeric/date evidence, track distinct values
   (bounded at 4096) and retain up to 24 sample values. Files are parsed on
   parallel worker threads.
2. **Classify** — every column gets an `EntityTag` (e.g. `EMAIL`,
   `CURRENCY_PRICE`, `PRIMARY_KEY_ID`) from fusing two evidence channels:
   - *Name channel*: tokenization + synonym gazetteer (`semanticProfiler` / `ner.rs`).
   - *Value channel*: regex/structural analysis of samples plus cardinality shape.
   
   Corroborating signals boost confidence; conflicting signals resolve toward
   the stronger channel under an explicit override matrix so that, e.g.,
   numeric-looking id columns stay classified as ids.
3. **Relate** — cross-table FK candidates are found by naming conventions
   (`customer_id` → `customers`) then *verified* by directed value containment
   over samples (≥ 0.5). Orientation (which side references which) is resolved
   by comparing name scores both ways and value containment when tied.
4. **Mine FDs** — exact + high-confidence approximate functional dependencies
   via lattice-based partition refinement (`fdMiner.ts`; the TS fallback).
5. **Keys** — candidate keys are computed by attribute-closure search over the
   mined FDs; minimal superkeys are candidate keys.
6. **Normalize** — 1NF atomicity enforcement, 2NF partial-dependency removal,
   3NF Bernstein-style synthesis with lossless-join verification and residual
   relations so no attribute is dropped.
7. **Generate** — Mermaid ERD (identifiers sanitized), consolidated SQL DDL
   (types inferred from data), Markdown report.

### Which engine runs?

`databaseService.processFiles` prefers the **Rust engine** whenever the app
runs inside Tauri (multi-file runs). Single files and non-Tauri environments
use the TypeScript path. Both produce the same result envelope
(`ProcessingResult`), so the UI is engine-agnostic.

## Why the FD miner is fast

The original implementation validated every `(LHS, RHS)` pair by re-scanning
all rows with fresh string-keyed Maps — `O(combos × rows)` with brutal
constants. The current miner:

1. Integer-encodes every column once (string interning).
2. Computes row partitions per attribute, then refines partitions along the
   LHS lattice, reusing each parent's partition.
3. `X → Y` holds exactly when refining π(X) with Y creates no extra classes;
   violation counts fall out of the refinement, enabling cheap approximate FDs.
4. Prunes supersets of keys and non-minimal determinants.

On a 2000-row × 6-column table this completes in tens of milliseconds versus
seconds previously, and scales near-linearly with rows.

## Workflow graphs

The canvas state (nodes = operations, edges = sequential chain or manual
connections) lives in `useWorkflowGraph`. Design invariants:

- State updaters are pure; all logging/id bookkeeping happens outside them
  (React StrictMode double-invokes render-phase functions, and the previous
  implementation duplicated nodes because of this).
- Snapshots are versioned JSON (`format: "normaflow-workflow"`, `version: 2`);
  the legacy magic-key format is still loadable.
- New operations must be registered in `src/config/operations.ts`, which is
  the single source of truth for phases, dependencies and ordering.

## Ollama integration

- Endpoint defaults to `http://localhost:11434`; override via the `OLLAMA_HOST`
  env var (Rust) or `VITE_OLLAMA_HOST` (browser dev).
- All requests carry connect/timeouts; failures degrade gracefully — the app
  falls back to the deterministic rule engine.
- Structured prompts (flow generation, schema insights) are recovered with a
  string-aware balanced-bracket extractor (`jsonUtils.ts` / `ollama.rs`),
  tolerating code fences, prose and `<think>` reasoning blocks.
- Model outputs are validated against the operation allow-list before reaching
  the workflow graph.

## Testing strategy

| Layer | Tool | Location |
|---|---|---|
| Rust units (parser, NER, FK, ERD, SQL, ollama utils) | `cargo test` | `#[cfg(test)]` modules |
| TS algorithms (FD mining, profiler, JSON utils) | Vitest | `src/*.test.ts` |
| Types | `tsc -b` strict | CI |

CI (`.github/workflows/ci.yml`) runs typecheck → vitest → vite build for the
frontend and fmt → clippy `-D warnings` → cargo test for Rust on every PR.

## Release engineering

Tag-driven: pushing `vX.Y.Z` triggers `.github/workflows/release.yml`, which
builds installers (MSI, DMG x2 arches, deb/rpm/AppImage) via `tauri-action`
and publishes them on a GitHub Release. See `docs/RELEASING.md`.
