import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Files, FolderOpen, Code, Table, FileText, Database, GitBranch, Image, Download, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { OutputFile } from '../../types';
import { Button, IconButton } from '@/components/ui/button';
import { useCopy } from '../../hooks/useCopy';

interface GeneratedFilesSectionProps {
  outputFiles: OutputFile[];
}

export function GeneratedFilesSection({ outputFiles }: GeneratedFilesSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const { copy } = useCopy();

  if (!outputFiles || outputFiles.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Files className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No output files generated</p>
        <p className="text-sm text-gray-400 mt-2">Files are created during the normalization process</p>
      </div>
    );
  }

  const categories = ['all', ...Array.from(new Set(outputFiles.map(f => f.category)))];
  const filteredFiles = selectedCategory === 'all'
    ? outputFiles
    : outputFiles.filter(f => f.category === selectedCategory);

  const getMimeType = (type: string) => {
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown',
      sql: 'application/sql',
      mermaid: 'text/plain',
      svg: 'image/svg+xml'
    };
    return mimeTypes[type] || 'text/plain';
  };

  const objectsToCSV = (rows: any[]): string => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const first = rows[0];
    if (typeof first !== 'object' || first === null) return String(rows.join('\n'));
    const headers = Object.keys(first);
    if (headers.length === 0) return '';
    const lines: string[] = [];
    lines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
    rows.forEach(row => {
      if (!row || typeof row !== 'object') return;
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '""';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      lines.push(values.join(','));
    });
    return lines.join('\n');
  };

  const getFileContentString = (file: OutputFile): string => {
    if (typeof file.content === 'string') return file.content;
    if (file.type === 'csv' && Array.isArray(file.content)) {
      return objectsToCSV(file.content);
    }
    return JSON.stringify(file.content, null, 2);
  };

  const downloadFile = (file: OutputFile) => {
    const content = getFileContentString(file);
    const blob = new Blob([content], { type: getMimeType(file.type) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'json': return <Code className="w-4 h-4" />;
      case 'csv': return <Table className="w-4 h-4" />;
      case 'markdown': return <FileText className="w-4 h-4" />;
      case 'sql': return <Database className="w-4 h-4" />;
      case 'mermaid': return <GitBranch className="w-4 h-4" />;
      case 'svg': return <Image className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatFileSize = (size?: number) => {
    if (!size) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Generated Files ({outputFiles.length})
        </h4>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:thin]" role="group" aria-label="Filter by category">
          {categories.map(category => (
            <Button
              key={category}
              size="sm"
              className="shrink-0"
              variant={selectedCategory === category ? 'primary' : 'secondary'}
              aria-pressed={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? 'All files' : category}
              <span className="text-xs opacity-80">
                {category === 'all' ? outputFiles.length : outputFiles.filter(f => f.category === category).length}
              </span>
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFiles.map((file, index) => (
            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getFileIcon(file.type)}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{file.name}</h5>
                      <p className="text-sm text-gray-500">{(file as any).description || file.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 whitespace-nowrap text-right text-sm text-gray-500">
                      <div>{file.type.toUpperCase()}</div>
                      <div>{formatFileSize(typeof file.content === 'string' ? file.content.length : 100)}</div>
                    </div>
                    <div className="flex gap-2">
                      <IconButton
                        variant="ghost"
                        size="icon-sm"
                        label={expandedFile === file.name ? `Hide preview of ${file.name}` : `Preview ${file.name}`}
                        aria-expanded={expandedFile === file.name}
                        icon={expandedFile === file.name ? <ChevronDown /> : <ChevronRight />}
                        onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
                      />
                      <IconButton
                        size="icon-sm"
                        label={`Download ${file.name}`}
                        icon={<Download />}
                        onClick={() => downloadFile(file)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedFile === file.name && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-200 bg-gray-50"
                  >
                    <div className="p-4">
                      <div className="bg-gray-900 rounded-lg overflow-hidden">
                        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                          <span className="text-sm text-gray-300 font-mono">{file.name}</span>
                          <IconButton
                            variant="ghost"
                            size="icon-sm"
                            className="text-gray-300 hover:bg-gray-700 hover:text-white"
                            label={copiedFile === file.name ? `Copied ${file.name}` : `Copy ${file.name}`}
                            icon={copiedFile === file.name ? <Check /> : <Copy />}
                            onClick={() => {
                              void copy(getFileContentString(file));
                              setCopiedFile(file.name);
                              setTimeout(() => setCopiedFile(c => (c === file.name ? null : c)), 1600);
                            }}
                          />
                        </div>
                        <div className="p-4 max-h-64 overflow-y-auto">
                          <pre className="text-sm text-gray-100 whitespace-pre-wrap">
                            {getFileContentString(file).substring(0, 1000) + (getFileContentString(file).length > 1000 ? '\n...\n[Content truncated]' : '')}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
