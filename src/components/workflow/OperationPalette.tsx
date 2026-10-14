/**
 * OperationPalette — circular icon rail for pipeline node creation.
 *
 * Supports dynamic multi-column layout adapting smoothly to the sidebar width,
 * full collapse/expand capability, and rich hover tooltips.
 */

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, RotateCcw } from 'lucide-react';
import { OPERATIONS } from '../../config/operations';
import { getOperationVisual, PHASE_ACCENTS } from '../../config/operationVisuals';
import type { OperationDefinition, PhaseType } from '../../types';

interface OperationPaletteProps {
  /** Present operations already on the canvas (shown as added). */
  activeOperations?: string[];
  onAdd: (label: string) => void;
  /** Current palette width in pixels (for dynamic responsive styling). */
  width?: number;
  /** Callback to collapse the sidebar */
  onCollapse?: () => void;
  /** Callback to reset sidebar width to default (84px) */
  onResetWidth?: () => void;
}

interface TooltipState {
  name: string;
  description: string;
  hint: string;
  accent: string;
  /** Fixed-viewport anchor: tooltip sits right or left of (x, y). */
  x: number;
  y: number;
  below: boolean;
  isLeft: boolean;
}

export function OperationPalette({
  activeOperations = [],
  onAdd,
  width = 84,
  onCollapse,
  onResetWidth,
}: OperationPaletteProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const isWide = width >= 120;

  const showTooltip = useCallback(
    (event: React.SyntheticEvent<HTMLButtonElement>, label: string, config: OperationDefinition) => {
      const meta = PHASE_ACCENTS[config.phase];
      const rect = event.currentTarget.getBoundingClientRect();
      const below = window.innerWidth <= 768;
      const fitsRight = rect.right + 260 < window.innerWidth;

      setTooltip({
        name: label,
        description: config.description,
        hint: activeOperations.includes(label)
          ? 'Already in workflow'
          : config.dependencies.length
            ? `Requires: ${config.dependencies.join(', ')}`
            : 'No dependencies',
        accent: meta.accent,
        x: below ? rect.left + rect.width / 2 : fitsRight ? rect.right + 12 : rect.left - 12,
        y: below ? rect.top - 10 : rect.top + rect.height / 2,
        below,
        isLeft: !below && !fitsRight,
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
      {onCollapse && (
        <div className={`nf-rail-header${isWide ? ' nf-rail-header--wide' : ''}`}>
          {isWide ? (
            <div className="nf-rail-header-title-box">
              <span className="nf-rail-header-title">Operations</span>
            </div>
          ) : (
            <div className="nf-rail-header-spacer" />
          )}

          <div className="nf-rail-header-actions">
            {isWide && onResetWidth && Math.abs(width - 84) > 2 && (
              <button
                type="button"
                onClick={onResetWidth}
                className="nf-rail-header-btn"
                title="Reset width to default"
                aria-label="Reset sidebar width"
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={onCollapse}
              className="nf-rail-header-btn nf-rail-header-collapse"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="nf-rail-scroll">
        {grouped.map(([phase, operations]) => {
          const meta = PHASE_ACCENTS[phase];
          return (
            <section className="nf-rail-group" key={phase} title={`${meta.label} — ${meta.description}`}>
              <div className={`nf-rail-group-header${isWide ? ' nf-rail-group-header--wide' : ''}`}>
                {isWide ? (
                  <>
                    <span
                      className="nf-rail-phase-tag"
                      style={{ color: meta.accent, backgroundColor: meta.soft }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="nf-rail-group-line"
                      style={{ backgroundColor: meta.accent }}
                      aria-hidden
                    />
                  </>
                ) : (
                  <span className="nf-rail-divider" style={{ color: meta.accent }} aria-hidden />
                )}
              </div>

              <ul className="nf-rail-list">
                {operations.map(([label, config]) => {
                  const isActive = activeOperations.includes(label);
                  const visual = getOperationVisual(config.id);
                  const Icon = visual.icon;
                  return (
                    <li className="nf-rail-item" key={label}>
                      <button
                        type="button"
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

      {tooltip &&
        createPortal(
          <div
            className={`nf-rail-tooltip${tooltip.below ? ' nf-rail-tooltip--below' : ''}${tooltip.isLeft ? ' nf-rail-tooltip--left' : ''}`}
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
