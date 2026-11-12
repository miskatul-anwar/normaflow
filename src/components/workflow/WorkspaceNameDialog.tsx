import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export const MAX_WORKSPACE_NAME = 40;

interface Props {
  /** "Name your workspace" on first launch, "New workspace" for the + button. */
  title: string;
  /** What the field starts with; typing replaces it. */
  suggestion: string;
  /** Names already in use, so the dialog can say so (it still allows them). */
  existing?: string[];
  confirmLabel?: string;
  /** Omit on first launch, where a workspace must exist. */
  onCancel?: () => void;
  onConfirm: (name: string) => void;
}

/**
 * Asks for a workspace name. Modal: focus starts in the field with the suggestion selected, Tab stays inside,
 * Enter creates, Escape cancels (where cancelling makes sense). The page behind is made inert.
 */
export function WorkspaceNameDialog({ title, suggestion, existing = [], confirmLabel = 'Create workspace', onCancel, onConfirm }: Props) {
  const [name, setName] = useState(suggestion);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // Keep the page behind out of reach of the keyboard and screen readers while the dialog is open.
    const root = document.getElementById('root');
    const siblings = root ? Array.from(root.children).filter(c => !c.contains(boxRef.current)) : [];
    siblings.forEach(s => s.setAttribute('inert', ''));
    return () => siblings.forEach(s => s.removeAttribute('inert'));
  }, []);

  const clean = name.trim().slice(0, MAX_WORKSPACE_NAME);
  const taken = existing.some(e => e.toLowerCase() === clean.toLowerCase());
  const submit = () => {
    if (clean) onConfirm(clean);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      const focusable = boxRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="nf-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onCancel?.()}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={hintId} className="nf-modal nf-fade-in" onKeyDown={onKeyDown}>
        <form
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <p id={hintId} className="mt-1 text-sm text-gray-600">
            Each workspace keeps its own files, pipeline and results. You can rename it later.
          </p>
          <label className="mt-4 block text-xs font-medium text-gray-600" htmlFor={`${titleId}-name`}>
            Workspace name
          </label>
          <input
            id={`${titleId}-name`}
            ref={inputRef}
            value={name}
            maxLength={MAX_WORKSPACE_NAME}
            onChange={e => setName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <p className="mt-1.5 min-h-4 text-xs text-gray-600" aria-live="polite">
            {!clean ? 'Give it a name to continue.' : taken ? 'Another workspace already has this name. You can still use it.' : ''}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!clean}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
