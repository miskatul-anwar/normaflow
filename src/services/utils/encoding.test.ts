import { describe, it, expect } from 'vitest';
import { detectEncoding, decodeBytes } from './encoding';
import { CSVProcessor } from '../processors/csvProcessor';

const utf16le = (s: string, bom = true) => {
  const out = new Uint8Array((s.length + (bom ? 1 : 0)) * 2);
  let o = 0;
  const put = (c: number) => { out[o++] = c & 255; out[o++] = c >> 8; };
  if (bom) put(0xfeff);
  for (const ch of s) put(ch.charCodeAt(0));
  return out;
};

describe('encoding detection', () => {
  it('reads UTF-8 with and without BOM and strips the BOM', () => {
    const plain = new TextEncoder().encode('name,city\nZoë,Köln\n');
    expect(detectEncoding(plain)).toBe('utf-8');
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...plain]);
    expect(decodeBytes(withBom).text.startsWith('name')).toBe(true);
  });

  it('decodes UTF-16 with and without a BOM', () => {
    expect(decodeBytes(utf16le('a,b\n1,2\n')).text).toBe('a,b\n1,2\n');
    const noBom = utf16le('a,b\n1,2\n', false);
    expect(detectEncoding(noBom)).toBe('utf-16le');
    expect(decodeBytes(noBom).text).toBe('a,b\n1,2\n');
  });

  it('falls back to Windows-1252 for legacy exports', () => {
    const latin = new Uint8Array([...'name,city\nJos'].map(c => c.charCodeAt(0)).concat([0xe9, 0x2c, 0x4b, 0xf6, 0x6c, 0x6e, 0x0a]));
    expect(detectEncoding(latin)).toBe('windows-1252');
    expect(decodeBytes(latin).text).toContain('José,Köln');
  });

  it('processFile parses a Windows-1252 file with correct characters', async () => {
    const bytes = new Uint8Array([...'name,city\n'].map(c => c.charCodeAt(0)).concat([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x2c, 0x58, 0x0a]));
    const res = await CSVProcessor.processFile(new File([bytes], 'x.csv'));
    expect(res.data[0].name).toBe('Müller');
  });
});
