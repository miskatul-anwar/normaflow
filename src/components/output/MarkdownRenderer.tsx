import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, CheckCircle } from 'lucide-react';
import 'github-markdown-css/github-markdown-light.css';
import { Button } from '@/components/ui/button';

interface MarkdownRendererProps {
  content: string;
  filename?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, filename = 'report.md' }: MarkdownRendererProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          {filename}
        </h4>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCopy}>
            {copied ? <CheckCircle className="text-teal-600" /> : <Copy />}
            {copied ? 'Copied!' : 'Copy Markdown'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownload}>
            <Download />
            Download MD
          </Button>
        </div>
      </div>
      <div className="p-8 markdown-body text-gray-800 font-sans overflow-auto max-h-[800px]">
        {/* Raw HTML is deliberately not enabled: reports embed text from untrusted CSV files. */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});
