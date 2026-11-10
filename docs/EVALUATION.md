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

## Natural-language workflow builder

`npm run bench:nl` runs 77 labelled requests (`src/eval/nlWorkflowCases.ts`: direct keywords, acronyms, compound requests, negations, paraphrases, typos, and 10 junk sentences that must build nothing).

| Resolver | Plan accuracy | Junk rejected | Notes |
|---|---|---|---|
| Keywords only | 78% | 10 / 10 | keyword 20/20, acronym 10/10, compound 8/8, negation 4/4, paraphrase 7/17, typo 3/8 |
| Hybrid with a **fake** bag-of-words embedder | 94% | 7 / 10 | **not representative**: it only shows the wiring works offline |
| Hybrid with EmbeddingGemma | **not measured** | – | see below |

**What is missing.** No real embedding model could be run while this was written (the sandbox had no Ollama), so the cosine thresholds in `resolver.ts` (`accept 0.6`, `margin 0.03`, `floor 0.4`) are **untuned starting values**, and the prompt framing (`classification` vs `retrieval`) and the choice between `embeddinggemma-2:270m` and `embeddinggemma` have not been compared. To fill this in:

```bash
ollama pull embeddinggemma-2:270m
npm run bench:nl -- --ollama --sweep --failures
npm run bench:nl -- --ollama --framing retrieval --sweep   # compare framings
```

Then copy the best thresholds into `DEFAULT_THRESHOLDS`, and the table above. Until then, embedding-based answers are labelled "best guess" and always wait for the user to press Apply.
