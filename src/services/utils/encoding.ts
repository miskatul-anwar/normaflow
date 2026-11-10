/**
 * Character-encoding detection for CSV input.
 *
 * Order: byte-order mark, UTF-16 without BOM (NUL-byte pattern), strict UTF-8
 * validation, then Windows-1252 as the fallback for legacy exports (Excel on
 * Windows writes it by default). A BOM is consumed by the decoder, so it never
 * ends up in the first header name.
 */

export type DetectedEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

const SNIFF_BYTES = 64 * 1024;

function validUtf8(bytes: Uint8Array): boolean {
  // A sample may end in the middle of a multi-byte character; allow up to 3 dangling bytes.
  for (let trim = 0; trim <= 3 && trim < bytes.length; trim++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytes.length - trim));
      return true;
    } catch {
      /* try with fewer trailing bytes */
    }
  }
  return false;
}

export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';

  const sample = bytes.subarray(0, Math.min(bytes.length, SNIFF_BYTES));
  if (sample.length >= 4) {
    // ASCII text in UTF-16 has a NUL in every other byte.
    let evenNul = 0;
    let oddNul = 0;
    for (let i = 0; i + 1 < sample.length; i += 2) {
      if (sample[i] === 0) evenNul++;
      if (sample[i + 1] === 0) oddNul++;
    }
    const pairs = Math.floor(sample.length / 2);
    if (oddNul / pairs > 0.3 && evenNul / pairs < 0.05) return 'utf-16le';
    if (evenNul / pairs > 0.3 && oddNul / pairs < 0.05) return 'utf-16be';
  }
  return validUtf8(sample) ? 'utf-8' : 'windows-1252';
}

/** A decoder for a file, chosen from its first bytes. */
export function createDecoder(firstBytes: Uint8Array): { decoder: TextDecoder; encoding: DetectedEncoding } {
  const encoding = detectEncoding(firstBytes);
  return { decoder: new TextDecoder(encoding), encoding };
}

export function decodeBytes(bytes: Uint8Array): { text: string; encoding: DetectedEncoding } {
  const { decoder, encoding } = createDecoder(bytes);
  return { text: decoder.decode(bytes), encoding };
}
