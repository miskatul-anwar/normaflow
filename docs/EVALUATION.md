# Evaluation

`npm run bench` (or `npm run bench -- --scale 5 --json`) runs the engine on
ground-truth databases defined in `src/eval/datasets.ts` and reports
precision / recall for:

- **Primary keys** and **foreign keys**, from the tables exported as separate
  key-less CSV files (composite keys and a junction table included).
- **Recovered relations**, from one denormalized join of all tables: a relation
  counts as recovered when its attribute set equals an original table's.
- Runtime for both runs.

Datasets are synthetic (seeded, so runs repeat): `retail` (customers, products,
orders, order_items with a composite key) and `university` (students, majors,
courses, enrolments as a junction table). Real benchmarks (TPC-H, Northwind,
Chinook, Sakila, MusicBrainz) are not included yet.

## Latest numbers (scale 1)

| Dataset | PK P/R | FK P/R | Relations P/R |
|---|---|---|---|
| retail | 100% / 100% | 100% / 100% | 22% / 50% |
| university | 100% / 100% | 100% / 100% | 50% / 50% |

Reading them: key and foreign-key detection is solid on these schemas.
Recovering the original tables from a *denormalized* file is weak: with a few
hundred rows many coincidental dependencies hold (for example
`customer_name, order_date → order_id`), and 3NF synthesis turns them into
extra relations. Ranking FDs by plausibility and asking the user to accept or
reject them (P3-1 in `IMPROVEMENTS.md`) is the planned fix; this harness is how
to measure it.

`src/eval/harness.test.ts` keeps a regression floor (recall and precision of
keys and foreign keys at or above 90%).
