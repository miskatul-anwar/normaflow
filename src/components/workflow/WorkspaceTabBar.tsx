import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { MAX_TABS, type TabStatus, type WorkspaceTab } from '../../hooks/useWorkspaceTabs';

interface Props {
  tabs: WorkspaceTab[];
  activeId: string;
  status: Record<string, TabStatus>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * Browser-style tab strip: click to switch, double-click to rename, middle-click or × to close.
 * Confirming the loss of work is the caller's job (`onClose`).
 */
export function WorkspaceTabBar({ tabs, activeId, status, onSelect, onAdd, onClose, onRename }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
            className={`nf-tab${active ? ' is-active' : ''}`}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={`${tab.title} (double-click to rename)`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => {
              setDraft(tab.title);
              setEditing(tab.id);
            }}
            onAuxClick={e => {
              if (e.button === 1) onClose(tab.id);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(tab.id);
              if (e.key === 'F2') {
                setDraft(tab.title);
                setEditing(tab.id);
              }
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
