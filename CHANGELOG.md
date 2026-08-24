# Changelog

All notable changes to NormaFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.0] - 2026-08-24

### Added
- Circular icon-only operation rail: every pipeline operation is now a circular logo button grouped by pipeline phase; hovering reveals a slide-out card with the operation name, description and dependency hints (portal-rendered so it never clips).
- Shared visual identity (`operationVisuals`): per-operation lucide icons and phase accent palette (Prepare/teal, Analyze/cyan, Normalize/violet, Generate/amber) used consistently by the rail and the canvas nodes.
- Themed pipeline nodes: phase-colored gradient icon chips, accent side bar, operation descriptions, hover lift and selection glow; Start node features an emerald gradient with a breathing halo.
- Lively gradient pipeline edges: teal→cyan→violet gradient stroke with marching dashes, a travelling pulse dot (`animateMotion`) and glow underlay, per the official React Flow "Animating Edges" and "Turbo Flow" examples.
- React Flow theming via `--xy-*` CSS variables, glossy connection handles, phase-colored minimap nodes and a refined dotted canvas background.
- Auto fit-view framing the full chain after "Synthesize 3NF" builds it.

### Changed
- Operation palette search box and collapse toggles replaced by the compact icon rail (labels are revealed on hover).
- Node spacing increased (220 → 300 px) so pipeline edges are clearly visible between nodes.

### Fixed
- "Synthesize 3NF" built the full pipeline without any edges — the canvas is now properly wired node-to-node (`replaceGraph` derives chain edges when none are supplied).
- React Flow's base stylesheet was never imported, leaving controls/handles/edges unstyled.

## [2.5.0] - 2025-08-24

### Added
- Interactive canvas controls toolbar (`<Controls />`) supporting zoom in, zoom out, fit view, and interactive canvas lock.
- Directional arrow markers (`MarkerType.ArrowClosed`) and custom styling on all React Flow pipeline edges.
- Modern high-density dual-pane workspace architecture with transient toast notifications.

### Changed
- Removed redundant bottom console and natural-language prompt bar to maximize canvas viewport and performance.
- Streamlined toolbar controls for rapid schema synthesis and workflow state management.

## [2.4.0] - 2025-08-24

### Added
- FOSS project infrastructure: MIT `LICENSE`, `CONTRIBUTING.md`, Code of Conduct, security policy, issue/PR templates, CI pipeline and automated multi-platform release builds.
- Fast functional-dependency mining based on partition refinement with lattice pruning (replaces exhaustive pairwise re-validation).
- NLP-based semantic column profiler fusing column-name evidence with value-pattern evidence.
- Manual node creation: operation palette supports click-to-add and drag-and-drop onto the canvas.
- Rust engine: parallel per-file CSV processing, sampled value statistics, data-driven SQL type inference, value-overlap foreign-key verification, configurable Ollama endpoint.
- Unit tests (Vitest + cargo test) and `npm run typecheck` / `npm run test` scripts.

### Fixed
- Entity classifier corrupted table names by stripping every letter "s" instead of only a trailing plural.
- React StrictMode double-invocation caused duplicate nodes/edges when adding operations (side effects moved out of state updaters).
- Ollama chat over Tauri dropped conversation history (only last message was sent).
- LLM responses wrapped in Markdown code fences failed JSON parsing during flow generation.
- 3NF decomposition projected full original rows into decomposed relations instead of the relation's attributes.
- FD mining mutated arrays being iterated (`lhs.sort()` inside combination loop).
- Mermaid ERD emitted invalid trailing spaces after non-PK columns; identifiers are now sanitized.
- Duplicate dependencies removed (`reactflow` v11 alongside `@xyflow/react` v12, `framer-motion` alongside `motion`).

## [2.3.0] - 2025-08-02

### Added
- Multi-CSV pipeline with cross-table relationship detection.
- Rust core engine (`process_multi_csv_rust`) for high-speed parsing and ERD/SQL/report generation.
- Ollama AI analyst integration and natural-language workflow generation.
- Visual workflow canvas (React Flow), undo/redo, workflow save/load.
- Normalization reports, Mermaid ERDs and consolidated SQL DDL outputs.
