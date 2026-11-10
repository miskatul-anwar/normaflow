# Not Done

Work from the [IMPROVEMENTS.md](IMPROVEMENTS.md) audit that is **still open**
after the first round of fixes. Everything not listed here was addressed; see
the status table in `IMPROVEMENTS.md` and the `[Unreleased]` entry in
[CHANGELOG.md](CHANGELOG.md).

Item IDs (P0-6, P1-2, …) refer to sections of `IMPROVEMENTS.md`, which has the
full reasoning and fix steps for each one.

## Not verified

- The built desktop app was **not launched or clicked through** after these
  changes. Typecheck, 430 Vitest tests, `vite build`, `cargo fmt --check`,
  `cargo clippy -D warnings` and `cargo check` pass; manual use of the canvas,
  Output page and ER diagram preview has not been tested.
- The new strict Content-Security-Policy (`src-tauri/tauri.conf.json`) has not
  been exercised in a running Tauri window. If the ER diagram, fonts or sounds
  fail to load, check the CSP first.
- Behaviour on large files (tens of MB, hundreds of thousands of rows) and on
  wide tables (50+ columns) has not been measured.

## Correctness gaps

| ID | What is open | Why it matters |
|---|---|---|
| P0-6 | Files over 10 MB are analysed on a 10 000–50 000 row sample. Candidate FDs found on the sample are **not re-validated on all rows**. The UI warns, but a dependency can still hold on the sample and fail on the full file. | Wrong keys/decompositions on large inputs. Fix: sample for candidate generation, validate every reported FD on all rows (HyFD style), use reservoir sampling instead of "first N rows". |
| P0-3 | The canvas selection is honoured by the shared `analyzeRows` routine, but there is no registry-driven executor. `processFile` still has its own inline output-generation blocks (ERD, relation schemas, SQL, report). | Two code paths to maintain for outputs; adding an operation means editing several places. |
| P0-4 | No property-based test (for example `fast-check`) that random tables with exact FDs always re-join losslessly. | The guarantee is covered by examples only. |
| P0-10 | **Composite foreign keys** are not detected. **Junction tables** (M:N) are drawn as two 1:N links, not recognised as a relationship. | Multi-column keys produce missing links. |
| P0-14 | 1NF only **reports** multi-valued columns. It does not move them into a child table. | A column holding "a, b, c" stays in the schema. |

## Performance and robustness

| ID | What is open |
|---|---|
| P1-1 | The engine still runs on the UI thread. Cancel and a 30 s FD time budget exist, but a long run can freeze the window between checks. Fix: move the engine to a Web Worker and terminate it to cancel. |
| P1-2 | FD mining is not state-of-the-art. Missing: stripped partitions, TANE's C⁺ candidate pruning, a constant/unique column pre-filter, parallel validation, HyFD. LHS size is capped at 4. Only the memory use (previous level only) was improved. |
| P1-4 | Character-encoding and BOM detection for CSV input. Delimiter sniffing and duplicate-header repair already work in the TypeScript parser. |
| P1-5 | The single-file DDL generator (`NormalizationEngine.generateSQLDDL`) still uses the older type rules. Only multi-file output uses the new sized-type inference (`sqlTypes.ts`). |
| P1-9 | Single-file ERD and DDL still sanitize identifiers without de-duplicating (`Order Date` and `Order-Date` can collide). Multi-file output is fixed. |

## Code health

| ID | What is open |
|---|---|
| P2-2 | `databaseService.ts` (~3 200 lines) and `normalizationEngine.ts` (~4 700 lines) are still single files. Planned split by stage (ingest, profile, fd, keys, normalize, relate, emit, pipeline). |
| P2-4 | About 290 uses of `any`, including the result types. Plan: type the pipeline context, add ESLint with `no-explicit-any` as a warning and ratchet it down. |
| P2-5 | The logger prints a trailing `undefined` on every line in test output. Golden-file tests for ERD/DDL are not written. `src/fdMiner.test.ts` and `src/semanticProfiler.test.ts` could move next to their modules. |
| — | Unused dependencies were not audited (`uuid`, `react-icons`, `@tauri-apps/api`, and others). |

## Features not started (P3)

None of the feature proposals in `IMPROVEMENTS.md` were started:

- **P3-1** Human-in-the-loop review of FDs, keys and foreign keys
- **P3-2** Evaluation harness with ground-truth datasets (precision/recall, runtime)
- **P3-3** Interactive ER diagram (React Flow) with editing and more export formats
- **P3-4** Conceptual ER modelling (M:N, weak entities, specialization, participation)
- **P3-5** Optional local-LLM assistance (the README no longer claims it)
- **P3-6** Export normalized data (CSV per relation, populated SQLite, INSERTs)
- **P3-7** Step-by-step explanation of each decomposition
- **P3-8** SQL options in the UI (dialect selector exists in the API but not the UI)
- **P3-9** Command-line mode
- **P3-10** More inputs (Excel, JSON, Parquet, existing databases)
- **P3-11** More dependency types (UCCs, n-ary INDs, MVDs / 4NF)
- **P3-12** Project files and persistent run history
- **P3-13** Data-quality report
- **P3-14** Smaller usability items (larger sample datasets, per-node progress, dark mode)

## Suggested next steps

1. Launch the app (`npm run tauri dev`), run the sample and a two-file example,
   and confirm the Output page, ER preview and downloads work under the new CSP.
2. P0-6: validate mined FDs on all rows for large files.
3. P1-1: move the engine into a Web Worker.
4. P3-2: build the evaluation harness, so later changes are judged by numbers.
5. P3-1: add the review panel for inferred dependencies and keys.
