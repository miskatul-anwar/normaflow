import { describe, it, expect } from 'vitest';
import { markdownToPdf, pdfSafe } from './markdownPdf';
import { mineFunctionalDependencies } from '../services/processors/fdMiner';

describe('markdown to PDF', () => {
  const md = '# Title\n\nSome **bold** text with `code`.\n\n- a\n- b\n\n| A | B |\n|---|---|\n| 1 → 2 | ✅ |\n\n```sql\nCREATE TABLE t (id INT);\n```\n\n<script>alert(1)</script>\n';
  it('produces a valid multi-element PDF', () => {
    const doc = markdownToPdf(md, 'Test');
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
  it('paginates long reports', () => {
    const doc = markdownToPdf(Array.from({ length: 300 }, (_, i) => `Line ${i}`).join('\n\n'));
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });
  it('maps symbols to the PDF-safe subset', () => {
    expect(pdfSafe('a → b ✅ 日本')).toBe('a -> b OK ');
  });
});

describe('partition cache statistics', () => {
  it('are measured, not invented', () => {
    const data = Array.from({ length: 60 }, (_, i) => ({ id: i, g: i % 6, h: (i % 6) * 2, v: i % 7 }));
    const r = mineFunctionalDependencies(data);
    const c = r.partitionCache!;
    expect(c.hits + c.misses).toBeGreaterThan(0);
    expect(c.hits / (c.hits + c.misses)).toBeGreaterThan(0);
    expect(c.hits / (c.hits + c.misses)).toBeLessThanOrEqual(1);
  });
});
