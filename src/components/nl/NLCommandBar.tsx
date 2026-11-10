import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PlaceholdersAndVanishInput } from '../ui/placeholders-and-vanish-input';
import { dependencyClosure } from '../../services/nlp/workflow/planner';
import { extensionFor, type NLWorkflow } from '../../hooks/useNLWorkflow';

const PLACEHOLDERS = [
  'Convert it to 1NF',
  'Normalize to 3NF and generate SQL',
  'Clean the data',
  'Find the functional dependencies',
  'Give me a full report',
];

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
      <PlaceholdersAndVanishInput
        placeholders={PLACEHOLDERS}
        onChange={onChange}
        onSubmit={onSubmit}
        inputId={inputId}
        ariaLabel="Describe the pipeline you want (Ctrl+K)"
      />
      <div aria-live="polite" className="mt-1">
        {nl.busy && <p className="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-600 shadow">Working it out…</p>}

        {res && !nl.busy && (
          <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg" aria-label="Proposed pipeline">
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
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            dep ? 'bg-gray-100 text-gray-500' : 'bg-teal-100 text-teal-800'
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {nl.hasNodes ? (
                    <>
                      <button type="button" className="nf-nl-btn" onClick={() => nl.apply(res, { run: false, mode: 'replace' })}>
                        Replace workflow
                      </button>
                      <button
                        type="button"
                        className="nf-nl-btn"
                        disabled={!canExtend}
                        title={canExtend ? 'Append the missing steps' : 'The current workflow cannot simply be extended'}
                        onClick={() => nl.apply(res, { run: false, mode: 'extend' })}
                      >
                        Extend workflow
                      </button>
                    </>
                  ) : (
                    <button type="button" className="nf-nl-btn" onClick={() => nl.apply(res, { run: false })}>
                      Apply
                    </button>
                  )}
                  <button
                    type="button"
                    className="nf-nl-btn"
                    disabled={!nl.hasFiles}
                    title={nl.hasFiles ? 'Build the pipeline and run it' : 'Upload a CSV file first'}
                    onClick={() => nl.apply(res, { run: true, mode: nl.hasNodes && canExtend ? 'extend' : 'replace' })}
                  >
                    Apply &amp; Run
                  </button>
                  <button type="button" className="nf-nl-btn" onClick={nl.dismiss}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">{res.message ?? 'I could not understand that.'}</p>
                {res.candidates.length > 0 && res.confidence === 'low' && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {res.candidates.map(c => (
                      <button key={c.operation} type="button" className="nf-nl-btn" onClick={() => void nl.pickCandidate(c.operation)}>
                        {c.operation}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <button type="button" className="nf-nl-btn" onClick={nl.dismiss}>
                    Close
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
