# Not Done

Work from [IMPROVEMENTS.md](IMPROVEMENTS.md) that is **still open** after the
second round. Everything not listed here was addressed; see the status table in
`IMPROVEMENTS.md` and the `[Unreleased]` entry in [CHANGELOG.md](CHANGELOG.md).

## Not verified

- The desktop app was **not launched in a Tauri window**. What was checked:
  typecheck, 456 Vitest tests, `vite build`, the engine worker in headless
  Chromium against the built bundle, and generated SQL loaded into SQLite.
  The canvas, the Output page, the ER preview, downloads, and the strict
  Content-Security-Policy (now with `worker-src 'self' blob:`) have not been
  clicked through. Rust was not touched this round except `tauri.conf.json`.
- Performance on files of tens of MB or on 50+ column tables has not been
  measured. The bench covers up to a few hundred rows.

## Quality gaps

- **Recovering tables from a denormalized file is weak** (relations precision
  22–50% in `docs/EVALUATION.md`). Coincidental FDs on small data become extra
  relations. Needs FD ranking and the review step (P3-1).
- **P1-2** FD mining: TANE's C⁺ pruning and parallel validation are not done;
  LHS size is capped at 4.
- **P0-3** Multi-file output still has its own emitters (they need the
  cross-file schema graph); only single-file outputs are table-driven.
- **P0-14** 1NF splits columns by list delimiters (`;`, `|`, `,`, ` / `, JSON
  arrays). Other formats are not recognised. Child tables are not named
  collision-safely against existing relations.
- **P0-10** Composite foreign keys need a composite primary key on the target
  and name evidence per column. Composite keys without name evidence are not found.
- **P3-6** No populated `.db` file, PostgreSQL `COPY`, or flat-table migration script.
  Data export covers multi-file runs only, not single-file runs.

## Code health

| ID | What is open |
|---|---|
| P2-2 | `databaseService.ts` (~3 500 lines) and `normalizationEngine.ts` (~5 200 lines) are still single files. |
| P2-4 | About 390 ESLint warnings, nearly all `no-explicit-any`; the pipeline context is not typed. The cap in `npm run lint` can only go down. |

## Features not started (P3)

- **P3-1** Human-in-the-loop review of FDs, keys and foreign keys
- **P3-3** Interactive ER diagram (React Flow) with editing and more export formats
- **P3-4** Conceptual ER modelling (weak entities, specialization, participation; junction tables are only noted)
- **P3-5** Optional local-LLM assistance
- **P3-7** Step-by-step explanation of each decomposition
- **P3-8** SQL options in the UI (dialect works in the API and CLI; no UI control)
- **P3-10** More inputs (Excel, JSON, Parquet, existing databases)
- **P3-11** More dependency types (UCCs, n-ary INDs, MVDs / 4NF)
- **P3-12** Project files and persistent run history
- **P3-13** Data-quality report
- **P3-14** Smaller usability items (larger sample datasets, per-node progress, dark mode)
- **P3-2** only started: no real-world datasets (TPC-H, Northwind, Chinook, Sakila) and no baselines (HyFD, autodb)

## Suggested next steps

1. Launch the app (`npm run tauri dev`) and click through a one-file and a two-file run.
2. P3-1: FD ranking and a review panel; use `npm run bench` to measure the effect.
3. P3-2: add real datasets to the harness.
4. P3-8: dialect selector in the UI.
