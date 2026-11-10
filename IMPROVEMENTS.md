# NormaFlow — Fixes and Improvements

A code audit of NormaFlow at commit `994bb7e` (v2.6.0), written as a work list.
Every issue names the file and line where it lives, explains why it matters,
and gives concrete steps to fix it. New feature proposals follow the fixes.

**Baseline when this was written:** `npx tsc --noEmit` is clean and
`npx vitest --run` passes 415 tests in 20 files. `cargo test` was not run.
The suite is green, yet most issues below are real: the tests exercise the
algorithms in isolation, not the paths the desktop app actually takes.

Line numbers will drift as the code changes; the function names are the
stable reference.

## Resolution status

The sections below are the original findings. This table records what has
since been done (all changes are uncommitted in the working tree). After the
changes: `tsc` clean, 430 Vitest tests pass, `vite build` succeeds, and
`cargo fmt --check`, `cargo clippy -D warnings` and `cargo check` pass on the
(now minimal) Rust shell. The built desktop app was not launched or clicked
through.

| ID | Status | What changed / what is left |
|---|---|---|
| P0-1 | Done | One TypeScript engine; the Rust analysis engine was deleted. Multi-file runs mine FDs, find keys and normalize. |
| P0-2 | Done | `schemaGraph.ts` builds the ERD, DDL and report from the normalized relations with cross-file FKs on the relations that hold the columns. The conceptual (M:N, weak entity) view is still P3-4. |
| P0-3 | Partly | `analyzeRows` is shared by single and multi-file runs and honours the selected nodes. A registry-driven executor and removal of the output blocks inside `processFile` are not done. |
| P0-4 | Done | Only exact FDs feed keys and normal forms (`acceptApproximateFDs` opts in); the report shows the chase verdict and a re-join on the data. Not done: a `fast-check` property test. |
| P0-5 | Done | `nullSemantics: 'equal' \| 'distinct'`; no rows are dropped; missing = null, undefined or blank. |
| P0-6 | Partly | The 100-row cap and dead `timeout` are gone; FD search has a 30 s budget and reports truncation. Files over 10 MB are still analysed on 10 000–50 000 rows (with a warning); candidate FDs are not re-validated on all rows. |
| P0-7 | Done | The sampling FK code was deleted with the Rust engine; the TypeScript detector uses complete distinct-value sets. |
| P0-8 | Done | `chooseKey`: unique and complete columns only, identifier-looking names first. |
| P0-9 | Done | A surrogate `row_id` is materialized (rows, attributes, FDs) when no usable key exists. |
| P0-10 | Mostly | Inclusion dependencies scored on containment, coverage, name and type; dense-id false positives rejected; nullable FKs marked. Open: composite FKs, junction-table M:N detection. |
| P0-11 | Done | `.xlsx` no longer accepted. Real support is P3-10. |
| P0-12 | Done | LLM claims removed from the docs. Rebuilding the feature is P3-5. |
| P0-13 | Done | NER and Relation Detector run in the shared routine / multi-file pipeline. |
| P0-14 | Partly | Column-level multi-valued detection (no more flags for "and", "&", "+", brackets, name/address commas). 1NF is still non-destructive: it reports, it does not split into a child table. |
| P0-15 | Done | The per-FD lists and the verdict now come from the same projected-closure test. |
| P1-1 | Partly | Cancellation and the time budget reach the FD miner. Not done: moving the engine into a Web Worker. |
| P1-2 | Partly | Only the previous lattice level is kept in memory. Not done: stripped partitions, C⁺ pruning, constant/unique column pre-filter, HyFD. |
| P1-3 | N/A | The IPC string copy disappeared with the Rust engine. Path-based loading is not needed until files exceed webview memory. |
| P1-4 | Partly | The Rust reader is gone. The TypeScript parser sniffs delimiters and repairs duplicate headers; encoding/BOM detection is open. |
| P1-5 | Partly | One inference spec (`sqlTypes.ts`) drives multi-file DDL and the ERD. The single-file DDL generator still uses the older rules. |
| P1-6 | Done | SQLite history removed (it was never used and `:memory:` with a pool could not work). A History panel is P3-12. |
| P1-7 | Done | Strict CSP, `rehype-raw` removed, Mermaid `securityLevel: 'strict'`, escaped Markdown. |
| P1-8 | Done | Results live in memory; `sessionStorage` holds a row-capped copy and failures are handled. |
| P1-9 | Partly | `IdentifierRegistry` is used by multi-file ERD and DDL. The single-file generators still sanitize without de-duplicating. |
| P2-1 | Done | TypeScript is the single engine (decision recorded in `docs/ARCHITECTURE.md`). |
| P2-2 | Open | `databaseService.ts` and `normalizationEngine.ts` are still very large. |
| P2-3 | Done | Deleted: Console, AskAI, consoleCommands, CompatibilityChecker, useOperationValidation, outputDataValidator, jsonUtils, aiFlowGenerator, OperationDependencies. |
| P2-4 | Open | `any` still pervades the engine and IPC-free result types. |
| P2-5 | Partly | New suites: `pipelineSoundness`, `atomicityColumns`, null-semantics and abort tests. CI Rust job now runs on Linux, Windows and macOS. Note: `src/fdMiner.test.ts` is **not** a duplicate of the one in `services/processors/`; both stay. The logger's trailing `undefined` in test output is still there. |
| P2-6 | Done | `target/` untracked, notes moved to `docs/notes/`, badge and docs corrected. The `.mmd`/`.mermaid` mismatch is gone with the Rust engine. |
| P3-* | Open | All feature proposals. |
## Contents

- [Priority legend](#priority-legend)
- [P0 — Wrong results and false claims](#p0--wrong-results-and-false-claims)
- [P1 — Robustness, scale and security](#p1--robustness-scale-and-security)
- [P2 — Code health](#p2--code-health)
- [P3 — New features](#p3--new-features)
- [Suggested order of work](#suggested-order-of-work)

## Priority legend

| Level | Meaning |
|---|---|
| **P0** | The app produces a wrong or missing result, or the docs claim something the code does not do. Fix before any release or paper submission. |
| **P1** | Works on small clean inputs, fails or degrades on realistic ones. |
| **P2** | Maintainability. Not user-visible, but slows every other fix. |
| **P3** | New capability. |

---

## P0 — Wrong results and false claims

### P0-1. Multi-file runs skip FD mining and normalization in the desktop app

**Where:** `src/services/api/databaseService.ts:3190` (`processFiles`),
`src-tauri/src/engine/mod.rs:30` (`process_files`), `src-tauri/src/lib.rs:49`.

**Problem.** When the app runs inside Tauri and more than one file is loaded,
`processFiles` hands everything to the Rust command `process_multi_csv_rust`
and returns its result. The Rust engine only parses, tags columns, detects
foreign keys and emits artifacts. The returned tables have
`functionalDependencies: []`, `candidateKeys: []` and empty normal forms
(lines 3231–3236), and `rows: []`, so the Output page has nothing to show for
FDs, keys or normal forms. The TypeScript path that does normalize is only
reached in a browser or when the Rust call throws.

This is the headline scenario (a set of CSVs to an ERD), and it is the one
path where normalization never happens.

**Fix (recommended: make TypeScript the single analysis engine for now).**

1. In `processFiles`, delete the early `return` of the Rust result. Keep the
   Rust call only if you use it for fast parsing (see step 3).
2. Let every file go through the same per-table pipeline the single-file path
   uses, then run cross-table steps once (see P0-2 for the merged output).
3. Optional: add a Rust command `parse_csv(path) -> { headers, rows, profile }`
   and call it from the loader step, so Rust does I/O and TypeScript does
   analysis. Do not have two engines that each implement half of the pipeline.
4. Add a test that calls `processFiles` with two files and a mocked
   `__TAURI_INTERNALS__` and asserts that `functionalDependencies` and
   `thirdNormalForm` are non-empty.

**Alternative.** Port FD mining, key discovery and normalization to Rust and
retire the TypeScript engine. This is the better end state (see P2-1) but is
weeks of work; do the recommended fix first.

**Done when:** loading `customers.csv` + `orders.csv` in the built app shows
FDs, keys and normalized relations per file, plus cross-file foreign keys.

### P0-2. Multi-table output ignores the normalization it just computed

**Where:** `src/services/api/databaseService.ts:3368–3399`.

**Problem.** Even on the TypeScript multi-file path, the ERD and SQL are
built from each file's *original* headers, not from the decomposed relations:

- ERD entities list `t.headers`, each typed `string` (line 3374).
- SQL DDL uses `attributes: t.headers` (line 3388).
- `res2NF`, `res3NF`, `resBCNF` are computed and stored on the table object
  but never reach the diagram or the DDL.
- The `N:M` symbol `'}}--{{'` (line 3380) is not valid Mermaid; the diagram
  fails to render if that branch is ever hit.
- Primary key falls back to `headers[0]` when key discovery returns nothing
  (line 3303).

**Fix.** Introduce one `SchemaGraph` type and one emitter used by both paths.

1. Define in `src/types/index.ts`:
   ```ts
   interface SchemaGraph {
     relations: RelationSchema[];           // normalized, globally unique names
     foreignKeys: ForeignKeyEdge[];         // intra-file and cross-file
   }
   interface ForeignKeyEdge {
     from: { relation: string; columns: string[] };
     to:   { relation: string; columns: string[] };
     cardinality: '1:1' | '1:N' | 'N:M';
     optional: boolean;                     // nullable FK
     evidence: { containment: number; nameScore: number; source: 'fd' | 'ind' };
   }
   ```
2. For each file, run the per-table pipeline and prefix relation names with
   the table name to keep them unique (`orders__customer`).
3. Intra-file edges come from `establishForeignKeys` on the decomposition.
4. Cross-file edges: detect on original columns, then remap each endpoint to
   the normalized relation in which that column is the key (referenced side)
   or simply present (referencing side).
5. Detect duplicates across files: if two files each produce a relation with
   the same key and compatible attributes (e.g. both contain customer data),
   offer to merge them. Start with a warning; merging can come later.
6. Feed the `SchemaGraph` to `NormalizationEngine.generateERD` and
   `DatabaseService.generateDDL`. Delete the inline string builders at
   3368–3399 and the Rust `erd.rs` / `sql.rs` duplicates once P2-1 is decided.
7. Use the Mermaid cardinality tokens `||--||`, `||--o{`, `}o--o{`.

**Done when:** a denormalized `orders.csv` plus a `customers.csv` produce an
ERD whose entities are the normalized relations, with typed attributes.

### P0-3. The pipeline graph is ignored on multi-file runs

**Where:** `databaseService.ts:3284–3341` (always runs clean → FDs → keys →
1NF → 2NF → 3NF), `lib.rs:51` (`_selected_operations` is unused).

**Problem.** The canvas is the product's main idea, but with more than one
file the selected operations have no effect, apart from a single `BCNF`
check. A user who removes "3NF" still gets 3NF.

**Fix.** Replace the two hand-written procedures (`processFile` is ~630 lines
of `if (selectedOperations.includes(...))`) with a registry-driven executor:

1. Extend `OperationDefinition` in `src/config/operations.ts` with
   `scope: 'table' | 'schema'` and `run(ctx): Promise<void>`.
2. `ctx` holds typed slots: `rows`, `profile`, `fds`, `keys`, `relations`,
   `schemaGraph`, `artifacts`. Each operation reads and writes slots.
3. Executor: topologically sort selected operations by `dependencies`, run
   `table`-scoped ones per file, then `schema`-scoped ones once.
4. Single-file is then just the N = 1 case. Delete `processFile`.

**Done when:** removing a node from the canvas changes the output in both
single-file and multi-file runs, and one test proves it for each.

### P0-4. Approximate FDs are treated as exact, so decompositions can be lossy

**Where:** `normalizationEngine.ts:304–307` (`minConfidence: 0.85`),
`normalizationEngine.ts:738–745` (`computeCanonicalCover` stamps
`confidence: 1.0`), `findCandidateKeys` (no confidence filter),
`synthesize3NF:1666` (`confidence: 1.0`).

**Problem.** The miner returns any dependency that holds on 85% of rows. Key
discovery, the canonical cover, 2NF, 3NF and BCNF then treat all of them as
true. Consequences:

- A "candidate key" may have duplicate values in the data.
- Projecting onto the synthesized relations and joining back does not
  reproduce the input, yet the log prints `LOSSLESS JOIN GUARANTEED`.
- The chase check passes, because it verifies losslessness *with respect to
  the FD set*, and the FD set is wrong.
- Reports show `confidence: 1.0` for dependencies that were 0.87.

This is the most serious soundness issue for a paper that calls the
algorithms sound.

**Fix.**

1. Split the miner result: `exact` (`violations === 0`) and `approximate`.
2. Use only `exact` for keys, canonical cover and every normal form.
3. Show approximate FDs in the UI as *suggestions* with their violating rows.
   If the user accepts one, record that decision and list the violating rows
   in the report as data-quality exceptions.
4. Carry real confidence through `computeCanonicalCover` (minimum of the FDs
   used to derive each cover element) instead of writing `1.0`.
5. Add an instance-level check next to the chase: project the data onto each
   relation, natural-join the projections, and compare the row multiset with
   the deduplicated input. Report both verdicts separately:
   "lossless w.r.t. FDs" and "lossless on this data".
6. Remove `GUARANTEED` from log messages; print the verdict after checking.
7. Add a property test with `fast-check`: generate random small tables, run
   the pipeline with exact FDs, assert the instance-level check passes.

**Done when:** the property test passes and a table with one dirty row no
longer changes the schema silently.

### P0-5. Empty values and nulls are handled inconsistently in FD mining

**Where:** `dataUtils.ts:233` (`cleanValue` returns `''` for null-like
values), `fdMiner.ts:48–80` (only `null`/`undefined` become code `-1`),
`fdMiner.ts:227` and `:262`.

**Problem.** The miner's comment says empty values are treated as unknown,
like SQL NULL. But the cleaner has already turned every null into the empty
string, which the miner encodes as an ordinary value. So after "Data
Cleaner", all empties in a column are equal to each other; without it, they
are skipped. The same file gives different FDs depending on whether the
cleaner node is present.

When nulls *are* skipped, other formulas break: `isSuperkey` compares the
class count to the total row count (never equal if any row was skipped), and
approximate confidence divides by total rows, not rows considered.

**Fix.**

1. Normalize once, at ingest: empty and null-like strings become `null`.
   `cleanValue` should return `null`, not `''`.
2. Add a miner option `nullSemantics: 'null-equals-null' | 'null-not-equals-null'`
   (the two standard choices in the FD literature). Default to
   `null-equals-null`, which is what Metanome uses by default, and state the
   choice in the report.
3. Under either option, no row is ever dropped from a partition; a null is
   either one shared code or a unique code per row. Then `rowCount` is the
   right denominator everywhere.
4. Tests: a column with 30% nulls under both semantics, checked against
   hand-computed FDs.

### P0-6. Large files are silently analysed on the first 100 rows

**Where:** `src/hooks/useNormalization.ts:33`
(`{ maxLhsSize: 4, maxSampleSize: 100, timeout: 45000 }`),
`databaseService.ts:989–997`.

**Problem.** For files over 10 MB, `processCSVWithStreaming` stops after
`maxSampleSize` rows, and the hook sets that to 100. FDs mined from 100 rows
of a large file are mostly coincidences. Nothing tells the user. The
`timeout` option is never read anywhere.

**Fix.**

1. Remove `maxSampleSize: 100` from the hook. Default to all rows.
2. If sampling is needed for speed, sample for *candidate generation* only
   and validate every candidate FD against the full data (this is what HyFD
   does). Never report an FD that was not checked on all rows.
3. Use reservoir sampling, not "first N rows"; sorted files make the first N
   rows unrepresentative.
4. Show "analysed N of M rows" in the console and report whenever N < M.
5. Implement `timeout` (see P1-1) or delete the option.

### P0-7. Rust foreign-key verification compares two 24-value samples

**Where:** `src-tauri/src/engine/csv.rs:111–119` and `:157`
(`value_samples: sample_order`), `src-tauri/src/ner.rs:7`
(`SAMPLE_LIMIT = 24`), `src-tauri/src/engine/fk.rs:51`.

**Problem.** `containment()` intersects the first 24 distinct values of the
referencing column with the first 24 distinct values of the referenced
column. For any table with more than a few dozen keys this overlap is close
to random, so true foreign keys are rejected (`< 0.5`) and the result
depends on row order.

There is also a bug in the cap at lines 112–118: both branches call
`set.insert`, so `MAX_DISTINCT_TRACKED` does not bound memory, and
`distinct_estimate` is clamped to 4096 afterwards, which under-reports
cardinality for larger columns.

**Fix.**

1. Separate the two uses: keep 24 samples for NER; keep a dedicated value
   set per column for FK checks.
2. For FK checks store the full distinct set when it is small (say up to
   200k values), and a 64-bit hash set beyond that. Containment needs every
   referencing value tested against the complete referenced set.
3. Track exact distinct counts up to the cap and a HyperLogLog estimate
   beyond it; record which one was used.
4. Fix the `if/else` so values past the cap are not stored as strings.
5. Test: 10 000 customers, 50 000 orders in shuffled order must yield the FK.

### P0-8. Primary key is assumed to be the first column

**Where:** `src-tauri/src/engine/csv.rs:126`, `databaseService.ts:3303` and
`:688` (`attributes[0] || 'id'`).

**Problem.** The Rust engine always declares column 0 the primary key, with
no uniqueness check. The generated DDL then has a `PRIMARY KEY` that the data
violates.

**Fix.** Choose the key in this order, and record which rule fired:

1. Single column that is unique and non-null, preferring columns tagged
   `PRIMARY_KEY_ID` by the classifier, then shortest name ending in `id`.
2. Smallest candidate key from key discovery (composite).
3. Otherwise add a surrogate key and say so in the report.

### P0-9. The synthetic key names a column that does not exist

**Where:** `databaseService.ts:584–589`.

**Problem.** When no key is found, the key is set to `['synthetic_id']`, but
no such column is added to the rows or attributes. Later steps then build
relations and DDL that reference a missing attribute. (In practice
`findCandidateKeys` falls back to "all attributes", so this branch is rarely
hit, but it is wrong when it is.)

**Fix.** Either materialize the column (`row.synthetic_id = index + 1`, add
to `attributes`, mark as surrogate in metadata) or remove the branch and rely
on the all-attributes key.

### P0-10. Foreign-key detection only finds conventionally named columns

**Where:** `src-tauri/src/engine/fk.rs:18–47`,
`src/services/processors/relationDetector.ts:69–75`.

**Problem.** A column pair is considered only if names match patterns such
as `customer_id` → `customers`. Consequences:

- `buyer`, `cust_no`, `CustomerID` (camel case), or any non-English naming
  yields no relationship at all.
- No composite foreign keys.
- The referenced column is never required to be unique.
- Cardinality is only `1:1` or `1:N`; `N:M` is never produced.
- The 0.5 containment threshold accepts pairs where half the values dangle.
- The two implementations disagree (the TS one knows fewer patterns).

**Fix (data first, names as a feature).**

1. Candidate generation by inclusion dependency: for every pair of columns
   with the same inferred type, where the referenced column is unique (or
   nearly), compute containment of referencing in referenced. Prune pairs
   early by min/max range and distinct count (referencing ≤ referenced).
2. Score candidates with several features, following Rostin et al. (WebDB
   2009): containment, coverage of the referenced key, name similarity
   (tokenized, case-insensitive, Jaro-Winkler), type equality, whether the
   referencing column is itself a key (then 1:1), value-length similarity.
   Start with a weighted sum; a small classifier can come later.
3. Reject candidates between two auto-increment-like columns (`1..n` contains
   `1..m` by accident) unless names agree. This is the classic false positive.
4. Keep at most one target per referencing column (highest score), and make
   the global graph acyclic where scores are close (Auto-BI's observation).
5. Composite FKs: test column pairs only against composite candidate keys
   already discovered in the other table.
6. `N:M`: mark a relation as a junction when its key is composed of two or
   more foreign keys; render the two sides as `N:M` in the conceptual view.
7. Optionality: nullable referencing column → `o` in the Mermaid token.
8. Raise the acceptance threshold to about 0.95 and report dangling values.

### P0-11. `.xlsx` files are accepted but cannot be read

**Where:** `src/App.tsx:80`, `src/components/heading.tsx:125`
(`accept=".csv,.xlsx"`). There is no spreadsheet library in `package.json`.

**Problem.** An `.xlsx` file passes the filter and is then parsed as CSV
text. It is a zip archive, so the result is garbage or an error.

**Fix.** Either remove `.xlsx` from both places today, or implement it:
`calamine` on the Rust side (preferred, no JS bundle cost) or SheetJS in the
webview; treat each sheet as one table named `file__sheet`.

### P0-12. The LLM features in the README do not exist

**Where:** `README.md:35`, `:41`, `:45`, `:84–92`; `docs/ARCHITECTURE.md`
("Ollama integration", `useOllamaConnection`, `ollama.rs`).

**Problem.** There is no Ollama code in the repository. "Ask AI" is keyword
matching in `src/utils/aiFlowGenerator.ts`, and the `AskAI` component in
`src/components/Input.tsx` is not mounted anywhere.

**Fix.** Until the feature is rebuilt (see [P3-5](#p3-5-optional-local-llm-assistance)),
remove these claims from the README and ARCHITECTURE, and rename the
rule-based generator honestly ("quick pipeline presets").

### P0-13. NER Classifier and Relation Detector nodes do nothing for one file

**Where:** `databaseService.ts:348–982` — `processFile` has no branch for
`'NER Classifier'` or `'Relation Detector'`.

**Problem.** Both nodes can be placed on the canvas and "run" successfully,
but for a single file they are silent no-ops.

**Fix.** Solved by the executor in P0-3. Until then, call
`RelationDetectorService.performNER` in `processFile` and show the tags; for
Relation Detector on one file, report the intra-file foreign keys from the
decomposition.

### P0-14. 1NF is a no-op and atomicity detection is unreliable

**Where:** `normalizationEngine.ts:1253–1306` (default branch copies rows),
`dataUtils.ts:252–266`, `dataProcessor.ts:49`,
`normalizationEngine.ts:1311`.

**Problem.**

- The "1NF" node never changes the data: unnesting only happens if a caller
  passes `mode` and `multiValuedColumns`, and nothing does.
- `DataUtils.isAtomic` flags any value containing `, ; | & +`, a bracket,
  ` and ` or ` or `. Addresses, "Smith, John", phone numbers such as
  `+1 (555) 010-9999` and "Research and Development" are all reported as
  non-atomic.
- `hasAtomicViolations` uses a different rule, so two parts of the app
  disagree.
- `checkAtomicity` looks at the first 100 rows only, although its caller
  already prepared a 5000-row sample.

**Fix.**

1. Decide per *column*, not per value: a column is multi-valued when a
   consistent delimiter splits a large share of its values (say over 30%)
   into tokens that look alike (similar length and type), and the tokens
   repeat across rows. Free text fails the "tokens repeat" test.
2. Never flag columns the classifier tags as address, name, phone, free text
   or currency.
3. Keep one detector; delete the other.
4. Make 1NF act: for each confirmed multi-valued column, move it to a child
   relation `(parent_key, value)` instead of duplicating parent rows, which
   breaks the parent's key. Ask the user to confirm before splitting.
5. Use the whole sample that the caller passes.

### P0-15. Dependency-preservation lists can contradict the verdict

**Where:** `databaseService.ts:747–781`.

**Problem.** `isPreserved` comes from the engine, but the `preserved` and
`lost` lists use a syntactic test ("some relation contains LHS and RHS").
An FD can be implied by the projected dependencies without sitting in one
relation, so the lists may show losses while the verdict says preserved. The
"parallel" branch is the same loop wrapped in `Promise.all` and does nothing
in parallel.

**Fix.** Use the standard test for each FD `X → A`: iterate
`Z := Z ∪ ((Z ∩ Rᵢ)⁺ ∩ Rᵢ)` over all relations until stable, starting from
`Z = X`; the FD is preserved iff `A ∈ Z`. Return the per-FD results from the
engine and derive the verdict from them. Delete the duplicated loops.

---

## P1 — Robustness, scale and security

### P1-1. Analysis runs on the UI thread and cannot be cancelled

**Where:** no `Worker` anywhere in `src/`; `databaseService.ts:358` and
`:2939` create and abort an `AbortController` whose signal is never read.

**Fix.**

1. Move the engine into a Web Worker (`src/workers/engine.worker.ts`), with
   `comlink` or a small message protocol. Progress goes back as messages.
2. Cancel by terminating the worker. For finer control, pass the
   `AbortSignal` into the miner and check it once per lattice node.
3. Enforce the time budget in the same place: on expiry, return the FDs found
   so far, flagged as incomplete with the lattice level reached.

### P1-2. FD miner does not scale in columns or rows

**Where:** `src/services/processors/fdMiner.ts`.

**Problems.**

- Partitions keep singleton groups; TANE's speed comes from *stripped*
  partitions that drop them.
- `partitionCache` keeps every level; only the previous level is needed.
- No RHS candidate sets (`C⁺`), so every `(X, A)` is tested.
- Superkey pruning scans a growing array linearly (`:207`).
- `maxLhsSize` is fixed at 4, so wider determinants are missed without
  notice, while a 60-column table still enumerates about 520 000 LHS sets.

**Fix, in order of payoff.**

1. Pre-filter columns: drop constants (they depend on everything) and unique
   columns (they determine everything) before the lattice, and add their FDs
   analytically.
2. Stripped partitions with the standard linear-time product.
3. Evict level `k−1` after level `k+1` is built.
4. Implement TANE's `C⁺` pruning and key pruning exactly.
5. Report clearly when `maxLhsSize` or the time budget cut the search.
6. Longer term: implement HyFD (sample to guess, validate on full data) in
   Rust with `rayon`. This is the baseline reviewers will expect.
7. Add a benchmark script with fixed datasets (see P3-2) and track runtime
   in CI to catch regressions.

### P1-3. Whole files are copied across IPC as strings

**Where:** `databaseService.ts:3199–3204` (`await f.text()` for every file),
`engine/mod.rs:17` (32 MiB limit).

**Problem.** Each file exists as a JS string, a serialized IPC message and a
Rust `String` at once. The Rust side rejects anything above 32 MiB, while
the TS side has different limits.

**Fix.** Use `tauri-plugin-dialog` to pick files and pass *paths*. Read and
stream from disk in Rust (`csv::Reader::from_path`). Keep the `File`-based
path only for browser development. Define one size policy in one place.

### P1-4. Rust CSV reader assumes comma, UTF-8 and well-formed rows

**Where:** `src-tauri/src/engine/csv.rs:53–56`, `engine/mod.rs:38–44`.

**Fix.**

- Sniff the delimiter (`,` `;` tab `|`) from the first lines; the TS parser
  already does, so the two engines currently parse the same file differently.
- Detect encoding and strip the BOM (`encoding_rs`, `chardetng`).
- `flexible(true)` accepts short rows; count and report them instead of
  silently treating missing cells as empty.
- Handle duplicate and empty header names (`col_3`, `name_2`).
- Use a bounded thread pool (`rayon`) instead of one thread per file.

### P1-5. Type inference is fragile and differs between engines

**Where:** `src-tauri/src/engine/csv.rs:162–182`,
`databaseService.ts:137–180` and `:1266`.

**Problems.** In Rust a column is `INTEGER` only if every value parses, so
one stray cell makes it `TEXT`; ZIP codes and other zero-padded identifiers
become `INTEGER` and lose their zeros; values with `$` count as numeric and
are typed `REAL`; there is no boolean, decimal, timestamp or length.

**Fix.** One inference spec, implemented once:

- Tolerate a small share of non-conforming values (about 1%) and list them
  as data-quality issues.
- Leading zeros or fixed-width digits → text.
- Track max length → `VARCHAR(n)`; track scale → `DECIMAL(p, s)` for money.
- Recognize booleans, ISO timestamps, UUIDs.
- Emit `NOT NULL` when no nulls were seen, `UNIQUE` for non-key candidate
  keys.

### P1-6. Pipeline history is not persistent and is probably broken

**Where:** `src-tauri/src/db.rs:25–27`; no caller of `save_pipeline_record`
or `get_pipeline_history` in `src/`.

**Problem.** The pool opens `sqlite::memory:` with up to five connections.
Each connection to `:memory:` is its own empty database, so a query that
lands on a second connection will not find the table. History is lost on
restart in any case, and the frontend never calls the commands.

**Fix.** Either delete `db.rs` and the `sqlx` dependency (smaller binary,
faster builds), or store a file in the app data directory
(`app.path().app_data_dir()`), set `max_connections(1)` or use WAL, and add
a History panel that lists and reopens past runs.

### P1-7. Webview security is wide open

**Where:** `src-tauri/tauri.conf.json` (`"csp": null`), `package.json`
(`rehype-raw`), report generation that interpolates CSV-derived strings.

**Problem.** Column names and cell values from untrusted CSV files are
written into Markdown and Mermaid. If the Markdown renderer enables
`rehype-raw`, a header such as `<img src=x onerror=...>` runs in the
webview, which can call Tauri commands.

**Fix.**

1. Set a strict CSP (`default-src 'self'; img-src 'self' data:;
   style-src 'self' 'unsafe-inline'`).
2. Remove `rehype-raw`, or add `rehype-sanitize` after it.
3. Escape `|`, backticks and angle brackets when writing values into
   Markdown tables.
4. Initialize Mermaid with `securityLevel: 'strict'`.
5. Add a test CSV with hostile headers to the adversarial suite.

### P1-8. Results are cached in `sessionStorage`

**Where:** `src/utils/resultCache.ts`, `src/App.tsx:100`.

**Problem.** Results include data rows. The storage quota is about 5 MB, and
`saveCachedResult` swallows the quota error, so on larger inputs the Output
page silently falls back to stale or empty data.

**Fix.** Hold results in memory (React context or a small `zustand` store).
If persistence across reloads matters, use IndexedDB, and store only schema
artifacts, not rows.

### P1-9. Identifier collisions after sanitization

**Where:** `src-tauri/src/engine/erd.rs:25`, `csv.rs:11`,
`databaseService.ts:3286`.

**Problem.** `Order Date` and `Order-Date` both become `Order_Date`;
`sales 2024.csv` and `sales-2024.csv` both become `sales_2024`. The DDL then
has duplicate columns or tables. Reserved words are quoted in some paths and
not in others.

**Fix.** One `IdentifierRegistry` that sanitizes, de-duplicates with numeric
suffixes, keeps the original name for display, and quotes per dialect.

---

## P2 — Code health

### P2-1. Two engines implement the same things differently

**Where:** NER (`ner.rs` vs `semanticProfiler.ts`), FK detection (`fk.rs` vs
`relationDetector.ts`), ERD (`erd.rs` vs `normalizationEngine.ts:2782`), SQL
(`sql.rs` vs `databaseService.ts:240`), report (`report.rs` vs
`databaseService.ts:1731`), CSV parsing.

**Problem.** Results depend on file count and runtime environment. Every
fix must be made twice or the engines drift further.

**Decision to make.** Pick one:

- **TypeScript engine in a worker, Rust for I/O only.** Fastest route to a
  correct app. Delete `fk.rs`, `erd.rs`, `sql.rs`, `report.rs`, `ner.rs`.
- **Rust engine everywhere**, compiled to WebAssembly for browser
  development. Best performance and a single source of truth, but requires
  porting about 5 000 lines of TypeScript.

Recommendation: the first now, the second as a planned migration starting
with the FD miner (P1-2), where Rust pays off most.

### P2-2. Two files hold most of the application

**Where:** `databaseService.ts` (3 300 lines), `normalizationEngine.ts`
(4 726 lines).

**Fix.** Split by pipeline stage, one concern per module:

```
src/engine/
  ingest/      csv, encoding, delimiter
  profile/     types, nulls, atomicity
  semantic/    column classifier
  fd/          miner, cover, closure
  keys/        candidate keys
  normalize/   2nf, 3nf, bcnf, chase, preservation
  relate/      ind, fk scoring
  emit/        erd, sql, report
  pipeline/    executor, context, operations
```

While moving code, remove:

- Residue comments (`FIXED:`, `UNCHANGED:`, author/date headers).
- Marketing adjectives in names and logs ("Enhanced", "Optimized",
  "mathematically rigorous").
- Fake metrics: `getCacheHitRate`, `checkSystemHealth`, memory "estimates".
- `retryOperation` around deterministic functions; retrying a pure function
  three times cannot change its result.
- Dead methods such as `validateFunctionalDependencyRigorous` if a usage
  search confirms nothing calls them.

### P2-3. Modules that appear to be unused

`src/components/Console.tsx`, `src/components/Input.tsx` (`AskAI`),
`src/utils/consoleCommands.ts`, `src/utils/CompatibilityChecker.ts` (602
lines), `src/utils/outputDataValidator.ts`,
`src/hooks/useOperationValidation.ts` are not imported by `App.tsx` or by
each other, apart from Console → consoleCommands. Run `npx knip` to confirm,
then either mount them (the console is advertised in the README) or delete
them.

### P2-4. Type safety

There are about 295 uses of `any` outside tests; `ProcessingResult` and the
whole IPC boundary are `any`. Generate TypeScript types from the Rust DTOs
(`ts-rs` or `specta`) and type the pipeline context. Add ESLint with
`@typescript-eslint/no-explicit-any` as a warning and ratchet down.

### P2-5. Tests miss the paths users take

**Fix.**

- Integration tests for `processFiles` in both environments (P0-1).
- Golden-file tests: fixed CSV inputs with expected ERD and DDL checked in.
- Property tests for lossless join and key uniqueness (P0-4).
- Ground-truth tests from the evaluation harness (P3-2).
- Remove the duplicate `src/fdMiner.test.ts` (a second copy lives next to
  the miner).
- The logger prints a trailing `undefined` on every line in test output; fix
  the format call that prints an absent data argument.
- CI: run Rust tests on Windows and macOS too, since release builds target
  them; add `cargo test` and `vitest` coverage reports.

### P2-6. Repository hygiene

- `target/rust-analyzer/flycheck0/{stderr,stdout}` are tracked although
  `target` is ignored: `git rm --cached -r target`.
- Root-level working notes (`AUDIT_SUMMARY_REPORT.md`, `ORIGINAL_REQUEST.md`,
  `TEST_INFRA.md`, `TEST_READY.md`) should move to `docs/` or be deleted.
- README badge says v2.5.0; the package is 2.6.0. Generate the badge from
  the release, or bump it in the release script.
- README lists `.mmd` outputs while the TS path writes `.mermaid`; pick one.
- `docs/ARCHITECTURE.md` describes hooks and modules that are gone.

---

## P3 — New features

Ordered by value for a demonstration paper.

### P3-1. Human-in-the-loop review of every inference

**Why.** Data alone cannot tell a real dependency from a coincidence. The
strongest related systems (Normalize, BCNF*) keep the user in the loop, and
an interactive review is what makes a live demo interesting.

**What to build.**

- A review panel after analysis with three lists: functional dependencies,
  keys, foreign keys. Each item shows evidence (support, violations,
  containment, name score) and can be accepted, rejected or edited.
- Rank FDs so that plausible ones come first: short LHS, LHS that looks like
  an identifier, high redundancy removed (rows saved if split), RHS not
  nearly unique.
- "Why?" on any item opens the rows that support or violate it.
- Decisions are stored in the workflow snapshot and replayed on re-run, so a
  session is reproducible.
- The schema is recomputed incrementally when a decision changes.

### P3-2. Evaluation harness and benchmark datasets

**Why.** The paper needs numbers, and so does regression testing.

**What to build.** A script `npm run bench` (or a CLI, see P3-9) that:

1. Takes databases with known schemas: TPC-H (small scale factor),
   Northwind, Chinook, Sakila, MusicBrainz subset, and a few Kaggle exports.
2. Builds two inputs from each: (a) the original tables exported as CSV with
   constraints stripped, to test key and foreign-key detection; (b) a
   denormalized join, to test whether normalization recovers the tables.
3. Reports precision, recall and F1 for primary keys, foreign keys and
   recovered relations (a relation matches when attribute sets are equal),
   plus runtime and peak memory against rows and columns.
4. Compares with baselines where practical: Metanome HyFD for FD runtime,
   `autodb` for 3NF output.

### P3-3. Interactive ERD instead of a static Mermaid picture

**What to build.**

- Render the schema with React Flow (already a dependency): entities as
  nodes with typed attributes and key badges, relationships as edges with
  crow's-foot markers; automatic layout with `elkjs` or `dagre`.
- Editing: rename entities and attributes, merge two entities, move an
  attribute, change cardinality. Each edit is validated against the data.
- Two views: *relational* (tables and FKs) and *conceptual* (see P3-4).
- Export: Mermaid, PlantUML, DBML (dbdiagram.io), Graphviz DOT, SVG, PNG.
- Clicking an entity shows sample rows and the FD that created it.

### P3-4. Conceptual ER modelling, not only tables

**Why.** The paper promises an ERD. Today's output is a relational diagram.

**What to build.** Rules on top of the schema graph:

- **Associative entity / M:N:** a relation whose key consists of two or more
  foreign keys becomes a relationship; extra attributes become relationship
  attributes.
- **Weak entity:** composite key containing a foreign key plus a
  discriminator.
- **1:1:** a unique foreign key; suggest merging the two entities.
- **Specialization (is-a):** two relations share a primary key and one's key
  values are a subset of the other's.
- **Participation:** total or partial, from nullability and from whether
  every parent key appears in the child.
- **Entity naming:** from the determinant (`customer_id` → `Customer`),
  the classifier's tags, and the source file name, instead of names
  concatenated from attributes.

### P3-5. Optional local LLM assistance

**Why.** It is advertised (P0-12) and is useful for exactly the parts data
cannot decide. Keep it optional and off by default.

**What to build.**

- A Rust `ollama.rs` client (localhost only, timeouts, model list).
- Tasks that suit an LLM: naming entities and relationships; ranking
  ambiguous FDs or FK candidates by plausibility; explaining a decomposition
  in plain language; turning a sentence into a pipeline.
- Guardrails: the model only sees headers, types and a few sample values;
  its output can reorder or label candidates but can never add a dependency
  that fails verification on the data; every LLM-influenced item is marked.
- Evaluate with the harness (P3-2) with and without the LLM, so the paper
  can report its effect.

### P3-6. Export the normalized data, not only the schema

**What to build.**

- Per-relation CSV files with duplicates removed.
- A populated SQLite database file.
- `INSERT` scripts or `COPY` commands for PostgreSQL and MySQL, in
  dependency order so foreign keys resolve.
- A migration script for users who loaded the flat table already:
  `CREATE TABLE … AS SELECT DISTINCT …`.
- A post-load verification query per foreign key that counts orphans.

### P3-7. Explainable, step-by-step normalization

**What to build.** A stepper that replays the decomposition: the violating
FD, the split it causes, before and after tables with sample rows, and the
redundancy removed (cells saved). This doubles as teaching material and is a
strong demo segment. The data already exists in `BCNFDecompositionStep`.

### P3-8. SQL generation options in the UI

`SQLDialect` supports PostgreSQL, MySQL, SQLite and ANSI, but there is no
control for it in any component. Add a dialect selector, plus toggles for
`NOT NULL` / `UNIQUE` / `CHECK` inference, indexes on foreign keys,
`ON DELETE` behaviour, and naming style (snake_case, as-is).

### P3-9. Command-line mode

`normaflow analyze data/*.csv --out out/ --dialect postgres --json`.
Shares the engine with the app. Enables the benchmark harness, CI use, and
reproducible results for the paper's artifact evaluation.

### P3-10. More input sources

- Excel (P0-11), TSV, JSON and NDJSON (flatten nested objects into child
  tables, which is 1NF by construction), Parquet.
- Drop a folder to load every table in it.
- Connect to an existing SQLite or PostgreSQL database and reverse-engineer
  it, including undeclared foreign keys.

### P3-11. More dependency types

- Unique column combinations as a first-class result (keys without FDs).
- N-ary inclusion dependencies for composite foreign keys.
- Multivalued dependencies and 4NF.
- Order and denial constraints are out of scope; say so in the paper.

### P3-12. Project files and persistent history

A `.normaflow` project file holding input paths with content hashes, the
pipeline graph, all review decisions (P3-1) and the resulting schema, so a
session can be reopened, shared and diffed. Pair with the History panel from
P1-6.

### P3-13. Data-quality report

Much of the analysis already yields quality signals; present them together:
rows violating accepted FDs, dangling foreign-key values, type outliers,
duplicate rows, near-duplicate values ("NY" vs "New York"), columns that are
constant or empty. This is a concrete benefit to users who do not care about
normal forms.

### P3-14. Smaller usability items

- Bundled example datasets beyond the four-row sample (which is too small to
  yield meaningful FDs).
- Progress per node on the canvas, with timing and row counts.
- Clicking a node opens that step's result instead of a separate Output page.
- Dark mode, keyboard shortcuts, and accessible labels on canvas nodes.

---

## Suggested order of work

1. **Stop the false claims (one day).** P0-12 docs, P0-11 remove `.xlsx`,
   P0-6 remove the 100-row cap, P2-6 hygiene.
2. **Make multi-file correct.** P0-1, then P0-3 (executor), then P0-2
   (schema graph). These three are one refactor.
3. **Make results sound.** P0-4 exact vs approximate FDs, P0-5 nulls, P0-8
   and P0-9 keys, P0-15 preservation, with property tests.
4. **Make relationships credible.** P0-7 and P0-10 foreign keys.
5. **Measure.** P3-2 harness and P3-9 CLI. From here on, every change is
   judged by its effect on precision, recall and runtime.
6. **Make it demonstrable.** P3-1 review panel, P3-3 interactive ERD, P3-7
   stepper, P3-4 conceptual view.
7. **Harden.** P1-1 worker and cancel, P1-2 miner scale, P1-3/4/5 ingest,
   P1-7 security.
8. **Then extras.** P3-5 LLM, P3-6 data export, remaining P3 items.

Steps 1–5 are what a paper reviewer or artifact evaluator will test.
Step 6 is what a demo audience will remember.

