# Contributing to NormaFlow

First off — **thank you** for considering a contribution! 🎉 NormaFlow is a community project and every kind of help counts: code, documentation, bug reports, feature ideas, design, and spreading the word.

This document explains how to set up a development environment, our conventions, and how to get your pull request merged quickly.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Getting started](#getting-started)
- [Development workflow](#development-workflow)
- [Project layout](#project-layout)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Commit messages](#commit-messages)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)
- [Releasing](#releasing)

## Code of conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind, be constructive.

## Ways to contribute

| Type | How |
|---|---|
| 🐛 Bug report | Open an issue using the [bug template](.github/ISSUE_TEMPLATE/bug_report.yml) |
| ✨ Feature request | Open an issue using the [feature template](.github/ISSUE_TEMPLATE/feature_request.yml) |
| 📝 Documentation | Improve README/docs — typos count too |
| 💻 Code | Pick an issue labeled [`good first issue`](https://github.com/miskatul-anwar/normaflow/labels/good%20first%20issue) or propose your own |
| 🧪 Tests | More coverage in `src/*.test.ts` or `src-tauri/src/
└── lib.rs            # Tauri shell (window, plugins); all analysis lives in src/services
```bash
# 1. Fork & clone
git clone https://github.com/<your-username>/normaflow.git
cd normaflow

# 2. Install JS dependencies
npm install

# 3. Run the app in dev mode (hot reload for both UI and Rust)
npm run tauri dev

# 4. Verify everything passes before you start
npm run typecheck   # TypeScript strict check
npm run test        # Vitest unit tests
cargo test          # Rust unit tests (run inside src-tauri/)
```

## Development workflow

1. **Branch from `main`** with a descriptive name:
   - `feat/<short-name>` — new features
   - `fix/<short-name>` — bug fixes
   - `docs/<topic>` — documentation
   - `perf/<topic>` — performance work
   - `chore/<topic>` — tooling/maintenance
2. Make small, focused commits (see [commit messages](#commit-messages)).
3. Add/update tests for any behavior change.
4. Run the full check suite locally (below).
5. Push and open a PR against `main`.

### Full local check suite

```bash
npm run typecheck && npm run test -- --run   # frontend
cd src-tauri && cargo test && cargo clippy   # backend
```

CI runs the same checks on every push/PR — matching them locally avoids surprises.

## Project layout

```
src/
├── components/       # React components (flow nodes, panels, output views)
│   ├── ui/           # Reusable primitives (buttons, inputs, tabs…)
│   ├── flow/         # React Flow node/edge components
│   └── output/       # Result-page sections
├── hooks/            # Reusable stateful logic (useWorkflowGraph, useNormalization…)
├── services/
│   ├── processors/   # FD mining, normalization engine
│   ├── nlp/          # Semantic column profiler
│   └── utils/        # Logger, file helpers
├── config/           # Operation registry (single source of truth for pipeline ops)
├── types/            # Shared TypeScript types
└── utils/            # Pure functions (validation, JSON extraction…)
src-tauri/src/
├── engine/           # CSV parsing, type inference, FK detection, ERD/SQL/report generators
├── ner.rs            # Semantic classification
└── db.rs             # SQLite history
```

**Rules of thumb:**

- New pipeline operations must be registered in `src/config/operations.ts` (name, phase, dependencies).
- Keep components presentational; put stateful logic into hooks.
- Pure algorithms (FD mining, closures, profilers) should have zero DOM/React dependencies so they stay unit-testable.
- Rust commands return `Result<T, String>` with descriptive messages.

## Coding standards

- **TypeScript**: `strict` mode is on — no `any` unless justified; run `npm run typecheck`.
- **Formatting**: Prettier defaults (2 spaces, double quotes are fine). Consistency within a file wins over personal preference.
- **Rust**: `cargo fmt` + `cargo clippy` clean.
- No secrets, keys, or personal data in commits.
- Comments explain *why*, not *what*.

## Testing

We use [Vitest](https://vitest.dev) for the frontend and built-in `#[cfg(test)]` for Rust.

```bash
npm run test              # watch mode
npm run test -- --run     # single run (CI mode)

cd src-tauri
cargo test                # Rust tests
```

When fixing a bug, add a regression test that fails without your fix. When adding an algorithm (e.g., FD mining heuristics), cover edge cases: empty input, single row, duplicate rows, unicode values.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(erd): add N:M cardinality detection via value overlap
fix(engine): correct trailing-space PK tag in Mermaid output
docs(readme): add build-from-source instructions
perf(fds): replace pairwise validation with partition refinement
test(nlp): add gazetteer matcher cases
chore(deps): drop duplicate reactflow dependency
refactor(ui): extract workflow graph state into useWorkflowGraph
```

Scope is optional but encouraged. CI enforces nothing today, but maintainers squash-merge with these conventions, and they drive the CHANGELOG.

## Submitting a pull request

- Fill out the [PR template](.github/pull_request_template.md) fully.
- Link the issue it closes (`Closes #123`).
- Keep PRs focused — one feature or fix per PR.
- Ensure CI is green; a maintainer will review as soon as possible (usually within a few days).
- Draft PRs are welcome early if you want feedback on direction.

## Reporting bugs & requesting features

Please use the issue templates so we can reproduce quickly. For bugs include:

- NormaFlow version & platform
- Steps to reproduce (and a minimal CSV if possible)
- Expected vs actual behavior
- Console logs from the in-app console panel

## Releasing

Maintainers only — see [`docs/RELEASING.md`](docs/RELEASING.md). In short: bump versions, update `CHANGELOG.md`, tag `vX.Y.Z`, and CI builds installers for all platforms automatically.

