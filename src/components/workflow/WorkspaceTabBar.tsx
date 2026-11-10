import { useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, X } from 'lucide-react';
import { MAX_TABS, type TabStatus, type WorkspaceTab } from '../../hooks/useWorkspaceTabs';
import { activeSurface, inactiveSurface, isHexColor, TAB_COLOR_PRESETS } from '../../utils/tabColors';

interface Props {
  tabs: WorkspaceTab[];
  activeId: string;
  status: Record<string, TabStatus>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Set a tab's colour (`#rrggbb`) or clear it with null. */
  onColor: (id: string, color: string | null) => void;
}

/**
 * Browser-style tab strip: click to switch; rename with the pencil, double-click, F2 or the right-click menu; colour with the dot; middle-click or × to close.
 * Confirming the loss of work is the caller's job (`onClose`).
 */
export function WorkspaceTabBar({ tabs, activeId, status, onSelect, onAdd, onClose, onRename, onColor }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Dismiss the context menu on any outside click, scroll or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const [picker, setPicker] = useState<{ id: string; x: number; y: number } | null>(null);

  // The colour popover closes on outside click, scroll or Escape (clicks inside it are stopped).
  useEffect(() => {
    if (!picker) return;
    const close = () => setPicker(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [picker]);

  const startRename = (tab: WorkspaceTab) => {
    setMenu(null);
    setDraft(tab.title);
    setEditing(tab.id);
  };

  const commit = () => {
    if (editing) onRename(editing, draft);
    setEditing(null);
  };

  return (
    <div className="nf-tabbar" role="tablist" aria-label="Workspaces">
      {tabs.map(tab => {
        const active = tab.id === activeId;
        const running = status[tab.id]?.running;
        return (
          <div
            key={tab.id}
            className={`nf-tab${active ? ' is-active' : ''}${tab.color ? ' has-color' : ''}`}
            style={
              {
                '--tab-accent': tab.color ?? 'transparent',
                '--tab-bg': active ? activeSurface(tab.color) : inactiveSurface(tab.color),
              } as React.CSSProperties
            }
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={`${tab.title} (double-click or F2 to rename, right-click for more)`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => startRename(tab)}
            onContextMenu={e => {
              e.preventDefault();
              onSelect(tab.id);
              setMenu({ id: tab.id, x: e.clientX, y: e.clientY });
            }}
            onAuxClick={e => {
              if (e.button === 1) onClose(tab.id);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(tab.id);
              if (e.key === 'F2') startRename(tab);
            }}
          >
            {running && <Loader2 size={12} className="nf-tab-spinner" aria-label="Running" />}
            {editing === tab.id ? (
              <input
                ref={inputRef}
                className="nf-tab-input"
                value={draft}
                maxLength={40}
                aria-label="Workspace name"
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span className="nf-tab-title">{tab.title}</span>
            )}
            {editing !== tab.id && (
              <button
                type="button"
                className={`nf-tab-color${tab.color ? ' is-set' : ''}`}
                aria-label={`Color ${tab.title}`}
                title="Tab color"
                onClick={e => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  setPicker({ id: tab.id, x: r.left, y: r.bottom + 6 });
                }}
              >
                <span className="nf-tab-dot" style={{ background: tab.color ?? 'transparent' }} />
              </button>
            )}
            {editing !== tab.id && (
              <button
                type="button"
                className="nf-tab-rename"
                aria-label={`Rename ${tab.title}`}
                title="Rename"
                onClick={e => {
                  e.stopPropagation();
                  startRename(tab);
                }}
              >
                <Pencil size={11} />
              </button>
            )}
            <button
              type="button"
              className="nf-tab-close"
              aria-label={`Close ${tab.title}`}
              onClick={e => {
                e.stopPropagation();
                onClose(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {picker && (
        <div
          className="nf-tab-picker"
          role="dialog"
          aria-label="Tab color"
          style={{ left: picker.x, top: picker.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="nf-tab-swatches">
            {TAB_COLOR_PRESETS.map(c => {
              const current = tabs.find(t => t.id === picker.id)?.color;
              return (
                <button
                  key={c.value}
                  type="button"
                  className="nf-swatch"
                  style={{ background: c.value }}
                  aria-label={c.name}
                  title={c.name}
                  aria-pressed={current?.toLowerCase() === c.value}
                  onClick={() => {
                    onColor(picker.id, c.value);
                    setPicker(null);
                  }}
                />
              );
            })}
          </div>
          <div className="nf-tab-picker-row">
            <label>
              Custom
              <input
                type="color"
                aria-label="Custom color"
                value={isHexColor(tabs.find(t => t.id === picker.id)?.color) ? (tabs.find(t => t.id === picker.id)!.color as string) : '#0d9488'}
                onChange={e => onColor(picker.id, e.target.value)}
              />
            </label>
            <button
              type="button"
              className="nf-tab-picker-none"
              onClick={() => {
                onColor(picker.id, null);
                setPicker(null);
              }}
            >
              None
            </button>
          </div>
        </div>
      )}
      {menu && (
        <div
          className="nf-tab-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              const t = tabs.find(x => x.id === menu.id);
              if (t) startRename(t);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPicker({ id: menu.id, x: menu.x, y: menu.y });
              setMenu(null);
            }}
          >
            Color…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              onClose(menu.id);
            }}
          >
            Close
          </button>
        </div>
      )}
      <button
        type="button"
        className="nf-tab-add"
        onClick={onAdd}
        disabled={tabs.length >= MAX_TABS}
        aria-label="New workspace"
        title={tabs.length >= MAX_TABS ? `At most ${MAX_TABS} workspaces` : 'New workspace (Ctrl/Cmd+T)'}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
