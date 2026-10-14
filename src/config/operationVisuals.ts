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

export const PHASE_ACCENTS: Record<PhaseType, { accent: string; soft: string; label: string; description: string }> = {
  PREP: { accent: '#0d9488', soft: '#ccfbf1', label: 'Prepare', description: 'Load & clean data' },
  ANALYZE: { accent: '#0891b2', soft: '#cffafe', label: 'Analyze', description: 'FDs, keys & relations' },
  NORMAL: { accent: '#7c3aed', soft: '#ede9fe', label: 'Normalize', description: 'Normal forms' },
  OUTPUT: { accent: '#d97706', soft: '#fef3c7', label: 'Generate', description: 'ERD, SQL & reports' },
};

export const OPERATION_VISUALS: Record<string, OperationVisual> = {
  'csv-loader': { icon: FileUp },
  'data-cleaner': { icon: Eraser },
  'atomicity-checker': { icon: Atom },
  'data-profiler': { icon: BarChart3 },
  'ner-classifier': { icon: Tags },
  '1nf': { glyph: '1NF' },
  '2nf': { glyph: '2NF' },
  '3nf': { glyph: '3NF' },
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
