# NormaFlow

NormaFlow is a high-performance relational database normalization tool powered by Tauri, React, TypeScript, and a native Rust core engine with local Ollama integration.

## Key Features

- **Rust Core Engine**: Heavy-lifting multi-CSV processing, FD mining, key discovery, and normal form decompositions (1NF, 2NF, 3NF) offloaded to Rust.
- **Local Ollama AI Integration**: Connects to local Ollama models (`qwen`, `llama`, `gemma`, `mistral`) for schema enrichment and natural language pipeline generation.
- **Multi-CSV Support**: Detects cross-table foreign key relationships, candidate keys, and entity types across multiple tables simultaneously.
- **Automated Artifact Generation**: Generates multi-table Mermaid ERD diagrams, consolidated SQL DDL scripts, and Markdown reports.
- **React Flow Canvas**: Visual interactive workflow graph builder with automatic sequence validation and console diagnostics.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://rustup.rs/) (for Tauri desktop app)
- [Ollama](https://ollama.ai/) (optional, for local LLM features)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Tauri desktop app
npm run tauri dev
```

### Build Production Release

```bash
# Build web bundle
npm run build

# Build Tauri desktop bundle
npm run tauri build
```
