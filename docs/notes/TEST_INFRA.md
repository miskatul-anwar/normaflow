# E2E Test Infra: Normaflow Platform

## Test Philosophy
- Opaque-box, requirement-driven end-to-end integration testing.
- No direct coupling to internal micro-functions; tests exercise public interfaces (`CSVProcessor`, `DataProcessor`, `FDMiner`, `NormalizationEngine`, `DatabaseService`, `WorkflowValidation`).
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory (27 Features Covered Across Tiers)
| # | Feature Area | Key Requirements | Test Coverage Strategy |
|---|--------------|------------------|------------------------|
| 1 | CSV Parsing & RFC 4180 | Quoted fields, embedded commas, newlines, quotes, multi-char delimiters | Tier 1 & Tier 2 |
| 2 | Index Column Protection | `id`, `sn`, `idx`, pure numeric headers preserved as primary key candidates | Tier 1 & Tier 2 |
| 3 | Type Inference | Precise integer, float, boolean, date, string classification; zero & false retention | Tier 1 & Tier 2 |
| 4 | FD Mining & Composite Keys | Lattice search, composite determinants evaluated before superkey pruning | Tier 1 & Tier 2 |
| 5 | Candidate Key Discovery | $L/R/B/N$ partition search, multi-cardinality keys, composite superkeys | Tier 1 & Tier 2 |
| 6 | Minimal Cover & Prime Classification | Canonical cover, prime attribute classification, normal form verifiers | Tier 1 & Tier 2 |
| 7 | 3NF Synthesis (Bernstein) | Canonical cover, LHS grouping, redundant relation elimination, lossless key insertion | Tier 1, 3, 4 |
| 8 | 3NF Lossless Decomposition | Determinant retention in residual relations, foreign key linking | Tier 1, 3, 4 |
| 9 | BCNF Decomposition | Recursive decomposition on non-superkey determinants, binary lossless join | Tier 1, 3, 4 |
| 10 | Chase Tableau Algorithm | Column-indexed tableau ($a_j$), distinguished priority, exact termination | Tier 1, 3, 4 |
| 11 | Dependency Preservation | Ullman fixpoint projected closure evaluation across decomposed relations | Tier 1, 3, 4 |
| 12 | Schema & SQL DDL Generation | Composite PK table-level constraints, reserved keyword quoting, dialect isolation | Tier 1, 3, 4 |
| 13 | Data Export Serialization | Preserving `0` and `false`, RFC 4180 CSV cell formatting | Tier 1, 3, 4 |
| 14 | React Flow Workflow & Resilience | Kahn's topological sort, cycle detection, sequence prerequisites, NaN guard | Tier 1, 3, 4 |

## Test Architecture
- Test Suite Runner: `npx vitest run src/tests/e2ePlatformIntegration.test.ts`
- Pass/Fail Semantics: 100% passing tests, exit code 0.
- Directory Layout: `src/tests/`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | University Registrar Workload | Flat student-course-instructor-grade table normalized to 3NF & BCNF; Chase lossless verification; SQL DDL across dialects | High |
| 2 | E-Commerce Order Fulfillment | Orders, customers, items, products, warehouses, payments; composite key mining; minimal cover; foreign keys | High |
| 3 | Financial Transaction Audit | Transactions with zero amounts, boolean settlement flags, RFC 4180 descriptions, reserved column names (`order`, `check`) | High |
| 4 | Healthcare Patient Encounters | Patients, doctors, visits, treatments, prescriptions; multi-attribute dependencies, 3NF synthesis, SQLite export | High |
| 5 | Logistics Supply Chain Graph | Shipments, routes, hubs, delivery statuses; cyclic dependencies, topological execution, export preservation | High |
