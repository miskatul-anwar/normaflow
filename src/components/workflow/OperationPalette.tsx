/**
 * OperationPalette — the sidebar for building a pipeline.
 *
 * Two layouts chosen by width:
 *  - list (default): every operation with its name and one-line description,
 *    grouped by phase, with a filter box;
 *  - rail (narrow): icons only, with a tooltip.
 *
 * Each operation shows what clicking it will do:
 *  - added:  already on the canvas (check mark, not clickable);
 *  - ready:  all prerequisites are on the canvas, click to add it;
 *  - locked: a prerequisite is missing; clicking adds the prerequisites too.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsLeft, Lock, RotateCcw, Search } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { OPERATIONS } from '../../config/operations';
import { getOperationVisual, PHASE_ACCENTS } from '../../config/operationVisuals';
import { dependenciesMet } from '../../services/nlp/workflow/planner';
import { DEFAULT_PALETTE_WIDTH, isListMode } from '../../hooks/usePaletteResize';
import type { OperationDefinition, PhaseType } from '../../types';

interface OperationPaletteProps {
  /** Operations already on the canvas. */
  activeOperations?: string[];
  /** Add an operation whose prerequisites are all on the canvas. */
  onAdd: (label: string) => void;
  /** Add an operation together with the prerequisites it is missing. */
  onAddWithPrerequisites?: (label: string) => void;
  /** Current sidebar width in pixels; decides list or rail layout. */
  width?: number;
  onCollapse?: () => void;
  onResetWidth?: () => void;
}

type OpState = 'added' | 'ready' | 'locked';

interface TooltipState {
  name: string;
  description: string;
  hint: string;
  x: number;
  y: number;
}

export function OperationPalette({
  activeOperations = [],
  onAdd,
  onAddWithPrerequisites,
  width = DEFAULT_PALETTE_WIDTH,
  onCollapse,
  onResetWidth,
}: OperationPaletteProps) {
  const list = isListMode(width);
  const [query, setQuery] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stateOf = useCallback(
    (label: string): OpState =>
      activeOperations.includes(label) ? 'added' : dependenciesMet(label, activeOperations) ? 'ready' : 'locked',
    [activeOperations],
  );

  const missingFor = useCallback(
    (label: string) => OPERATIONS[label].dependencies.filter(d => !activeOperations.includes(d)),
    [activeOperations],
  );

  /** What clicking will do, in words (list tooltip, rail tooltip and screen readers). */
  const hintFor = useCallback(
    (label: string): string => {
      const state = stateOf(label);
      if (state === 'added') return 'Already on the canvas';
      if (state === 'ready') return 'Click to add';
      return onAddWithPrerequisites
        ? `Needs ${missingFor(label).join(', ')}. Click to add it with its prerequisites`
        : `Needs ${missingFor(label).join(', ')} first`;
    },
    [stateOf, missingFor, onAddWithPrerequisites],
  );

  const activate = useCallback(
    (label: string) => {
      const state = stateOf(label);
      if (state === 'ready') onAdd(label);
      else if (state === 'locked') onAddWithPrerequisites?.(label);
    },
    [stateOf, onAdd, onAddWithPrerequisites],
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byPhase = new Map<PhaseType, Array<[string, OperationDefinition]>>();
    for (const entry of Object.entries(OPERATIONS).sort((a, b) => a[1].order - b[1].order)) {
      const [label, def] = entry;
      if (q && !label.toLowerCase().includes(q) && !def.description.toLowerCase().includes(q)) continue;
      if (!byPhase.has(def.phase)) byPhase.set(def.phase, []);
      byPhase.get(def.phase)!.push(entry);
    }
    return [...byPhase.entries()].sort((a, b) => a[1][0][1].order - b[1][0][1].order);
  }, [query]);

  const totals = useMemo(() => {
    const perPhase = new Map<PhaseType, { done: number; total: number }>();
    for (const [label, def] of Object.entries(OPERATIONS)) {
      const e = perPhase.get(def.phase) ?? { done: 0, total: 0 };
      e.total++;
      if (activeOperations.includes(label)) e.done++;
      perPhase.set(def.phase, e);
    }
    return perPhase;
  }, [activeOperations]);

  // Arrow keys move between operations (Tab still works; this is the list shortcut).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(scrollRef.current?.querySelectorAll<HTMLButtonElement>('[data-palette-item]:not(:disabled)') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const showTooltip = (event: React.SyntheticEvent<HTMLButtonElement>, label: string, def: OperationDefinition) => {
    const r = event.currentTarget.getBoundingClientRect();
    setTooltip({ name: label, description: def.description, hint: hintFor(label), x: r.right + 10, y: r.top + r.height / 2 });
  };

  const addedCount = activeOperations.length;
  const total = Object.keys(OPERATIONS).length;

  return (
    <nav className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]" data-testid="operation-palette" aria-label="Operations">
      {/* Header */}
      <div className={`flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-2 ${list ? 'justify-between' : 'justify-center'}`}>
        {list && (
          <div className="flex min-w-0 items-baseline gap-2 pl-1">
            <h2 className="text-sm font-semibold text-gray-900">Operations</h2>
            <span className="text-xs tabular-nums text-gray-500" aria-label={`${addedCount} of ${total} on the canvas`}>
              {addedCount}/{total}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {list && onResetWidth && Math.abs(width - DEFAULT_PALETTE_WIDTH) > 2 && (
            <IconButton variant="ghost" size="icon-sm" label="Reset sidebar width" icon={<RotateCcw />} onClick={onResetWidth} />
          )}
          {onCollapse && <IconButton variant="ghost" size="icon-sm" label="Collapse sidebar" icon={<ChevronsLeft />} onClick={onCollapse} />}
        </div>
      </div>

      {/* Filter */}
      {list && (
        <div className="shrink-0 border-b border-gray-200 p-2">
          <label className="relative block">
            <span className="sr-only">Filter operations</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setQuery('');
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  scrollRef.current?.querySelector<HTMLButtonElement>('[data-palette-item]:not(:disabled)')?.focus();
                }
              }}
              placeholder="Filter operations"
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </label>
        </div>
      )}

      {/* Operations */}
      <div ref={scrollRef} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {grouped.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-gray-500">No operations match “{query}”.</p>
        )}
        {grouped.map(([phase, ops]) => {
          const meta = PHASE_ACCENTS[phase];
          const t = totals.get(phase)!;
          return (
            <section key={phase} aria-label={meta.label} className={list ? 'mt-2' : 'mt-2 border-t border-gray-200 pt-2 first:mt-0 first:border-0 first:pt-0'}>
              {list && (
                <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-slate-50 px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <span className="size-2 rounded-full" style={{ backgroundColor: meta.accent }} aria-hidden />
                  {meta.label}
                  <span className="ml-auto font-normal normal-case tabular-nums text-gray-400">
                    {t.done}/{t.total}
                  </span>
                </h3>
              )}
              <ul className={list ? 'space-y-0.5' : 'flex flex-col items-center gap-1.5'}>
                {ops.map(([label, def]) => {
                  const state = stateOf(label);
                  const visual = getOperationVisual(def.id);
                  const Icon = visual.icon;
                  const hint = hintFor(label);
                  const tile = (
                    <span
                      className="relative flex size-8 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: meta.soft, color: meta.accent }}
                    >
                      {Icon ? <Icon className="size-4" strokeWidth={1.9} aria-hidden /> : <span className="text-[10px] font-bold leading-none">{visual.glyph ?? '•'}</span>}
                    </span>
                  );
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        data-palette-item
                        data-state={state}
                        disabled={state === 'added'}
                        aria-label={`${label}. ${def.description}. ${hint}`}
                        title={list ? `${def.description}. ${hint}` : undefined}
                        onClick={() => activate(label)}
                        onMouseEnter={e => !list && showTooltip(e, label, def)}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={e => !list && showTooltip(e, label, def)}
                        onBlur={() => setTooltip(null)}
                        className={[
                          'group relative flex items-center rounded-lg text-left transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                          list ? 'w-full gap-2.5 px-1.5 py-1.5' : 'size-10 justify-center border border-gray-200 bg-white shadow-xs',
                          state === 'added' ? 'cursor-not-allowed bg-teal-50/70' : 'hover:bg-gray-100',
                          !list && state !== 'added' ? 'hover:border-gray-300' : '',
                          state === 'locked' ? 'opacity-70 hover:opacity-100' : '',
                        ].join(' ')}
                      >
                        {tile}
                        {list && (
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{label}</span>
                            <span className="block truncate text-xs text-gray-500">{def.description}</span>
                          </span>
                        )}
                        {state === 'added' && (
                          <span
                            className={list ? 'flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white' : 'absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-teal-600 text-white'}
                            aria-hidden
                          >
                            <Check className={list ? 'size-3' : 'size-2.5'} strokeWidth={3.2} />
                          </span>
                        )}
                        {state === 'locked' && (
                          <Lock
                            className={list ? 'size-3.5 shrink-0 text-gray-400' : 'absolute -right-1 -top-1 size-4 rounded-full bg-white p-0.5 text-gray-500 shadow-xs'}
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {list && (
        <p className="shrink-0 border-t border-gray-200 px-3 py-2 text-xs leading-snug text-gray-500">
          <Lock className="mr-1 inline size-3 align-[-1px]" aria-hidden />
          Steps with a lock need earlier steps. Clicking one adds them too.
        </p>
      )}

      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-64 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="text-sm font-semibold text-white">{tooltip.name}</div>
            <div className="mt-0.5 text-slate-300">{tooltip.description}</div>
            <div className="mt-1 text-teal-300">{tooltip.hint}</div>
          </div>,
          document.body,
        )}
    </nav>
  );
}
