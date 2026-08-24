/**
 * OperationPalette — manual pipeline node creation.
 *
 * Two interaction modes:
 *  - Click an operation → appended to the workflow chain (dependency-checked).
 *  - Drag an operation onto the canvas → dropped at cursor position.
 *
 * Operations are grouped by pipeline phase for scannability.
 */

import { useMemo, useState } from 'react';
import { OPERATIONS } from '../../config/operations';
import type { OperationDefinition, PhaseType } from '../../types';

const PHASE_META: Record<PhaseType, { label: string; accent: string; description: string }> = {
  PREP: { label: 'Prepare', accent: '#0d9488', description: 'Load & clean data' },
  ANALYZE: { label: 'Analyze', accent: '#0e7490', description: 'FDs, keys & relations' },
  NORMAL: { label: 'Normalize', accent: '#7c3aed', description: 'Normal forms' },
  OUTPUT: { label: 'Generate', accent: '#b45309', description: 'ERD, SQL & reports' },
};

export const OPERATION_DND_MIME = 'application/normaflow-operation';

interface OperationPaletteProps {
  /** Present operations already on the canvas (shown as added). */
  activeOperations?: string[];
  onAdd: (label: string) => void;
}

export function OperationPalette({ activeOperations = [], onAdd }: OperationPaletteProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<PhaseType>>(new Set());

  const grouped = useMemo(() => {
    const entries = Object.entries(OPERATIONS)
      .filter(([label]) => !query || label.toLowerCase().includes(query.toLowerCase()) ||
        OPERATIONS[label].description.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a[1].order - b[1].order);

    const byPhase = new Map<PhaseType, Array<[string, OperationDefinition]>>();
    for (const entry of entries) {
      const phase = entry[1].phase;
      if (!byPhase.has(phase)) byPhase.set(phase, []);
      byPhase.get(phase)!.push(entry);
    }
    return byPhase;
  }, [query]);

  const togglePhase = (phase: PhaseType) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col" data-testid="operation-palette">
      <div className="px-2 pb-2">
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Filter operations…"
          aria-label="Filter operations"
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {[...grouped.entries()].map(([phase, operations]) => {
          const meta = PHASE_META[phase];
          const isCollapsed = collapsed.has(phase);
          return (
            <section key={phase} className="mb-2">
              <button
                type="button"
                onClick={() => togglePhase(phase)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                title={meta.description}
              >
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.accent }} />
                  {meta.label}
                </span>
                <span aria-hidden>{isCollapsed ? '+' : '–'}</span>
              </button>

              {!isCollapsed && (
                <ul className="mt-1 space-y-1">
                  {operations.map(([label, config]) => {
                    const isActive = activeOperations.includes(label);
                    return (
                      <li key={label}>
                        <button
                          type="button"
                          draggable
                          onDragStart={event => {
                            event.dataTransfer.setData(OPERATION_DND_MIME, label);
                            event.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => onAdd(label)}
                          disabled={isActive}
                          title={`${config.description}\n${config.dependencies.length ? `Requires: ${config.dependencies.join(', ')}` : 'No dependencies'}\n\nClick to append · drag onto canvas to place`}
                          className={`group w-full cursor-grab rounded-md border px-2 py-1.5 text-left text-xs transition-colors
                            ${isActive
                              ? 'cursor-not-allowed border-teal-200 bg-teal-50 text-teal-400 line-through'
                              : 'border-transparent bg-white text-gray-700 shadow-sm hover:border-teal-500 hover:bg-teal-50/60 active:cursor-grabbing'}`}
                        >
                          <span className="block font-medium leading-tight">{label}</span>
                          <span className="block truncate text-[10px] text-gray-400 group-hover:text-gray-500">
                            {config.description}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        {grouped.size === 0 && (
          <p className="px-2 py-4 text-center text-xs text-gray-400">No operations match “{query}”.</p>
        )}
      </div>

      <p className="border-t border-gray-200 px-3 py-2 text-center text-[10px] leading-tight text-gray-400">
        Click to append · drag onto canvas to place
      </p>
    </div>
  );
}
