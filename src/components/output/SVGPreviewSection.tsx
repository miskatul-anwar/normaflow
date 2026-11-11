import { useState, useEffect } from 'react';
import { Copy, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Mermaid is large, so it is loaded when a crow's-foot diagram is first drawn.
// Diagrams are built from untrusted CSV headers: never let Mermaid run scripts or raw HTML.
let mermaidReady: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  mermaidReady ??= import('mermaid').then(m => {
    m.default.initialize({ startOnLoad: false, securityLevel: 'strict' });
    return m.default;
  });
  return mermaidReady;
}

interface SVGPreviewSectionProps {
  erdContent: string;
}

export function SVGPreviewSection({ erdContent }: SVGPreviewSectionProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (erdContent) {
      generateSVGFromMermaid(erdContent);
    }
  }, [erdContent]);

  const generateSVGFromMermaid = async (content: string) => {
    try {
      setIsLoading(true);
      setError('');
      const uniqueId = `erd-preview-${Math.random().toString(36).substring(2, 9)}`;
      const mermaid = await loadMermaid();
      const { svg } = await mermaid.render(uniqueId, content);
      setSvgContent(svg);
      setIsLoading(false);
    } catch (err) {
      console.error('SVG generation error:', err);
      setError('Failed to generate SVG preview');
      setIsLoading(false);
    }
  };

  const downloadSVG = () => {
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'database_erd.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const copyToClipboard = () => {
    if (erdContent) {
      navigator.clipboard.writeText(erdContent);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Entity Relationship Diagram
          </h4>
        </div>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Generating SVG preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            ERD Preview - Error
          </h4>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-600 whitespace-pre-wrap">{erdContent}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Entity Relationship Diagram
          </h4>
          <div className="flex gap-2">
            <Button size="sm" onClick={copyToClipboard}>
              <Copy />
              Copy Code
            </Button>
            <Button variant="primary" size="sm" onClick={downloadSVG}>
              <Download />
              Download SVG
            </Button>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div
            className="w-full min-h-[400px] flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{ maxHeight: '600px', overflow: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}
