import React from 'react';
import { PHASE_ACCENTS } from '../../config/operationVisuals';

/** Which section of the sidebar an item belongs to (same grouping style as the operations palette). */
export type SidebarGroup = 'summary' | 'analysis' | 'generated';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** One line under the label, like the operations palette. */
  description?: string;
  count?: number;
  hasData?: boolean;
  group?: SidebarGroup;
}

export interface CustomSidebarProps {
  items: SidebarItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const GROUPS: Array<{ id: SidebarGroup; label: string; accent: keyof typeof PHASE_ACCENTS }> = [
  { id: 'summary', label: 'Summary', accent: 'PREP' },
  { id: 'analysis', label: 'Analysis', accent: 'ANALYZE' },
  { id: 'generated', label: 'Generated', accent: 'OUTPUT' },
];

/**
 * Results navigation. Mirrors the operations palette on the pipeline page: a titled header,
 * grouped sections with a coloured dot, and rows with a tinted icon tile, name and one-line description.
 */
export function CustomSidebar({ items, activeTab, onTabChange }: CustomSidebarProps) {
  const available = items.filter(i => i.hasData).length;

  return (
    <nav className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]" aria-label="Results" data-testid="results-sidebar">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-gray-200 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-gray-900">Results</h2>
        <span className="text-xs tabular-nums text-gray-500" aria-label={`${available} of ${items.length} sections have data`}>
          {available}/{items.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {GROUPS.map(group => {
          const groupItems = items.filter(i => (i.group ?? 'analysis') === group.id);
          if (groupItems.length === 0) return null;
          const meta = PHASE_ACCENTS[group.accent];
          return (
            <section key={group.id} aria-label={group.label} className="mt-2 first:mt-0">
              <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-slate-50 px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <span className="size-2 rounded-full" style={{ backgroundColor: meta.accent }} aria-hidden />
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {groupItems.map(item => {
                  const active = activeTab === item.id;
                  const enabled = Boolean(item.hasData);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onTabChange(item.id)}
                        disabled={!enabled}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'group relative flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                          active ? 'bg-teal-50 ring-1 ring-teal-300' : enabled ? 'hover:bg-gray-100' : 'cursor-not-allowed opacity-50',
                        ].join(' ')}
                      >
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4"
                          style={{ backgroundColor: meta.soft, color: meta.accent }}
                          aria-hidden
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-medium ${active ? 'text-teal-800' : 'text-gray-900'}`}>{item.label}</span>
                          <span className="block truncate text-xs text-gray-500">{enabled ? item.description : 'No data'}</span>
                        </span>
                        {enabled && item.count !== undefined && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                              active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.count}
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
    </nav>
  );
}
