# Model-based naming: spike result

Phase 1 of the proposal ("decide whether T5-class models are good enough before building anything else").
Reproduce with `scripts/spike/model-naming.mjs`.

## Setup

- Runtime: `@huggingface/transformers` in Node, ONNX, int8 (`q8`), beam search (4 beams), up to 16 new tokens.
- Models, all from the Xenova ONNX conversions on Hugging Face:

| Model | Licence | Download (encoder + merged decoder, int8) |
|---|---|---|
| `flan-t5-small` | Apache-2.0 | 95 MB |
| `flan-t5-base` | not stated on the model card (the base model is Apache-2.0) | 275 MB |
| `LaMini-Flan-T5-248M` | not stated on the model card | 275 MB |

  For comparison, the MiniLM model already shipped is 23 MB.
- Inputs: the 11 Chinook tables (all models and prompts) and the 11 Northwind tables (`flan-t5-base`, few-shot prompt only),
  each as its **column list** (and for two prompts, two sample rows). The file name was never shown to the model, so a
  correct answer has to come from the columns. The expected answer is the table's real name: `Album`, `Customer`,
  `Invoice`, and so on.
- Prompts, six variants: an instruction with columns and sample rows (run on both T5 models), a question form, a
  "reply with just the name" form, a five-example few-shot form (examples from unrelated domains), and two more
  phrasings. Not every model was run with every prompt: `flan-t5-small` had two prompts, `flan-t5-base` four,
  `LaMini-Flan-T5-248M` four.

## Result

**None of the three models produced usable names with any prompt.** Typical outputs, `flan-t5-base`:

| Table | Output |
|---|---|
| Album | `Album Id: Album Title: Title` |
| Artist | `Artists: Name` |
| Customer | `Company columns: CustomerId, Company` |
| Employee | `The following columns are used to describe the` |
| Genre | `Genres: Name` |
| Track | `The following columns are sorted by the` |
| Northwind Orders | `List of employees and their jobs:` |
| Northwind Regions | `The following columns are in the order in` |

Failure modes, in order of frequency:

1. **Copying a column or value** from the prompt (`ArtistId`, `Name`, `François`, `InvoiceId=0`).
2. **Continuing the prompt** instead of answering (`Columns: CustomerID, CompanyName`).
3. **Sentences** (`The table is called "Custom…`), from the instruction-tuned LaMini model, which also never reached
   the noun inside the 16-token limit.
4. **Empty or numeric output** (`flan-t5-small`: blank for Employee, MediaType and PlaylistTrack; `0`; `Playlist Id: 0`).

Only a handful of answers were even partly right (`Genres: Name`, `Artists: Name`), and those still carry column
text, which the proposal forbids (requirement 1). The only clean hit was a second beam candidate, `Album`, for the
Album table with `flan-t5-base` (top candidate: `For Those About To Rock`, a sample value). The top answer was
never a usable name for any of the tables I looked at. I did not compute a score, because nothing was close enough
to score; this is a reading of the outputs, not a measurement.

## Why

A table name needs world knowledge ("a row with `Milliseconds`, `Bytes`, `UnitPrice`, `AlbumId` is a *track*") and
instruction following under a tight format. The models that are small enough to ship inside an installer (under about
300 MB) were trained mainly to continue text and to answer short factual questions. Both abilities fail here, and extra
size within that range did not fix it.

## What this does and does not show

- It shows that the **T5-class models named in the proposal are not adequate** for this job, with prompts that give
  them the best chance (examples, sample rows, answer-only instructions).
- It does not show that no on-device model can do it. A decoder-only instruction model of 0.5 to 1.5 billion
  parameters would very likely do much better, but it costs 300 MB to 1 GB and is the "chat LLM" that requirement 3 excludes.
  It was not tested.
- The sample is two schemas with clear table names. It is an upper bound on how well the same models would do on
  cryptic real-world headers.

## Consequences for the plan

- Phase 2 (internal ids, no concatenated names) is independent of the model and can be built on its own.
  Without a model, the neutral placeholder (`relation_1`) is what every relation would be called until the user names it.
- Phases 3 to 5 (naming worker, packaging 95 to 275 MB of model files) should not be built for these models.
