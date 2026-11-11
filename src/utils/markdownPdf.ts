/**
 * Markdown -> PDF, entirely in the browser (jsPDF). Used by the report's Download button.
 * Handles what the generated reports contain: headings, paragraphs, lists, GFM tables,
 * code blocks, quotes and rules. Inline styling is flattened to plain text.
 */
import { marked, type Token, type Tokens } from 'marked';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Built-in PDF fonts are WinAnsi only: map the symbols reports use, drop the rest.
const SYMBOLS: Record<string, string> = {
  '→': '->', '←': '<-', '✓': 'OK', '✔': 'OK', '✅': 'OK', '❌': 'X', '✗': 'X', '⚠': '!', '•': '-', '–': '-', '—': '-', '…': '...',
  '≥': '>=', '≤': '<=', '≠': '!=', '×': 'x', '“': '"', '”': '"', '‘': "'", '’': "'",
};

export function pdfSafe(text: string): string {
  return text
    .replace(/[^\t\n\r\x20-\xff]/gu, ch => SYMBOLS[ch] ?? '')
    .replace(/️/g, '');
}

/** Plain text of inline tokens (no markup, entities decoded). */
function inlineText(tokens: Token[] | undefined, fallback = ''): string {
  if (!tokens) return fallback;
  return tokens
    .map(t => {
      if ('tokens' in t && t.tokens && t.type !== 'code') return inlineText(t.tokens as Token[], (t as Tokens.Generic).text);
      if (t.type === 'br') return '\n';
      return (t as Tokens.Generic).text ?? (t as Tokens.Generic).raw ?? '';
    })
    .join('');
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function markdownToPdf(markdown: string, title = 'Report'): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (text: string, { size = 10, bold = false, mono = false, indent = 0, gap = 6, color = 30 } = {}) => {
    doc.setFont(mono ? 'courier' : 'helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(pdfSafe(decode(text)), width - indent) as string[];
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, margin + indent, y + size);
      y += lh;
    }
    y += gap;
  };

  const renderTokens = (tokens: Token[], indent = 0) => {
    for (const t of tokens) {
      switch (t.type) {
        case 'heading': {
          const size = [0, 20, 15, 12.5, 11, 10, 10][(t as Tokens.Heading).depth] ?? 10;
          y += (t as Tokens.Heading).depth <= 2 ? 6 : 2;
          write(inlineText((t as Tokens.Heading).tokens, t.raw), { size, bold: true, gap: 6, indent });
          if ((t as Tokens.Heading).depth <= 2) {
            doc.setDrawColor(210);
            doc.line(margin, y - 3, margin + width, y - 3);
            y += 4;
          }
          break;
        }
        case 'paragraph':
        case 'text':
          write(inlineText((t as Tokens.Paragraph).tokens, (t as Tokens.Paragraph).text), { indent });
          break;
        case 'list': {
          const list = t as Tokens.List;
          list.items.forEach((item, i) => {
            const bullet = list.ordered ? `${Number(list.start || 1) + i}.` : '-';
            const inner = item.tokens.filter(x => x.type !== 'list');
            write(`${bullet} ${inner.map(x => inlineText((x as Tokens.Paragraph).tokens, (x as Tokens.Paragraph).text)).join(' ')}`, { indent: indent + 10, gap: 2 });
            renderTokens(item.tokens.filter(x => x.type === 'list'), indent + 14);
          });
          y += 4;
          break;
        }
        case 'table': {
          const tbl = t as Tokens.Table;
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [tbl.header.map(c => pdfSafe(decode(inlineText(c.tokens, c.text))))],
            body: tbl.rows.map(r => r.map(c => pdfSafe(decode(inlineText(c.tokens, c.text))))),
            styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' },
            headStyles: { fillColor: [15, 118, 110] },
            alternateRowStyles: { fillColor: [247, 249, 250] },
          });
          y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
          break;
        }
        case 'code':
          write((t as Tokens.Code).text, { size: 8.5, mono: true, indent: indent + 6, gap: 8, color: 60 });
          break;
        case 'blockquote':
          renderTokens((t as Tokens.Blockquote).tokens, indent + 12);
          break;
        case 'hr':
          ensure(10);
          doc.setDrawColor(200);
          doc.line(margin, y + 3, margin + width, y + 3);
          y += 12;
          break;
        default:
          break; // space, html (never rendered: reports embed untrusted CSV text)
      }
    }
  };

  renderTokens(marked.lexer(markdown));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(pdfSafe(title), margin, doc.internal.pageSize.getHeight() - 24);
    doc.text(`${i} / ${pages}`, margin + width, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
  }
  return doc;
}

export function downloadMarkdownAsPdf(markdown: string, filename: string, title?: string): void {
  markdownToPdf(markdown, title ?? filename).save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
