/**
 * Spreadsheet input.
 *
 * Reads Microsoft Excel and OpenDocument/LibreOffice workbooks and turns every
 * visible, non-empty sheet into an in-memory CSV `File`. The rest of the
 * engine then sees ordinary CSV tables, so encoding, cleaning, FD mining and
 * multi-file relation detection need no spreadsheet-specific code.
 *
 * Formats (detected by SheetJS from the bytes, not trusted from the name):
 *   Excel      .xlsx .xlsm .xlsb .xltx .xltm .xlam   (2007+, OOXML / binary)
 *              .xls .xlt .xla .xlw                  (BIFF 2 - 8, 1987 - 2003)
 *              .xml                                 (SpreadsheetML 2003)
 *   OpenDoc    .ods .ots .fods                      (LibreOffice / OpenOffice)
 *
 * Rules:
 *   - One CSV per sheet. A workbook with one usable sheet keeps the book name
 *     (`sales.csv`); several sheets become `sales_Orders.csv`, `sales_Items.csv`.
 *   - Hidden and very-hidden sheets are skipped; empty sheets are skipped.
 *   - Cached formula results are used; formulas are never evaluated or run.
 *   - Dates become ISO 8601 (`2024-03-05`, `2024-03-05 14:30:00`, `14:30:00`).
 *     Numbers keep their stored value, not the display format (a 25% cell is 0.25).
 *   - Error cells (#N/A, #REF!, ...) become empty cells.
 *   - Merged cells keep their value in the top-left cell only.
 *   - Entirely empty columns are dropped.
 */

export const SPREADSHEET_EXTENSIONS = [
  'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm', 'xlam',
  'xls', 'xlt', 'xla', 'xlw',
  'ods', 'ots', 'fods',
] as const;

/** Value for an `<input type="file" accept>` attribute. */
export const INPUT_ACCEPT = ['.csv', ...SPREADSHEET_EXTENSIONS.map(e => `.${e}`), '.xml'].join(',');

/** Largest accepted workbook, same ceiling as CSV. */
const MAX_BYTES = 100 * 1024 * 1024;
/** Data rows read per sheet (plus the header row). */
const MAX_ROWS_PER_SHEET = 1_000_000;

const extOf = (name: string): string => {
  const m = /\.([^./\\]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
};

/** True for a file name with a spreadsheet extension (`.xml` is sniffed separately). */
export function isSpreadsheetName(name: string): boolean {
  return (SPREADSHEET_EXTENSIONS as readonly string[]).includes(extOf(name));
}

/** True for any file the pipeline can ingest: CSV or a spreadsheet. */
export function isSupportedInputName(name: string, mimeType = ''): boolean {
  const ext = extOf(name);
  return ext === 'csv' || ext === 'xml' || mimeType === 'text/csv' || isSpreadsheetName(name);
}

/** `.xml` is only a spreadsheet when it is Excel 2003 SpreadsheetML. */
async function isSpreadsheetXml(file: File): Promise<boolean> {
  if (extOf(file.name) !== 'xml') return false;
  const head = await file.slice(0, 4096).text();
  return head.includes('urn:schemas-microsoft-com:office:spreadsheet');
}

export async function isSpreadsheetFile(file: File): Promise<boolean> {
  return isSpreadsheetName(file.name) || (await isSpreadsheetXml(file));
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  // Excel's epoch is 1899-12-30: a time-only cell lands there.
  if (y < 1900) return time;
  const date = `${pad(y, 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return time === '00:00:00' ? date : `${date} ${time}`;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : formatDate(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // Excel keeps 15 significant digits; drop binary noise such as 0.30000000000000004.
    return String(Number.isInteger(v) ? v : Number(v.toPrecision(15)));
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function csvField(s: string): string {
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^_+|_+$/g, '') || 'sheet';

type Kind = 'binary' | 'xml' | 'text' | 'unknown';

/** Classifies the leading bytes: a real workbook container, XML, plain text, or junk. */
function sniff(b: Uint8Array): Kind {
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'binary'; // ZIP: xlsx xlsm xlsb ods
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'binary'; // OLE2: xls (BIFF8), encrypted OOXML
  if (b.length >= 2 && b[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(b[1])) return 'binary'; // BIFF2-5 BOF record
  const head = b.subarray(0, 4096);
  if (head.includes(0)) return 'unknown';
  let i = 0;
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) i = 3;
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x0a || head[i] === 0x0d || head[i] === 0x09)) i++;
  return head[i] === 0x3c ? 'xml' : 'text'; // '<'
}

export interface SpreadsheetConversion {
  files: File[];
  /** Human-readable notes: skipped sheets, truncation. */
  notes: string[];
}

export async function spreadsheetToCsvFiles(file: File): Promise<SpreadsheetConversion> {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name}: file exceeds the 100MB limit.`);
  }
  // Loaded on demand so the parser stays out of the startup bundle.
  const XLSX = await import('xlsx');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (kind === 'unknown') {
    throw new Error(`${file.name}: not a valid spreadsheet (the file is damaged or in an unsupported format).`);
  }
  if (kind === 'text') {
    // Text exported with a spreadsheet extension (e.g. tab-separated .xls): hand it to the CSV reader.
    const name = `${file.name.replace(/\.[^./\\]+$/, '')}.csv`;
    return { files: [new File([bytes], name, { type: 'text/csv' })], notes: [`${file.name}: contains delimited text, read as CSV.`] };
  }
  let wb;
  try {
    wb = XLSX.read(bytes, {
      type: 'array',
      cellDates: true,
      UTC: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      bookVBA: false, // macros are never read, let alone run
      sheetRows: MAX_ROWS_PER_SHEET + 1,
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/password|encrypt/i.test(msg)) {
      throw new Error(`${file.name}: the workbook is password-protected or encrypted. Remove the password and try again.`, { cause: e });
    }
    throw new Error(`${file.name}: could not read the spreadsheet (${msg}).`, { cause: e });
  }

  const base = file.name.replace(/\.[^./\\]+$/, '');
  const notes: string[] = [];
  const tables: Array<{ sheet: string; csv: string }> = [];

  wb.SheetNames.forEach((sheetName, i) => {
    const ws = wb.Sheets[sheetName];
    const hidden = wb.Workbook?.Sheets?.[i]?.Hidden ?? 0;
    if (hidden) {
      notes.push(`${file.name}: hidden sheet "${sheetName}" skipped.`);
      return;
    }
    if (!ws) return;

    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    if (grid.length === 0) {
      notes.push(`${file.name}: sheet "${sheetName}" is empty and was skipped.`);
      return;
    }

    const width = grid.reduce((m, r) => Math.max(m, r.length), 0);
    const used: number[] = [];
    for (let c = 0; c < width; c++) {
      if (grid.some(r => cellText(r[c]) !== '')) used.push(c);
    }
    const lines = grid.map(r => used.map(c => csvField(cellText(r[c]))).join(','));
    if (grid.length > MAX_ROWS_PER_SHEET) {
      notes.push(`${file.name}: sheet "${sheetName}" has more than ${MAX_ROWS_PER_SHEET.toLocaleString()} rows; only the first ${MAX_ROWS_PER_SHEET.toLocaleString()} are analysed.`);
      lines.length = MAX_ROWS_PER_SHEET + 1;
    }
    tables.push({ sheet: sheetName, csv: lines.join('\n') });
  });

  if (tables.length === 0) {
    throw new Error(`${file.name}: the workbook has no visible sheets with data.`);
  }

  const used = new Set<string>();
  const files = tables.map(({ sheet, csv }) => {
    let name = tables.length === 1 ? `${safe(base)}.csv` : `${safe(base)}_${safe(sheet)}.csv`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = name.replace(/(_\d+)?\.csv$/, `_${n}.csv`);
    used.add(name.toLowerCase());
    return new File([csv], name, { type: 'text/csv' });
  });
  return { files, notes };
}

/**
 * Replaces every spreadsheet in `files` with one CSV per sheet and leaves
 * other files untouched. Order is preserved.
 */
export async function expandSpreadsheets(
  files: File[],
  onNote?: (note: string) => void,
): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (await isSpreadsheetFile(f)) {
      const { files: sheets, notes } = await spreadsheetToCsvFiles(f);
      notes.forEach(n => onNote?.(n));
      out.push(...sheets);
    } else {
      out.push(f);
    }
  }
  return out;
}
