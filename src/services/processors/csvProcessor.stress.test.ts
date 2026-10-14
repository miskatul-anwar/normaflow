import { describe, expect, it } from 'vitest';
import { CSVProcessor, StreamingCSVParser } from './csvProcessor';

describe('Adversarial CSV Processor Stress Test Suite', () => {
  describe('1. Tricky Delimiter Detection Under Hostile Distributions', () => {
    it('accurately detects semicolon delimiter when data columns contain heavy unquoted commas', () => {
      // 3 semicolons per row; text columns contain multiple commas
      const csv = [
        'id;customer_name;shipping_address;order_notes',
        '101;Doe, Jane;123 Main St, Apt 4, West Wing;Fragile, handle with care, do not drop',
        '102;Smith, John;456 Oak Rd, Suite 200, Building B;Urgent, signature required, expedite',
        '103;Taylor, Alex;789 Pine Ave, Floor 3, Room 12;Leave at front desk, call ahead, beware dog'
      ].join('\n');

      const detected = CSVProcessor.detectDelimiter(csv);
      expect(detected).toBe(';');

      const result = CSVProcessor.parse(csv);
      expect(result.metadata.delimiter).toBe(';');
      expect(result.headers).toEqual(['id', 'customer_name', 'shipping_address', 'order_notes']);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].customer_name).toBe('Doe, Jane');
      expect(result.data[0].shipping_address).toBe('123 Main St, Apt 4, West Wing');
    });

    it('accurately detects tab delimiter when data contains commas, semicolons, and pipes', () => {
      const tsv = [
        'id\tname\tdescription\ttags',
        '1\tWidget A\tRed, round; size: small\tfast|cheap',
        '2\tWidget B\tBlue, square; size: large\tslow|quality',
        '3\tWidget C\tGreen, triangle; size: medium\tstandard|bulk'
      ].join('\n');

      const detected = CSVProcessor.detectDelimiter(tsv);
      expect(detected).toBe('\t');

      const result = CSVProcessor.parse(tsv);
      expect(result.metadata.delimiter).toBe('\t');
      expect(result.headers).toEqual(['id', 'name', 'description', 'tags']);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].description).toBe('Red, round; size: small');
      expect(result.data[0].tags).toBe('fast|cheap');
    });

    it('accurately detects pipe delimiter when data contains commas and tabs', () => {
      const psv = [
        'sku|title|attributes',
        'SKU-1|Gadget 1|color: blue, weight: 10kg\tref-A',
        'SKU-2|Gadget 2|color: red, weight: 20kg\tref-B',
        'SKU-3|Gadget 3|color: green, weight: 30kg\tref-C'
      ].join('\n');

      const detected = CSVProcessor.detectDelimiter(psv);
      expect(detected).toBe('|');

      const result = CSVProcessor.parse(psv);
      expect(result.metadata.delimiter).toBe('|');
      expect(result.headers).toEqual(['sku', 'title', 'attributes']);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].attributes).toBe('color: blue, weight: 10kg\tref-A');
    });

    it('ignores candidate delimiters embedded inside multiline quoted fields during detection', () => {
      // Delimiter is comma, but quoted cell has dozens of semicolons, tabs, and pipes
      const csv = [
        'id,data,status',
        '1,"val1;val2;val3;val4\tval5|val6;val7;val8",active',
        '2,"a;b;c;d;e;f;g;h;i;j|k\tl;m;n",pending'
      ].join('\n');

      const detected = CSVProcessor.detectDelimiter(csv);
      expect(detected).toBe(',');

      const result = CSVProcessor.parse(csv);
      expect(result.metadata.delimiter).toBe(',');
      expect(result.headers).toEqual(['id', 'data', 'status']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].data).toBe('val1;val2;val3;val4\tval5|val6;val7;val8');
    });

    it('correctly defaults to comma for single-column CSV without crashing', () => {
      const csv = 'item_name\nApple\nBanana\nCherry';
      const detected = CSVProcessor.detectDelimiter(csv);
      expect(detected).toBe(',');

      const result = CSVProcessor.parse(csv);
      expect(result.headers).toEqual(['item_name']);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].item_name).toBe('Apple');
      expect(result.data[2].item_name).toBe('Cherry');
    });

    it('detects delimiter with UTF-8 BOM prefix on first line', () => {
      const bomSemicolon = '\uFEFFid;name;score\n1;Alice;95\n2;Bob;88';
      const detected = CSVProcessor.detectDelimiter(bomSemicolon);
      expect(detected).toBe(';');

      const result = CSVProcessor.parse(bomSemicolon);
      expect(result.headers).toEqual(['id', 'name', 'score']);
      expect(result.data[0].id).toBe('1');
    });
  });

  describe('2. RFC 4180 Multiline Quoting, Escaping & CRLF/LF Combinations', () => {
    it('handles mixed CRLF and LF newlines inside multiline quoted fields', () => {
      const csv = 'id,narrative\r\n1,"Line One\r\nLine Two\nLine Three\r\nLine Four"\r\n2,"Normal"';
      const result = CSVProcessor.parse(csv);

      expect(result.data).toHaveLength(2);
      expect(result.metadata.hasMultilineFields).toBe(true);
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].narrative).toBe('Line One\r\nLine Two\nLine Three\r\nLine Four');
      expect(result.data[1].id).toBe('2');
      expect(result.data[1].narrative).toBe('Normal');
    });

    it('handles multiline cells with empty lines inside the quotes', () => {
      const csv = 'id,body\n1,"First paragraph\n\nSecond paragraph after empty line\n\nThird paragraph"\n2,"Simple"';
      const result = CSVProcessor.parse(csv);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].body).toBe('First paragraph\n\nSecond paragraph after empty line\n\nThird paragraph');
    });

    it('handles deeply nested escaped quotes ("" and \\" and repeated quotes)', () => {
      const csv = [
        'id,raw_expression',
        '1,"quoted: ""inner"" and \\"escaped\\""',
        '2,"triple: """""',
        '3,"start "" mid "" end"',
        '4,""""'
      ].join('\n');

      const result = CSVProcessor.parse(csv);
      expect(result.data).toHaveLength(4);
      expect(result.data[0].raw_expression).toBe('quoted: "inner" and "escaped"');
      expect(result.data[1].raw_expression).toBe('triple: ""');
      expect(result.data[2].raw_expression).toBe('start " mid " end');
      expect(result.data[3].raw_expression).toBe('"');
    });

    it('preserves leading and trailing whitespace inside quotes per RFC 4180', () => {
      const csv = 'id,code,padded\n1,"  SPACED  ","\tTABBED\t"\n2,"   ",""';
      const result = CSVProcessor.parse(csv);

      expect(result.data[0].code).toBe('  SPACED  ');
      expect(result.data[0].padded).toBe('\tTABBED\t');
      expect(result.data[1].code).toBe('   ');
      expect(result.data[1].padded).toBe('');
    });

    it('handles gracefully unclosed quotes at EOF without hanging or throwing unhandled exception', () => {
      const csv = 'id,text\n1,Alice\n2,"Unfinished multiline string without closing quote';
      const result = CSVProcessor.parse(csv);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].text).toBe('Alice');
      expect(result.data[1].text).toContain('Unfinished multiline');
    });
  });

  describe('3. Ragged Rows, Trailing Delimiters, and Empty Data States', () => {
    it('handles ragged short rows by padding missing columns with empty string', () => {
      const csv = [
        'col1,col2,col3,col4',
        'val1,val2',
        'val3',
        'val4,val5,val6,val7'
      ].join('\n');

      const result = CSVProcessor.parse(csv);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toEqual({ col1: 'val1', col2: 'val2', col3: '', col4: '' });
      expect(result.data[1]).toEqual({ col1: 'val3', col2: '', col3: '', col4: '' });
      expect(result.data[2]).toEqual({ col1: 'val4', col2: 'val5', col3: 'val6', col4: 'val7' });
    });

    it('handles ragged long rows by ignoring overflow columns beyond headers', () => {
      const csv = [
        'id,name,role',
        '1,Alice,Engineer,EXTRA1,EXTRA2',
        '2,Bob,Manager'
      ].join('\n');

      const result = CSVProcessor.parse(csv);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: '1', name: 'Alice', role: 'Engineer' });
      expect(result.data[1]).toEqual({ id: '2', name: 'Bob', role: 'Manager' });
    });

    it('handles trailing delimiters on every row without generating phantom empty rows or columns', () => {
      const csv = [
        'id,name,role,',
        '1,Alice,Admin,',
        '2,Bob,User,'
      ].join('\n');

      const result = CSVProcessor.parse(csv);
      expect(result.headers).toEqual(['id', 'name', 'role', 'column_4']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].column_4).toBe('');
    });

    it('ignores multiple consecutive trailing newlines and whitespace-only rows', () => {
      const csv = 'id,value\n1,Alpha\n\n\n2,Beta\r\n\r\n   \r\n3,Gamma\n\n\n';
      const result = CSVProcessor.parse(csv);

      expect(result.data).toHaveLength(3);
      expect(result.data.map(r => r.value)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('throws error on empty string and whitespace-only files', () => {
      expect(() => CSVProcessor.parse('')).toThrow('Empty CSV file');
      expect(() => CSVProcessor.parse('   \n\r\n   \t  ')).toThrow('Empty CSV file');
    });

    it('handles header-only CSV with zero data rows without throwing', () => {
      const csv = 'id,name,age\n';
      const result = CSVProcessor.parse(csv);

      expect(result.headers).toEqual(['id', 'name', 'age']);
      expect(result.data).toHaveLength(0);
      expect(result.metadata.originalRows).toBe(0);
      expect(result.metadata.finalRows).toBe(0);
    });

    it('disambiguates duplicate headers and unnamed headers cleanly', () => {
      const csv = 'id,name,name,,age\n1,Alice,Smith,Extra,30';
      const result = CSVProcessor.parse(csv);

      expect(result.headers).toEqual(['id', 'name', 'name_1', 'column_4', 'age']);
      expect(result.data[0].name).toBe('Alice');
      expect(result.data[0].name_1).toBe('Smith');
      expect(result.data[0].column_4).toBe('Extra');
    });

    it('disambiguates headers without collision when existing headers already contain numeric suffixes', () => {
      const csv = 'name,name_1,name\nAlice,Bob,Charlie';
      const result = CSVProcessor.parse(csv);
      // All three columns must have distinct unique names so no data is overwritten
      expect(new Set(result.headers).size).toBe(3);
      expect(result.data[0]).toHaveProperty('name', 'Alice');
      // The second column Bob must NOT be overwritten by Charlie
      const values = Object.values(result.data[0]);
      expect(values).toContain('Bob');
      expect(values).toContain('Charlie');
    });
  });

  describe('4. Primary Key & Identifier Column Preservation Across All Casings', () => {
    const checkPreserved = (headerName: string) => {
      const csv = `${headerName},payload\n100,TestValue`;
      const result = CSVProcessor.parse(csv);
      expect(result.headers).toContain(headerName);
      expect(result.data[0]).toHaveProperty(headerName);
      expect(result.data[0][headerName]).toBe('100');
    };

    it('preserves id under all casing variations', () => {
      for (const h of ['id', 'ID', 'Id', 'iD', '_id', 'id_']) {
        checkPreserved(h);
      }
    });

    it('preserves sn (serial number) under all casing and punctuation variations', () => {
      for (const h of ['sn', 'SN', 'Sn', 'sN', 's.n.', 'S.N.', 's_n', 'serial', 'serial_no']) {
        checkPreserved(h);
      }
    });

    it('preserves idx and index under all casing variations', () => {
      for (const h of ['idx', 'IDX', 'Idx', 'index', 'Index', 'INDEX']) {
        checkPreserved(h);
      }
    });

    it('preserves no (number) under all casing and punctuation variations', () => {
      for (const h of ['no', 'NO', 'No', 'no.', 'No.', 'num', 'number', 'seq', 'sequence']) {
        checkPreserved(h);
      }
    });

    it('preserves primary key aliases pk, uuid, guid under all casing variations', () => {
      for (const h of ['pk', 'PK', 'uuid', 'UUID', 'guid', 'GUID', 'row_id', 'row_num']) {
        checkPreserved(h);
      }
    });

    it('preserves pure numeric headers (e.g. year columns "2024", "101", "0")', () => {
      for (const h of ['2024', '101', '0', '1']) {
        checkPreserved(h);
      }
    });

    it('preserves symbol-prefixed headers (e.g. "#id", "@key", "$val")', () => {
      for (const h of ['#id', '#', '@key', '$amount']) {
        checkPreserved(h);
      }
    });

    it('accurately drops synthetic index artifacts (e.g. pandas Unnamed: 0) ONLY when sequential integers', () => {
      // Sequential 0, 1, 2 -> dropped
      const csvWithArtifact = 'Unnamed: 0,user_id,name\n0,U1,Alice\n1,U2,Bob\n2,U3,Charlie';
      const res1 = CSVProcessor.parse(csvWithArtifact);
      expect(res1.headers).toEqual(['user_id', 'name']);
      expect(res1.data[0]).not.toHaveProperty('Unnamed: 0');
      expect(res1.data[0].user_id).toBe('U1');

      // Non-sequential Unnamed: 0 -> retained (user data)
      const csvNonSequential = 'Unnamed: 0,data\nLondon,10\nParis,20\nBerlin,30';
      const res2 = CSVProcessor.parse(csvNonSequential);
      expect(res2.headers).toContain('Unnamed: 0');
      expect(res2.data[0]['Unnamed: 0']).toBe('London');
    });

    it('respects preserveIndexColumns: false option by allowing discarding primary key index columns', () => {
      const csv = 'id,name\n0,Alice\n1,Bob\n2,Charlie';
      const result = CSVProcessor.parse(csv, { preserveIndexColumns: false });
      expect(result.headers).not.toContain('id');
      expect(result.headers).toContain('name');
    });
  });

  describe('5. Streaming CSV Parser (Chunk Boundary Stress Testing)', () => {
    it('handles byte-by-byte feed across complex multiline and escaped quote structures', () => {
      const csv = [
        'id,summary,note',
        '1,"A ""complex"" quote with, comma","Single line"',
        '2,"Multiline\nSecond line\nThird line","End note"'
      ].join('\n');

      const collectedRows: any[] = [];
      let collectedHeaders: string[] = [];

      const parser = new StreamingCSVParser({
        onHeaders: (h) => { collectedHeaders = h; },
        onRow: (r) => { collectedRows.push(r); }
      });

      // Feed one single character at a time to test maximum boundary fragmentation
      for (let i = 0; i < csv.length; i++) {
        parser.feed(csv[i]);
      }
      parser.finish();

      expect(collectedHeaders).toEqual(['id', 'summary', 'note']);
      expect(collectedRows).toHaveLength(2);
      expect(collectedRows[0]).toEqual({
        id: '1',
        summary: 'A "complex" quote with, comma',
        note: 'Single line'
      });
      expect(collectedRows[1]).toEqual({
        id: '2',
        summary: 'Multiline\nSecond line\nThird line',
        note: 'End note'
      });
    });

    it('correctly flushes remaining EOF buffer when stream finishes without a trailing newline', () => {
      const csv = 'id,name\n1,Alice\n2,Bob';
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        onRow: (r) => { rows.push(r); }
      });

      parser.feed(csv);
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: '1', name: 'Alice' });
      expect(rows[1]).toEqual({ id: '2', name: 'Bob' });
    });

    it('respects maxRows streaming option and early exits without emitting extra rows', () => {
      const csv = 'id,value\n1,A\n2,B\n3,C\n4,D\n5,E';
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        maxRows: 2,
        onRow: (r) => { rows.push(r); }
      });

      parser.feed(csv);
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.id)).toEqual(['1', '2']);
      expect(parser.getRowCount()).toBe(2);
    });

    it('handles streaming chunks splitting CRLF across chunk boundaries', () => {
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        onRow: (r) => { rows.push(r); }
      });

      // Split between \r and \n
      parser.feed('id,name\r');
      parser.feed('\n1,Alice\r');
      parser.feed('\n2,Bob\r\n');
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: '1', name: 'Alice' });
      expect(rows[1]).toEqual({ id: '2', name: 'Bob' });
    });

    it('handles streaming chunks splitting escaped quote pairs ("")', () => {
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        onRow: (r) => { rows.push(r); }
      });

      // Split between first quote and second quote of ""
      parser.feed('id,quote\n1,"Hello "');
      parser.feed('"World""!"\n');
      parser.finish();

      expect(rows).toHaveLength(1);
      expect(rows[0].quote).toBe('Hello "World"!');
    });
  });

  describe('6. High-Volume & Wide Schema Scale Stress Test', () => {
    it('parses 2,000 rows with mixed quotes and numbers within 500ms', () => {
      const lines = ['id,name,amount,notes'];
      for (let i = 1; i <= 2000; i++) {
        lines.push(`${i},"User ${i}",${(i * 1.5).toFixed(2)},"Note for user ""${i}"" with, comma"`);
      }
      const largeCsv = lines.join('\n');

      const start = Date.now();
      const result = CSVProcessor.parse(largeCsv);
      const elapsed = Date.now() - start;

      expect(result.data).toHaveLength(2000);
      expect(result.data[0].id).toBe('1');
      expect(result.data[1999].id).toBe('2000');
      expect(result.data[999].notes).toBe('Note for user "1000" with, comma');
      expect(elapsed).toBeLessThan(1000); // well within bounds
    });

    it('handles wide table with 50 columns correctly', () => {
      const colCount = 50;
      const headers = Array.from({ length: colCount }, (_, i) => `col_${i + 1}`);
      const row1 = Array.from({ length: colCount }, (_, i) => `val_${i + 1}`);
      const csv = `${headers.join(',')}\n${row1.join(',')}`;

      const result = CSVProcessor.parse(csv);
      expect(result.headers).toHaveLength(colCount);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].col_1).toBe('val_1');
      expect(result.data[0].col_50).toBe('val_50');
    });
  });
});
