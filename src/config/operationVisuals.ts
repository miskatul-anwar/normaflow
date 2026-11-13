/**
 * Shared visual identity for pipeline operations.
 *
 * A single source of truth for the icons and phase accents used by both the
 * sidebar rail (OperationPalette) and the canvas nodes (CustomNodes), so the
 * two always stay visually in sync.
 */

import {
  Anchor,
  Atom,
  BarChart3,
  Database,
  Eraser,
  FileText,
  FileUp,
  GitBranch,
  KeyRound,
  Link2,
  Share2,
  ShieldCheck,
  Sigma,
  Table2,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import type { PhaseType } from '../types';

export interface OperationVisual {
  icon?: LucideIcon;
  /** Text glyph rendered instead of an icon (used by the normal forms). */
  glyph?: string;
}

/** A quiet tint of the accent over the current surface, so tiles read correctly in light and dark. */
/** The accent as text/icon ink: darker in light mode, lighter in dark, so it stays readable on its own tint. */
const ink = (accent: string) => `color-mix(in srgb, ${accent} 70%, var(--nf-ink-mix))`;
const soft = (accent: string) => `color-mix(in srgb, ${accent} 15%, var(--nf-surface))`;

export const PHASE_ACCENTS: Record<PhaseType, { accent: string; soft: string; ink: string; label: string; description: string }> = {
  PREP: { accent: '#0d9488', soft: soft('#0d9488'), ink: ink('#0d9488'), label: 'Prepare', description: 'Load & clean data' },
  ANALYZE: { accent: '#0891b2', soft: soft('#0891b2'), ink: ink('#0891b2'), label: 'Analyze', description: 'FDs, keys & relations' },
  NORMAL: { accent: '#7c3aed', soft: soft('#7c3aed'), ink: ink('#7c3aed'), label: 'Normalize', description: 'Normal forms' },
  OUTPUT: { accent: '#d97706', soft: soft('#d97706'), ink: ink('#d97706'), label: 'Generate', description: 'ERD, SQL & reports' },
};

export const OPERATION_VISUALS: Record<string, OperationVisual> = {
  'csv-loader': { icon: FileUp },
  'data-cleaner': { icon: Eraser },
  'atomicity-checker': { icon: Atom },
  'data-profiler': { icon: BarChart3 },
  'column-classifier': { icon: Tags },
  '1nf': { glyph: '1NF' },
  '2nf': { glyph: '2NF' },
  '3nf': { glyph: '3NF' },
  'bcnf': { glyph: 'BCNF' },
  'fd-miner': { icon: GitBranch },
  'key-discovery': { icon: KeyRound },
  'relation-detector': { icon: Link2 },
  'cardinality-analyzer': { icon: Sigma },
  'lossless-check': { icon: ShieldCheck },
  'dependency-preservation': { icon: Anchor },
  'erd-generator': { icon: Share2 },
  'relation-generator': { icon: Table2 },
  'sql-generator': { icon: Database },
  'report-generator': { icon: FileText },
};

export function getOperationVisual(operationId: string | undefined): OperationVisual {
  if (operationId && OPERATION_VISUALS[operationId]) return OPERATION_VISUALS[operationId];
  return {};
}
