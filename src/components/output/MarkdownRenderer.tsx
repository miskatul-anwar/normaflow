import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Download, CheckCircle } from 'lucide-react';
import 'github-markdown-css/github-markdown-light.css';

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
          <button
            onClick={handleCopy}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            onClick={handleDownload}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download MD
          </button>
        </div>
      </div>
      <div className="p-8 markdown-body text-gray-800 font-sans overflow-auto max-h-[800px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});
