import { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import { Copy, Download, AlertCircle } from 'lucide-react';

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
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
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
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
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
          <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
            Entity Relationship Diagram
          </h4>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>
            <button
              onClick={downloadSVG}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download SVG
            </button>
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
