/**
 * OperationPalette — circular icon rail for pipeline node creation.
 *
 * Buttons show only the operation logo; hovering reveals the full label and
 * description in a slide-out card. The card is rendered through a portal with
 * fixed positioning so the palette's scroll containers can never clip it.
 * Operations are grouped by phase and support click-to-append and
 * drag-onto-canvas placement.
 */

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { OPERATIONS } from '../../config/operations';
import { getOperationVisual, PHASE_ACCENTS } from '../../config/operationVisuals';
import type { OperationDefinition, PhaseType } from '../../types';

export const OPERATION_DND_MIME = 'application/normaflow-operation';

interface OperationPaletteProps {
  /** Present operations already on the canvas (shown as added). */
  activeOperations?: string[];
  onAdd: (label: string) => void;
}

interface TooltipState {
  name: string;
  description: string;
  hint: string;
  accent: string;
  /** Fixed-viewport anchor: tooltip sits right of (x, y) on wide screens. */
  x: number;
  y: number;
  below: boolean;
}

export function OperationPalette({ activeOperations = [], onAdd }: OperationPaletteProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback(
    (event: React.SyntheticEvent<HTMLButtonElement>, label: string, config: OperationDefinition) => {
      const meta = PHASE_ACCENTS[config.phase];
      const rect = event.currentTarget.getBoundingClientRect();
      const below = window.innerWidth <= 768;
      setTooltip({
        name: label,
        description: config.description,
        hint: activeOperations.includes(label)
          ? 'Already in workflow'
          : config.dependencies.length
            ? `Requires: ${config.dependencies.join(', ')}`
            : 'No dependencies',
        accent: meta.accent,
        x: below ? rect.left + rect.width / 2 : rect.right + 12,
        y: below ? rect.top - 10 : rect.top + rect.height / 2,
        below,
      });
    },
    [activeOperations],
  );

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const grouped = useMemo(() => {
    const byPhase = new Map<PhaseType, Array<[string, OperationDefinition]>>();
    for (const entry of Object.entries(OPERATIONS).sort((a, b) => a[1].order - b[1].order)) {
      const phase = entry[1].phase;
      if (!byPhase.has(phase)) byPhase.set(phase, []);
      byPhase.get(phase)!.push(entry);
    }
    return [...byPhase.entries()].sort(
      (a, b) => a[1][0][1].order - b[1][0][1].order,
    );
  }, []);

  return (
    <nav className="nf-rail" data-testid="operation-palette" aria-label="Operation palette">
      <div className="nf-rail-scroll">
        {grouped.map(([phase, operations]) => {
          const meta = PHASE_ACCENTS[phase];
          return (
            <section className="nf-rail-group" key={phase} title={`${meta.label} — ${meta.description}`}>
              <span className="nf-rail-divider" style={{ color: meta.accent }} aria-hidden />
              <ul className="nf-rail-list">
                {operations.map(([label, config]) => {
                  const isActive = activeOperations.includes(label);
                  const visual = getOperationVisual(config.id);
                  const Icon = visual.icon;
                  return (
                    <li className="nf-rail-item" key={label}>
                      <button
                        type="button"
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.setData(OPERATION_DND_MIME, label);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => onAdd(label)}
                        onMouseEnter={event => showTooltip(event, label, config)}
                        onMouseLeave={hideTooltip}
                        onFocus={event => showTooltip(event, label, config)}
                        onBlur={hideTooltip}
                        disabled={isActive}
                        aria-label={`${label} — ${config.description}`}
                        className={`nf-rail-button${isActive ? ' is-active' : ''}`}
                      >
                        <span
                          className="nf-rail-icon"
                          style={{ '--nf-accent': meta.accent, '--nf-accent-soft': meta.soft } as React.CSSProperties}
                        >
                          {Icon ? <Icon className="nf-rail-glyph" strokeWidth={1.9} /> : (
                            <span className="nf-rail-glyph nf-rail-glyph-text">{visual.glyph ?? '•'}</span>
                          )}
                        </span>
                        {isActive && (
                          <span className="nf-rail-check" aria-hidden>
                            <Check strokeWidth={3.2} />
                          </span>
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

      <p className="nf-rail-footer">Click or drag onto canvas</p>

      {tooltip &&
        createPortal(
          <div
            className={`nf-rail-tooltip${tooltip.below ? ' nf-rail-tooltip--below' : ''}`}
            role="tooltip"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              ['--nf-accent' as string]: tooltip.accent,
            }}
          >
            <span className="nf-rail-tooltip-name">{tooltip.name}</span>
            <span className="nf-rail-tooltip-desc">{tooltip.description}</span>
            <span className="nf-rail-tooltip-hint">{tooltip.hint}</span>
          </div>,
          document.body,
        )}
    </nav>
  );
}
