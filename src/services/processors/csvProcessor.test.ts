import { describe, expect, it } from 'vitest';
import { CSVProcessor, StreamingCSVParser } from './csvProcessor';

// Helper to create a File object in Node 18+ / Vitest
const makeFile = (content: string, name = 'test.csv'): File => {
  return new File([content], name, { type: 'text/csv' });
};

describe('CSVProcessor', () => {
  describe('Primary Key / Identifier Preservation (BUG-ING-01)', () => {
    it('preserves id column and does not discard it', async () => {
      const csv = 'id,name,role\n1,Alice,Admin\n2,Bob,User';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0].id).toBe('1');
      expect(result.data[1].id).toBe('2');
    });

    it('preserves uppercase ID column', async () => {
      const csv = 'ID,code\n101,A1\n102,B2';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('ID');
      expect(result.data[0].ID).toBe('101');
    });

    it('preserves sn (serial number) column', async () => {
      const csv = 'sn,model,price\nSN-001,Laptop,999\nSN-002,Mouse,25';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('sn');
      expect(result.data[0].sn).toBe('SN-001');
    });

    it('preserves no (item/invoice number) column', async () => {
      const csv = 'no,description,qty\n1001,Screw,50\n1002,Nut,100';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('no');
      expect(result.data[0].no).toBe('1001');
    });

    it('preserves idx column', async () => {
      const csv = 'idx,value\n0,first\n1,second';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('idx');
      expect(result.data[0].idx).toBe('0');
    });

    it('drops only synthetic unnamed index columns if present', async () => {
      const csv = 'Unnamed: 0,id,name\n0,1,Alice\n1,2,Bob';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).not.toHaveProperty('Unnamed: 0');
    });
  });

  describe('RFC 4180 Multiline Quoted Fields (BUG-ING-02)', () => {
    it('handles multiline cells with embedded LF newlines', async () => {
      const csv = 'id,notes\n1,"Line 1\nLine 2"\n2,"Single line"';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].notes).toBe('Line 1\nLine 2');
      expect(result.data[1].id).toBe('2');
      expect(result.data[1].notes).toBe('Single line');
    });

    it('handles multiline cells with embedded CRLF newlines', async () => {
      const csv = 'id,notes\r\n1,"Line 1\r\nLine 2\r\nLine 3"\r\n2,"Normal"';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0].notes).toContain('Line 1');
      expect(result.data[0].notes).toContain('Line 2');
      expect(result.data[1].notes).toBe('Normal');
    });

    it('handles multiline cells with commas and quotes inside', async () => {
      const csv = 'id,address\n1,"Apt 4B,\n123 Main St,\nSpringfield"\n2,"456 Oak Ave"';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0].address).toBe('Apt 4B,\n123 Main St,\nSpringfield');
      expect(result.data[1].address).toBe('456 Oak Ave');
    });
  });

  describe('Escaped Quotes (BUG-ING-06)', () => {
    it('handles doubled quotes inside quoted field', async () => {
      const csv = 'id,quote\n1,"He said ""Hello"" to everyone"\n2,"Simple"';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0].quote).toBe('He said "Hello" to everyone');
      expect(result.data[1].quote).toBe('Simple');
    });

    it('handles backslash-escaped quotes inside quoted field', async () => {
      const csv = 'id,quote\n1,"She replied \\"Yes\\" immediately"\n2,"Plain"';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0].quote).toBe('She replied "Yes" immediately');
    });

    it('handles field consisting solely of quotes', async () => {
      const csv = 'id,symbol\n1,""""\n2,""""""';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0].symbol).toBe('"');
      expect(result.data[1].symbol).toBe('""');
    });
  });

  describe('Delimiter Auto-Detection (BUG-ING-03)', () => {
    it('auto-detects semicolon delimiter', async () => {
      const csv = 'id;name;department\n1;Hans;Engineering\n2;Greta;Design';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: '1', name: 'Hans', department: 'Engineering' });
    });

    it('auto-detects tab delimiter (TSV)', async () => {
      const csv = 'id\tname\tdepartment\n1\tAlice\tMarketing\n2\tBob\tSales';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: '1', name: 'Alice', department: 'Marketing' });
    });

    it('auto-detects pipe delimiter', async () => {
      const csv = 'id|title|status\n1|Report|DONE\n2|Audit|PENDING';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ id: '1', title: 'Report', status: 'DONE' });
    });

    it('detects semicolon delimiter even when cells contain quoted commas', async () => {
      const csv = 'id;address;city\n1;"123 Main St, Apt 4";Chicago\n2;"56 Oak Rd, Suite 2";Dallas';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0].address).toBe('123 Main St, Apt 4');
      expect(result.data[0].city).toBe('Chicago');
    });

    it('allows explicit delimiter override via options', () => {
      const csv = 'a;b\n1;2';
      const result = CSVProcessor.parse(csv, { delimiter: ';' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({ a: '1', b: '2' });
    });
  });

  describe('Byte Order Mark (BOM) Stripping (BUG-ING-07)', () => {
    it('strips UTF-8 BOM from header line', async () => {
      const csv = '\uFEFFid,name\n1,Alice\n2,Bob';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).not.toHaveProperty('\uFEFFid');
      expect(result.data[0].id).toBe('1');
    });
  });

  describe('Significant Whitespace in Quoted Fields (BUG-ING-04)', () => {
    it('preserves leading and trailing spaces inside quoted fields', async () => {
      const csv = 'id,text\n1," padded "\n2,"   "';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0].text).toBe(' padded ');
      expect(result.data[1].text).toBe('   ');
    });
  });

  describe('Duplicate Header Disambiguation (BUG-ING-08)', () => {
    it('disambiguates duplicate column headers without overwriting earlier columns', async () => {
      const csv = 'name,score,name\nAlice,90,Smith\nBob,80,Jones';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Alice');
      expect(result.data[0].score).toBe('90');
      // Second 'name' disambiguated with suffix
      expect(result.data[0].name_1 ?? result.data[0].name_2).toBe('Smith');
    });
  });

  describe('Edge Cases, Empty Files, and Metadata', () => {
    it('throws informative error on empty CSV file', async () => {
      await expect(CSVProcessor.processFile(makeFile(''))).rejects.toThrow();
      await expect(CSVProcessor.processFile(makeFile('   \n  \n  '))).rejects.toThrow();
    });

    it('handles CSV with trailing newlines without creating phantom rows', async () => {
      const csv = 'id,name\n1,Alice\n2,Bob\n\n\n';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data).toHaveLength(2);
    });

    it('populates accurate metadata', async () => {
      const csv = 'id,name,role\n1,Alice,Dev\n2,Bob,QA';
      const result = await CSVProcessor.processFile(makeFile(csv, 'users.csv'));
      expect(result.metadata.fileName).toBe('users.csv');
      expect(result.metadata.finalRows).toBe(2);
      expect(result.metadata.finalColumns).toBe(3);
    });

    it('fills missing columns with empty string on ragged short rows', async () => {
      const csv = 'a,b,c\n1,2\n3,4,5';
      const result = await CSVProcessor.processFile(makeFile(csv));
      expect(result.data[0].a).toBe('1');
      expect(result.data[0].b).toBe('2');
      expect(result.data[0].c).toBe('');
      expect(result.data[1].c).toBe('5');
    });
  });

  describe('StreamingCSVParser (BUG-ING-05)', () => {
    it('handles chunk boundaries inside quoted fields containing commas', () => {
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        onRow: (row) => rows.push(row)
      });

      const chunk1 = 'id,name,address\n1,Alice,"123 Main';
      const chunk2 = ' St, Apt 4"\n2,Bob,"456 Elm Ave"\n';

      parser.feed(chunk1);
      parser.feed(chunk2);
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        id: '1',
        name: 'Alice',
        address: '123 Main St, Apt 4'
      });
      expect(rows[1]).toEqual({
        id: '2',
        name: 'Bob',
        address: '456 Elm Ave'
      });
    });

    it('preserves EOF buffer when file has no trailing newline', () => {
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        onRow: (row) => rows.push(row)
      });

      const chunk = 'id,name\n1,Alice\n2,Bob';
      parser.feed(chunk);
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Alice');
      expect(rows[1].name).toBe('Bob');
    });

    it('supports streaming with semicolon delimiter', () => {
      const rows: any[] = [];
      const parser = new StreamingCSVParser({
        delimiter: ';',
        onRow: (row) => rows.push(row)
      });

      parser.feed('id;code;desc\n1;A1;Widget\n2;B2;Gadget\n');
      parser.finish();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: '1', code: 'A1', desc: 'Widget' });
    });
  });
});

describe('delimiter detection with escaped quotes', () => {
  it('is not fooled by delimiter-like characters after an escaped quote inside a quoted field', () => {
    // One escaped quote ("") and then lots of | ; and tab characters, as in text exported from a BLOB column.
    const blob = `b'\\xff ""' ` + '| ; \t '.repeat(300);
    const text = `id,name,desc,picture\r\n1,Beverages,"Soft drinks, teas","${blob}"\r\n2,Condiments,"Sweet and savory","${blob}"\r\n`;
    expect(CSVProcessor.detectDelimiter(text)).toBe(',');
    const parsed = CSVProcessor.parse(text);
    expect(parsed.headers).toEqual(['id', 'name', 'desc', 'picture']);
    expect(parsed.data.length).toBe(2);
  });
});
