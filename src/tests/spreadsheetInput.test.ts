import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../services/api/databaseService';
import {
  expandSpreadsheets,
  isSpreadsheetFile,
  isSupportedInputName,
  spreadsheetToCsvFiles,
} from '../services/processors/spreadsheetProcessor';

const ORDERS = [
  ['order_id', 'customer_id', 'customer_name', 'amount', 'placed', 'paid'],
  [1, 10, 'Ann', 12.5, new Date(Date.UTC(2024, 2, 5)), true],
  [2, 10, 'Ann', 7, new Date(Date.UTC(2024, 2, 6, 14, 30)), false],
  [3, 11, 'Bob', 0.1 + 0.2, new Date(Date.UTC(2024, 2, 7)), true],
];

function book(sheets: Record<string, unknown[][]>, extra?: (wb: XLSX.WorkBook) => void) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name);
  }
  extra?.(wb);
  return wb;
}

function fileOf(wb: XLSX.WorkBook, bookType: XLSX.BookType, name: string): File {
  const bytes = XLSX.write(wb, { type: 'array', bookType, cellDates: true }) as ArrayBuffer;
  return new File([bytes], name);
}

const textOf = (f: File) => f.text();

describe('format detection', () => {
  it('accepts CSV and every spreadsheet extension', () => {
    for (const n of ['a.csv', 'a.xlsx', 'a.XLSM', 'a.xlsb', 'a.xls', 'a.xlt', 'a.ods', 'a.fods', 'a.ots', 'a.xltx', 'a.xml']) {
      expect(isSupportedInputName(n)).toBe(true);
    }
    expect(isSupportedInputName('a.pdf')).toBe(false);
    expect(isSupportedInputName('a.docx')).toBe(false);
  });

  it('treats .xml as a spreadsheet only when it is SpreadsheetML 2003', async () => {
    expect(await isSpreadsheetFile(new File(['<root/>'], 'x.xml'))).toBe(false);
    const wb = book({ S: [['a'], [1]] });
    expect(await isSpreadsheetFile(fileOf(wb, 'xlml', 'x.xml'))).toBe(true);
  });
});

describe('every Excel and LibreOffice format round-trips to the same CSV', () => {
  const formats: Array<[XLSX.BookType, string]> = [
    ['xlsx', 'o.xlsx'], ['xlsm', 'o.xlsm'], ['xlsb', 'o.xlsb'],
    ['xls', 'o.xls'], ['biff5', 'o5.xls'], ['xlml', 'o.xml'],
    ['ods', 'o.ods'], ['fods', 'o.fods'],
  ];

  for (const [type, name] of formats) {
    it(`${name} (${type})`, async () => {
      const { files } = await spreadsheetToCsvFiles(fileOf(book({ Orders: ORDERS }), type, name));
      expect(files).toHaveLength(1);
      const lines = (await textOf(files[0])).split('\n');
      expect(lines[0]).toBe('order_id,customer_id,customer_name,amount,placed,paid');
      expect(lines[1]).toBe('1,10,Ann,12.5,2024-03-05,true');
      expect(lines[2]).toBe('2,10,Ann,7,2024-03-06 14:30:00,false');
      expect(lines[3]).toBe('3,11,Bob,0.3,2024-03-07,true'); // float noise removed
    });
  }

  it('BIFF2 (Excel 2.x) .xls', async () => {
    const wb = book({ S: [['a', 'b'], [1, 'x'], [2, 'y']] });
    const { files } = await spreadsheetToCsvFiles(fileOf(wb, 'biff2', 'old.xls'));
    expect((await textOf(files[0])).split('\n')).toEqual(['a,b', '1,x', '2,y']);
  });
});

describe('sheet handling', () => {
  it('names a single sheet after the workbook, several sheets after book_sheet', async () => {
    const one = await spreadsheetToCsvFiles(fileOf(book({ Only: [['a'], [1]] }), 'xlsx', 'sales.xlsx'));
    expect(one.files.map(f => f.name)).toEqual(['sales.csv']);

    const many = await spreadsheetToCsvFiles(fileOf(book({ Orders: [['a'], [1]], 'Line Items': [['b'], [2]] }), 'xlsx', 'sales.xlsx'));
    expect(many.files.map(f => f.name)).toEqual(['sales_Orders.csv', 'sales_Line_Items.csv']);
  });

  it('skips hidden and empty sheets and says so', async () => {
    const wb = book({ Data: [['a'], [1]], Secret: [['b'], [2]], Blank: [] }, w => {
      w.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }, { Hidden: 0 }] };
    });
    const { files, notes } = await spreadsheetToCsvFiles(fileOf(wb, 'xlsx', 'w.xlsx'));
    expect(files.map(f => f.name)).toEqual(['w.csv']);
    expect(notes.join(' ')).toMatch(/hidden sheet "Secret"/);
    expect(notes.join(' ')).toMatch(/"Blank" is empty/);
  });

  it('rejects a workbook with nothing to read', async () => {
    await expect(spreadsheetToCsvFiles(fileOf(book({ Blank: [] }), 'xlsx', 'e.xlsx'))).rejects.toThrow(/no visible sheets with data/);
  });

  it('drops empty columns and blank rows, and starts at the first used cell', async () => {
    const rows = [[], ['', 'a', '', 'b'], [], ['', 1, '', 2]];
    const { files } = await spreadsheetToCsvFiles(fileOf(book({ S: rows }), 'xlsx', 'g.xlsx'));
    expect(await textOf(files[0])).toBe('a,b\n1,2');
  });

  it('quotes commas, quotes and line breaks', async () => {
    const rows = [['t'], ['a, b'], ['say "hi"'], ['line1\nline2']];
    const { files } = await spreadsheetToCsvFiles(fileOf(book({ S: rows }), 'xlsx', 'q.xlsx'));
    expect(await textOf(files[0])).toBe('t\n"a, b"\n"say ""hi"""\n"line1\nline2"');
  });

  it('keeps text ids with leading zeros and uses cached formula values', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['zip', 'n'], ['00123', 2]]);
    ws['C1'] = { t: 's', v: 'double' };
    ws['C2'] = { t: 'n', v: 4, f: 'B2*2' };
    ws['!ref'] = 'A1:C2';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const { files } = await spreadsheetToCsvFiles(fileOf(wb, 'xlsx', 'f.xlsx'));
    expect(await textOf(files[0])).toBe('zip,n,double\n00123,2,4');
  });

  it('turns error cells into empty cells', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]);
    ws['B2'] = { t: 'e', v: 0x2a, w: '#N/A' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const { files } = await spreadsheetToCsvFiles(fileOf(wb, 'xlsx', 'er.xlsx'));
    expect(await textOf(files[0])).toBe('a,b\n1,');
  });
});

describe('errors', () => {
  it('reports unreadable files by name', async () => {
    const bad = new File([new Uint8Array([1, 2, 3, 0, 5, 6, 7, 8])], 'broken.xlsx');
    await expect(spreadsheetToCsvFiles(bad)).rejects.toThrow(/broken\.xlsx: not a valid spreadsheet/);
  });

  it('rejects a truncated zip', async () => {
    const full = XLSX.write(book({ S: [['a'], [1]] }), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const cut = new File([full.slice(0, 60)], 'cut.xlsx');
    await expect(spreadsheetToCsvFiles(cut)).rejects.toThrow(/cut\.xlsx/);
  });

  it('reads tab-separated text saved as .xls through the CSV reader', async () => {
    const { files, notes } = await spreadsheetToCsvFiles(new File(['a\tb\n1\t2\n'], 'export.xls'));
    expect(files.map(f => f.name)).toEqual(['export.csv']);
    expect(notes[0]).toMatch(/read as CSV/);
    const res = await new DatabaseService().processFile(new File(['a\tb\n1\t2\n3\t4\n'], 'export.xls'), ['CSV Data Loader']);
    expect(res.success).toBe(true);
  });

  it('expandSpreadsheets leaves CSV untouched and keeps order', async () => {
    const c = new File(['a\n1'], 'x.csv', { type: 'text/csv' });
    const x = fileOf(book({ A: [['k'], [1]], B: [['k'], [1]] }), 'xlsx', 'w.xlsx');
    const out = await expandSpreadsheets([c, x]);
    expect(out.map(f => f.name)).toEqual(['x.csv', 'w_A.csv', 'w_B.csv']);
    expect(out[0]).toBe(c);
  });
});

describe('through the pipeline', () => {
  const OPS = ['CSV Data Loader', 'Data Cleaner', 'FD Miner', 'Key Discovery', '3NF', 'SQL Generator'];

  it('analyses a one-sheet .xlsx like the same CSV', async () => {
    const csvText = [
      'order_id,customer_id,customer_name,amount,placed,paid',
      '1,10,Ann,12.5,2024-03-05,true',
      '2,10,Ann,7,2024-03-06 14:30:00,false',
      '3,11,Bob,0.3,2024-03-07,true',
    ].join('\n');
    const viaCsv = await new DatabaseService().processFile(new File([csvText], 'orders.csv', { type: 'text/csv' }), OPS);
    const viaXlsx = await new DatabaseService().processFile(fileOf(book({ s: ORDERS }), 'xlsx', 'orders.xlsx'), OPS);
    expect(viaCsv.success).toBe(true);
    expect(viaXlsx.success).toBe(true);
    const sql = (r: typeof viaCsv) => String(r.outputFiles?.find(f => f.name.endsWith('.sql'))?.content ?? '').replace(/^-- Generated:.*$/m, '');
    expect(sql(viaCsv)).not.toBe('');
    expect(sql(viaXlsx)).toBe(sql(viaCsv));
  });

  it('treats each sheet of a workbook as a table and finds the foreign key between them', async () => {
    const customers = [['customer_id', 'name'], [10, 'Ann'], [11, 'Bob'], [12, 'Cy']];
    const orders = [['order_id', 'customer_id', 'total'], [1, 10, 5], [2, 10, 6], [3, 11, 7], [4, 12, 8]];
    const wb = book({ Customers: customers, Orders: orders });
    for (const [type, name] of [['xlsx', 'shop.xlsx'], ['xls', 'shop.xls'], ['ods', 'shop.ods']] as const) {
      const res = await new DatabaseService().processFiles([fileOf(wb, type, name)], [...OPS, 'Relation Detector']);
      expect(res.success, `${name}: ${res.error}`).toBe(true);
      const sql = String(res.outputFiles?.find(f => f.name.endsWith('.sql'))?.content ?? '');
      expect(sql).toMatch(/shop_customers/i);
      expect(sql).toMatch(/shop_orders/i);
      expect(sql).toMatch(/FOREIGN KEY/i);
    }
  });

  it('mixes spreadsheets and CSV in one run', async () => {
    const xlsx = fileOf(book({ s: [['customer_id', 'name'], [1, 'A'], [2, 'B']] }), 'xlsx', 'customers.xlsx');
    const orders = new File(['order_id,customer_id\n1,1\n2,1\n3,2'], 'orders.csv', { type: 'text/csv' });
    const res = await new DatabaseService().processFiles([xlsx, orders], OPS);
    expect(res.success).toBe(true);
  });
});
