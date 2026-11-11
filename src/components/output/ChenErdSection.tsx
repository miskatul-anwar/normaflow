import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildChenDot, attributeCount, type ChenRelation } from '../../services/erd/chenErd';
import { renderDot } from '../../services/erd/renderDot';
import { SVGPreviewSection } from './SVGPreviewSection';

interface Props {
  relations: ChenRelation[];
  /** Mermaid source, shown as the crow's-foot alternative. */
  erdContent: string;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChenErdSection({ relations, erdContent }: Props) {
  const [notation, setNotation] = useState<'chen' | 'crow'>('chen');
  const [showAttributes, setShowAttributes] = useState(() => attributeCount(relations) <= 80);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const dot = useMemo(() => buildChenDot(relations, { attributes: showAttributes }), [relations, showAttributes]);

  useEffect(() => {
    if (notation !== 'chen') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    renderDot(dot)
      .then(out => {
        if (!cancelled) setSvg(out);
      })
      .catch(e => {
        if (!cancelled) setError((e as Error)?.message ?? 'Could not draw the diagram');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dot, notation]);

  const tab = (id: 'chen' | 'crow', label: string) => (
    <Button size="sm" variant={notation === id ? 'primary' : 'secondary'} onClick={() => setNotation(id)} aria-pressed={notation === id}>
      {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="ER notation">
          {tab('chen', 'Chen')}
          {erdContent && tab('crow', "Crow's foot")}
        </div>
        {notation === 'chen' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={showAttributes} onChange={e => setShowAttributes(e.target.checked)} />
              Show attributes
            </label>
            <Button size="sm" onClick={() => void navigator.clipboard.writeText(dot)}>
              <Copy /> Copy DOT
            </Button>
            <Button size="sm" onClick={() => save(new Blob([dot], { type: 'text/vnd.graphviz' }), 'erd_chen.dot')}>
              <Download /> DOT
            </Button>
            <Button variant="primary" size="sm" disabled={!svg} onClick={() => save(new Blob([svg], { type: 'image/svg+xml' }), 'erd_chen.svg')}>
              <Download /> SVG
            </Button>
          </div>
        )}
      </div>

      {notation === 'crow' ? (
        <SVGPreviewSection erdContent={erdContent} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {error ? (
            <div className="flex items-center gap-2 p-6 text-sm text-red-700">
              <AlertCircle className="size-4" aria-hidden /> {error}
            </div>
          ) : loading && !svg ? (
            <div className="p-10 text-center text-sm text-gray-500">Drawing the diagram…</div>
          ) : (
            // Graphviz escapes all text; the labels are built from escaped CSV headers.
            <div className="max-h-[640px] min-h-[360px] overflow-auto p-4 [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <span>▭ entity (double border: weak)</span>
            <span>◇ relationship, 1 / N cardinality</span>
            <span>◯ attribute (underlined: key)</span>
            <span>Foreign-key columns appear as relationships; junction tables as N:M relationships</span>
          </div>
        </div>
      )}
    </div>
  );
}
