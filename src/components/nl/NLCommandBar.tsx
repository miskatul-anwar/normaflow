import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { dependencyClosure } from '../../services/nlp/workflow/planner';
import { extensionFor, type NLWorkflow } from '../../hooks/useNLWorkflow';

const PLACEHOLDER = 'Describe a pipeline, e.g. “Convert it to 1NF”';

/**
 * Text box that turns a sentence into a pipeline: shows the plan as chips first,
 * then Apply / Apply & Run. Dimmed chips are dependencies added automatically.
 */
export function NLCommandBar({ nl, active = true }: { nl: NLWorkflow; active?: boolean }) {
  // Each workspace tab has its own bar, so ids must be unique per instance.
  const inputId = `nl-command-input-${useId().replace(/:/g, '')}`;
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const res = nl.resolution;

  // Ctrl/Cmd+K focuses the bar.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById(inputId)?.focus();
      } else if (e.key === 'Escape' && res) {
        nl.dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, inputId, nl, res]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    draftRef.current = e.target.value;
    setDraft(e.target.value);
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void nl.submit(draftRef.current || draft);
    },
    [nl, draft],
  );

  const canExtend = res && nl.hasNodes ? extensionFor(nl.placed, res.plan) !== null : false;

  return (
    <div className="absolute left-1/2 top-3 z-20 w-[min(720px,calc(100%-2rem))] -translate-x-1/2" role="search">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30"
      >
        <Sparkles className="ml-2 size-4 shrink-0 text-teal-600" aria-hidden />
        <input maxLength={1000}
          id={inputId}
          type="text"
          value={draft}
          onChange={onChange}
          placeholder={PLACEHOLDER}
          aria-label="Describe the pipeline you want (Ctrl+K)"
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        <Button type="submit" variant="primary" disabled={nl.busy || !draft.trim()} title="Build the pipeline (Enter)">
          <Send />
          <span className="hidden sm:inline">Build</span>
        </Button>
      </form>
      <div aria-live="polite">
        {nl.canUndoBuild && !res && !nl.busy && (
          <div className="mt-1.5 flex justify-end">
            <Button size="sm" onClick={nl.undoBuild} title="Restore the canvas as it was before the last build">
              Undo last build
            </Button>
          </div>
        )}
        {nl.busy && <p className="mt-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow">Working it out…</p>}

        {res && !nl.busy && (
          <section className="mt-1.5 rounded-lg border border-gray-200 bg-white p-3 shadow-lg" aria-label="Proposed pipeline">
            {res.plan.length > 0 ? (
              <>
                <p className="mb-2 text-xs text-gray-500">
                  “{nl.query}” → {res.plan.length} step{res.plan.length === 1 ? '' : 's'}
                  {res.confidence === 'medium' ? ' (best guess)' : ''}
                </p>
                <ol className="flex flex-wrap items-center gap-1.5" aria-label="Pipeline steps">
                  {res.plan.map((op, i) => {
                    const dep = res.addedAsDependencies.includes(op);
                    const needed = dep ? res.targets.find(t => dependencyClosure([t]).has(op)) : null;
                    return (
                      <li key={op} className="flex items-center gap-1.5">
                        {i > 0 && <span aria-hidden className="text-gray-300">→</span>}
                        <span
                          title={dep ? `Added because ${needed ?? 'a later step'} requires it` : 'You asked for this'}
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            dep ? 'bg-gray-100 text-gray-600' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {op}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {res.message && <p className="mt-2 text-xs text-amber-700">{res.message}</p>}
                {res.options.dialect && (
                  <p className="mt-1 text-xs text-gray-500">SQL dialect: {res.options.dialect}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {nl.hasNodes ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => nl.apply(res, { run: false, mode: 'replace' })}>
                        Replace workflow
                      </Button>
                      <Button
                        size="sm"
                        disabled={!canExtend}
                        title={canExtend ? 'Append the missing steps' : 'The current workflow cannot simply be extended'}
                        onClick={() => nl.apply(res, { run: false, mode: 'extend' })}
                      >
                        Extend workflow
                      </Button>
                    </>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => nl.apply(res, { run: false })}>
                      Apply
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={!nl.hasFiles}
                    title={nl.hasFiles ? 'Build the pipeline and run it' : 'Upload a data file first'}
                    onClick={() => nl.apply(res, { run: true, mode: nl.hasNodes && canExtend ? 'extend' : 'replace' })}
                  >
                    Apply &amp; Run
                  </Button>
                  <Button variant="ghost" size="sm" onClick={nl.dismiss}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">{res.message ?? 'I could not understand that.'}</p>
                {res.candidates.length > 0 && res.confidence === 'low' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {res.candidates.map(c => (
                      <Button key={c.operation} size="sm" onClick={() => void nl.pickCandidate(c.operation)}>
                        {c.operation}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={nl.dismiss}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
