<div align="center">

<img src="public/icon.png" alt="NormaFlow logo" width="120" />

# NormaFlow

**Turn raw CSV files into normalized database schemas — ERDs, SQL DDL and full normalization reports — in seconds.**

[![License: MIT](https://img.shields.io/badge/License-MIT-115e59.svg)](LICENSE)
[![Release: v2.4.0](https://img.shields.io/badge/Release-v2.4.0-0284c7.svg?logo=github)](https://github.com/miskatul-anwar/normaflow/releases)
[![CI](https://github.com/miskatul-anwar/normaflow/actions/workflows/ci.yml/badge.svg)](https://github.com/miskatul-anwar/normaflow/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%202-FFC131?logo=tauri&logoColor=black)](https://tauri.app)
[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=black)](https://react.dev)

*One desktop app for CSV → 1NF → 2NF → 3NF → ERD → SQL. Private by design — your data never leaves your machine.*

</div>

---

## What is NormaFlow?

NormaFlow is a **free & open-source cross-platform desktop app** that reverse-engineers relational databases from CSV exports.

Drop in one or many CSV files and NormaFlow will:

- 🧹 **Clean & validate** your data (atomicity checks, null handling, type profiling)
- ⛏️ **Mine functional dependencies** with a fast partition-refinement algorithm (TANE-inspired lattice pruning)
- 🔑 **Discover candidate keys** using attribute-closure search over the FD lattice
- 🧩 **Decompose to 3NF** with lossless-join verification (Bernstein synthesis) and dependency-preservation analysis
- 🕸️ **Detect cross-table foreign keys** by name heuristics *and* value-overlap sampling across tables
- 🧠 **Classify columns semantically** (NLP profiler: names, e-mails, prices, dates, locations, organizations…)
- 📊 **Generate Mermaid ERDs**, consolidated SQL DDL, and a Markdown normalization report
- 🤖 **Optionally enrich everything with a local LLM** via [Ollama](https://ollama.com) — no cloud, no API keys, no data exfiltration

## Highlights

| | |
|---|---|
| 🔒 **Private by design** | All processing happens locally. Ollama integration talks to `localhost` only. |
| ⚡ **Rust core engine** | CSV parsing, NER tagging and FK detection run natively via Tauri 2 — parallelized per file. |
| 🧮 **Sound algorithms** | Real functional-dependency mining, Armstrong closure key discovery, 3NF synthesis with lossless-join check. |
| 🖱️ **Visual pipelines** | Build workflows on an interactive React Flow canvas — drag nodes manually or describe what you want in plain English. |
| 💬 **Natural-language workflows** | *"Normalize my orders export to 3NF and give me SQL"* — the AI agent picks the right operations for you. |
| 📦 **Portable outputs** | Mermaid `.mmd`, `.sql`, `.md` and workflow `.json` files you can commit to your repo. |
| 🪶 **Lightweight** | Native binary, tiny footprint compared to Electron alternatives. |

## Installation

### Download (recommended)

Grab the latest installer for your platform from the [**Releases page**](https://github.com/miskatul-anwar/normaflow/releases):

| Platform | Artifact |
|---|---|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

> [!NOTE]
> macOS builds are unsigned. On first launch right-click → **Open**, or allow the app under *System Settings → Privacy & Security*.

### Build from source

Prerequisites: **Node.js ≥ 18**, **Rust ≥ 1.77**, and the [Tauri v2 system dependencies](https://tauri.app/start/prerequisites/).

```bash
git clone https://github.com/miskatul-anwar/normaflow.git
cd normaflow
npm install
npm run tauri dev    # development
npm run tauri build  # production bundle
```

<details>
<summary><b>Linux one-liner (Debian/Ubuntu)</b></summary>

```bash
sudo apt update && sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```
</details>

### Optional: local AI

Install [Ollama](https://ollama.com) and pull a model:

```bash
ollama pull qwen3:4b   # or llama3.2, gemma3, mistral…
```

NormaFlow auto-detects Ollama at `http://localhost:11434`. Without it, everything still works — the built-in rule engine takes over.

## Quick start

1. Launch NormaFlow and upload one or more CSV files (a sample dataset is preloaded).
2. Build your pipeline:
   - **Manually** — click/drag operations from the palette onto the canvas, or
   - **With AI** — type *"clean, normalize to 3NF, generate ERD and SQL"* in the Ask-AI bar.
3. Hit **Run All** and watch the console stream progress.
4. Open the **Output** tab to browse the ERD, SQL DDL, FDs, keys, cardinalities and the full report — then download what you need.

## Architecture at a glance

```
┌───────────────────────────── Browser (WebView) ─────────────────────────────┐
│  React 18 + TypeScript + Tailwind + React Flow                              │
│  ├─ Workflow canvas (nodes = pipeline operations)                           │
│  ├─ Console / validation side panel                                         │
│  └─ TS fallback engine: FD mining · key discovery · 3NF synthesis           │
└──────────────────────────────────┬──────────────────────────────────────────┘
                    invoke() IPC   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│  Rust core (Tauri 2)                                                        │
│  ├─ engine: parallel CSV parsing, type inference, value-sampled FK detect   │
│  ├─ ner: semantic column classification                                     │
│  ├─ erd/sql/report generators                                               │
│  ├─ ollama client (localhost only)                                          │
│  └─ SQLite pipeline history                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

Read the full story in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure

```
normaflow/
├── src/                  # React frontend
│   ├── components/       # UI components (canvas nodes, panels, output views)
│   ├── hooks/            # Reusable state logic (workflow graph, execution)
│   ├── services/         # Engine services (FD mining, NLP profiler, Ollama)
│   ├── config/           # Operation registry
│   └── utils/            # Pure helpers (validation, JSON extraction…)
├── src-tauri/            # Rust backend (engine, ner, erd, db, ollama modules)
├── docs/                 # Architecture & release docs
└── .github/              # CI, release automation, issue/PR templates
```

## Contributing

Contributions are welcome — code, docs, bug reports, feature ideas! See [`CONTRIBUTING.md`](CONTRIBUTING.md) to get started. Good first issues are labeled [`good first issue`](https://github.com/miskatul-anwar/normaflow/labels/good%20first%20issue).

Please read our [`Code of Conduct`](CODE_OF_CONDUCT.md) — be kind, be constructive.

## Security

Found a vulnerability? Please follow our [security policy](SECURITY.md) and report privately — do not open a public issue.

## License

[MIT](LICENSE) © Miskatul Anwar

---

<div align="center">

If NormaFlow saves you time, please consider giving the repo a ⭐ — it helps others discover the project!

[Report Bug](https://github.com/miskatul-anwar/normaflow/issues/new?template=bug_report.yml) · [Request Feature](https://github.com/miskatul-anwar/normaflow/issues/new?template=feature_request.yml)

</div>
