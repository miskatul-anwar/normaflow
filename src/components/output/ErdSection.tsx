import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, AlertCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildChenDot, attributeCount } from '../../services/erd/chenErd';
import { buildBarkerDot, buildUmlDot, type BoxRelation } from '../../services/erd/boxNotations';
import { renderDot } from '../../services/erd/renderDot';
import { SVGPreviewSection } from './SVGPreviewSection';

type Notation = 'chen' | 'crow' | 'barker' | 'uml';

const LABELS: Record<Notation, string> = { chen: 'Chen', crow: "Crow's foot", barker: 'Barker', uml: 'UML' };
const LEGEND: Record<Exclude<Notation, 'crow'>, string[]> = {
  chen: ['▭ entity (double border: weak)', '◇ relationship, 1 / M / N', '◯ attribute (underlined: key)'],
  barker: ['# unique identifier · * mandatory · o optional', 'dashed line: optional relationship', 'crow\'s foot: many (bar: part of the identifier)'],
  uml: ['+ attribute : type, «PK» / «FK»', 'multiplicity at each end: 1, 0..1, 0..*, 1..*', 'label: the foreign-key columns'],
};

interface Props {
  relations: BoxRelation[];
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

export function ErdSection({ relations, erdContent }: Props) {
  const [notation, setNotation] = useState<Notation>('chen');
  const [showAttributes, setShowAttributes] = useState(() => attributeCount(relations) <= 80);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const clampZoom = (z: number) => Math.min(6, Math.max(0.5, Math.round(z * 100) / 100));

  // Graphviz reports the natural size in points; small diagrams should not be stretched to the panel width.
  const naturalPx = useMemo(() => {
    const m = /<svg[^>]*\swidth="([\d.]+)pt"/.exec(svg);
    return m ? Math.round((Number(m[1]) * 4) / 3) : null;
  }, [svg]);

  const dot = useMemo(() => {
    if (notation === 'barker') return buildBarkerDot(relations, { attributes: showAttributes });
    if (notation === 'uml') return buildUmlDot(relations, { attributes: showAttributes });
    return buildChenDot(relations, { attributes: showAttributes });
  }, [relations, showAttributes, notation]);
  // Boxes lay out best top-down; Chen's many small shapes spread better with a force layout.
  const engine = notation === 'chen' ? 'neato' : 'dot';

  useEffect(() => {
    if (notation === 'crow') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    renderDot(dot, engine)
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
  }, [dot, notation, engine]);

  const tab = (id: Notation) => (
    <Button key={id} size="sm" variant={notation === id ? 'primary' : 'secondary'} onClick={() => setNotation(id)} aria-pressed={notation === id}>
      {LABELS[id]}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="ER notation">
          {(['chen', 'crow', 'barker', 'uml'] as const)
            .filter(n => n !== 'crow' || erdContent)
            .map(tab)}
        </div>
        {notation !== 'crow' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 bg-white" role="group" aria-label="Zoom">
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => clampZoom(z / 1.25))} aria-label="Zoom out" title="Zoom out"><ZoomOut /></Button>
              <button type="button" onClick={() => setZoom(1)} title="Fit to width" className="w-12 text-center text-xs tabular-nums text-gray-600 hover:text-gray-900">{Math.round(zoom * 100)}%</button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => clampZoom(z * 1.25))} aria-label="Zoom in" title="Zoom in"><ZoomIn /></Button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(1)} aria-label="Fit to width" title="Fit to width"><Maximize2 /></Button>
            </div>
            <label className="mr-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={showAttributes} onChange={e => setShowAttributes(e.target.checked)} />
              Show attributes
            </label>
            <Button size="sm" onClick={() => void navigator.clipboard.writeText(dot)}>
              <Copy /> Copy DOT
            </Button>
            <Button size="sm" onClick={() => save(new Blob([dot], { type: 'text/vnd.graphviz' }), `erd_${notation}.dot`)}>
              <Download /> DOT
            </Button>
            <Button variant="primary" size="sm" disabled={!svg} onClick={() => save(new Blob([svg], { type: 'image/svg+xml' }), `erd_${notation}.svg`)}>
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
            <div
              className="nf-fade-in max-h-[640px] min-h-[360px] overflow-auto p-4"
              onWheel={e => {
                if (e.ctrlKey || e.metaKey) setZoom(z => clampZoom(e.deltaY < 0 ? z * 1.1 : z / 1.1));
              }}
            >
              <div style={{ width: naturalPx ? `min(${zoom * 100}%, ${Math.round(naturalPx * zoom)}px)` : `${zoom * 100}%` }} className="mx-auto transition-[width] duration-150 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            {LEGEND[notation].map(l => <span key={l}>{l}</span>)}
            <span>Ctrl + scroll to zoom</span>
          </div>
        </div>
      )}
    </div>
  );
}
