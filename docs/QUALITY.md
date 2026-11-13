# Quality model (ISO/IEC 25000 SQuaRE)

NormaFlow follows the **ISO/IEC 25000 SQuaRE** series (Systems and software Quality Requirements and Evaluation).
Its product quality is specified and evaluated with the **ISO/IEC 25010** quality model, the data it produces with
**ISO/IEC 25012**, and its measures are reported in the style of **ISO/IEC 25020 / 25023**. This page says, for each
characteristic, what the requirement is, how it is checked, and what is **not** covered.

**What this does and does not claim.** It is a self-assessment by the project, carried out on the model and
measures above. It is **not** a third-party evaluation and **not** a certificate: SQuaRE gives a model and
a process, not a pass mark, and no accredited body has evaluated NormaFlow. Say "evaluated against ISO/IEC 25010
(SQuaRE)", not "ISO certified" or "compliant with ISO/IEC 25000".

`npm run quality` runs the automated gates (typecheck, lint, tests, production-dependency audit).
`npm run audit:a11y` runs the accessibility audit and `npm run audit:ui` the full layout and accessibility pass over 144 views, and `npm run audit:design` the design-consistency check (type, buttons, cards, radii) (both need `npm run build` and `vite preview`).

| ISO/IEC 25010 characteristic | Requirement | Evidence | Not covered |
|---|---|---|---|
| **Functional suitability** (completeness, correctness, appropriateness) | Every operation produces what its name says; normalization output is sound. | 650 tests, including a differential FD-miner test, golden outputs for the ERD/DDL, adversarial normalization suites, and an instance-level lossless-join check on every decomposition. Real-data check: the Chinook export loads into SQLite with foreign keys enforced and no violations. | Output on data that violates the tool's assumptions (for example, tables under 10 rows only use key determinants, see CHANGELOG). Relation names come from a small on-device model and are right about two times in three (15 of 22 tables in the project's benchmark, `docs/notes/model-naming-spike.md`); they are shown as *suggested* and can be renamed. |
| **Performance efficiency** (time behaviour, resource use, capacity) | Interactive analysis of files with tens of thousands of rows. | FD mining runs in a worker with a 30 s default budget, samples above 10,000 rows and validates on the full data, and skips near-unique determinants (3.7x faster on Northwind). 11 Chinook tables (15,607 rows) run in about 1 s. Start-up bundle is about 0.8 MB; the Output page, Mermaid, Graphviz and PDF code load on first use. | No automated performance budget; timings are manual. The naming model adds a first-load cost: in headless Chromium a run with a few relations took about 30 to 100 s including the model's first load. The installer carries the model (about 373 MB). |
| **Compatibility** (interoperability, co-existence) | Open formats in and out; no conflict with other software. | CSV, XLSX/XLS/ODS in; SQL (PostgreSQL, MySQL, SQLite, ANSI), CSV/JSON data, Mermaid, Graphviz DOT, SVG, Markdown and PDF out. Runs offline; no background services. | Only SQLite loading is verified by test; the other dialects are generated, not executed. |
| **Interaction capability** (usability: learnability, operability, user-error protection, accessibility, inclusivity) | WCAG 2.1 AA on every screen, both themes; keyboard operable; no motion that cannot be turned off. | `npm run audit:a11y` (axe-core) reports **0 violations** on the pipeline page and all ten Output tabs in light and dark. Workspaces are a labelled `nav` of real buttons; result panels are focusable regions; the main action meets 5.5:1 contrast; `prefers-reduced-motion` disables every animation and transition; destructive tab close asks first; undo/redo and "Undo last build". Light and dark themes with a switch (follows the system until chosen). | No screen-reader pass by a person; axe finds roughly a third of WCAG issues. Diagrams are drawn for a light page and stay on one in dark mode, and have no text alternative beyond their source (DOT/Mermaid copy and download). |
| **Reliability** (maturity, fault tolerance, recoverability) | A bad file or a stuck worker never takes the app down. | Error boundaries per workspace; pipeline cancellation and time budgets; the embedding worker is restarted after a timeout; results are cached per workspace; the natural-language bar never throws (hostile-input tests). | No soak or crash-recovery testing of the desktop shell. |
| **Security** (confidentiality, integrity, non-repudiation, accountability, authenticity) | Data never leaves the machine; untrusted file content cannot run code. | Local-first: strict CSP (`default-src 'self'`, no remote connect), bundled models and runtime, no telemetry. In a complete test run (single and multi-file, with the naming model) with every non-local request blocked, the application made none. CSV headers and values are escaped in SQL, Markdown, Mermaid and Graphviz output (tests with hostile names). Raw HTML is never rendered from reports. `npm audit --omit=dev`: no high or critical findings (2 low via Mermaid's KaTeX). | Dev tooling still has moderate advisories (ESLint family). The desktop installer is not code-signed. No external security review. |
| **Maintainability** (modularity, reusability, analysability, modifiability, testability) | A change in one area does not break another; behaviour is documented. | Engine, UI and workers are separate modules with 650 tests; `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, a changelog; shared `Button`, `StatCard` and design tokens; about 800 lines of dead CSS removed. | 382 lint warnings remain, mostly `any` in older engine and report code; the cap is enforced so it cannot grow. |
| **Flexibility** (adaptability, installability, replaceability, scalability) | Installs from one installer; adapts to the system. | Tauri installers for Windows, macOS and Linux built by CI on a tag; the maintainer installed and ran the desktop application on **Windows, Linux and macOS** and reports that it works as intended; theme follows the OS; layouts checked at 900, 1300 and 1700 px. | The cross-platform install check is manual and has no recorded test matrix (OS versions, hardware). The automated checks above run on one platform. |
| **Safety** (added in the 2023 edition) | Nothing in the app can harm people or property. | The app only reads the files you give it and writes files you choose. | Not applicable beyond that. |

## Data quality (ISO/IEC 25012)

What the tool reports about **your** data, and how its own outputs are made trustworthy:

| Characteristic | How it is handled |
|---|---|
| Accuracy / consistency | Dependencies carry measured confidence; approximate ones are flagged and not used unless allowed. Every decomposition is checked for lossless join and dependency preservation, on the data as well as symbolically. |
| Completeness | Missing values are counted per column; determinants with missing values are not used as keys; foreign keys list the share of values matched and whether they are optional. |
| Credibility | Warnings say when a result rests on little data (tables under 100 rows). |
| Understandability | Every figure on the Output page is labelled; the PDF report states what was and was not checked. |
| Traceability | The report lists the operations run, the options, and the engine's own notes. |

## Measurement (ISO/IEC 25020, 25023)

| Measure | Value | How to reproduce |
|---|---|---|
| Automated tests | 650 passing | `npm test` |
| Accessibility violations (axe, WCAG 2.1 AA + best practice) | 0 | `npm run audit:a11y` |
| High / critical advisories in shipped dependencies | 0 | `npm audit --omit=dev` |
| Lint errors | 0 (382 warnings, capped) | `npm run lint` |
| Start-up JavaScript | about 0.8 MB | `npm run build` |

## Checked on this revision

Re-run for this revision: `npm run quality` (typecheck, lint with 0 errors and 382 warnings, 650 tests, production-dependency
audit with 2 low advisories and none high or critical) and `npm run audit:a11y` (0 violations, both themes). The desktop
application was installed and run on Windows, Linux and macOS by the maintainer. The full-page layout audit (`npm run audit:ui`)
was not re-run for this revision, because it runs the naming model in every scenario and takes very long.

## Reviewing a release

1. `npm run quality`
2. `npm run build`, then `npx vite preview --port 4311` and `npm run audit:a11y`
3. Read the CHANGELOG entry and the limits above; update this page if a characteristic changed.
