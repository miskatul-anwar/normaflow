import { describe, it, expect } from 'vitest';
import DatabaseService, {
  quoteIdentifier,
  SQLDialect,
  DecomposedRelation,
  SQL_RESERVED_KEYWORDS,
} from '../services/api/databaseService';
import { DataUtils } from '../services/utils/dataUtils';

export interface SQLTableDef {
  tableName: string;
  headers: string[];
  primaryKey: string[];
  columnTypes?: Record<string, string>;
  foreignKeys?: Array<{
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }>;
}

export function quoteSQLIdentifier(name: string, dialect: SQLDialect = 'ansi'): string {
  return quoteIdentifier(name, dialect);
}

export function generateTestDDL(tables: SQLTableDef[], dialect: SQLDialect = 'ansi'): string {
  const relations: DecomposedRelation[] = tables.map(t => ({
    name: t.tableName,
    attributes: t.headers,
    primaryKey: t.primaryKey,
    columnTypes: t.columnTypes,
    foreignKeys: t.foreignKeys?.map(fk => ({
      attributes: [fk.sourceColumn],
      references: fk.targetTable,
      referencedKey: [fk.targetColumn],
    })),
  }));

  return DatabaseService.generateDDL(relations, dialect);
}

export function serializeCSVRow(row: Record<string, any>, headers: string[]): string {
  return headers.map(h => DatabaseService.formatCSVCell(row[h])).join(',');
}

export function exportToCSVString(data: Record<string, any>[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerLine = headers.map(h => DatabaseService.formatCSVHeader(h)).join(',');
  return [headerLine, ...data.map(row => serializeCSVRow(row, headers))].join('\n');
}

describe('Milestone 4: SQL DDL Generation, Quoting, Dialects & Data Export', () => {
  describe('1. Composite Primary Key Syntax', () => {
    it('generates table-level PRIMARY KEY constraint when table has composite primary keys', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'order_items',
          headers: ['order_id', 'product_id', 'quantity', 'unit_price'],
          primaryKey: ['order_id', 'product_id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'postgresql');
      // Must NOT contain multiple inline PRIMARY KEY declarations
      const matches = ddl.match(/PRIMARY KEY/g);
      expect(matches).toHaveLength(1);
      expect(ddl).toContain('PRIMARY KEY ("order_id", "product_id")');
      expect(ddl).toContain('"order_id" VARCHAR(255) NOT NULL');
      expect(ddl).toContain('"product_id" VARCHAR(255) NOT NULL');
      expect(ddl).not.toContain('"order_id" VARCHAR(255) PRIMARY KEY');
      expect(ddl).not.toContain('"product_id" VARCHAR(255) PRIMARY KEY');
    });

    it('generates single inline PRIMARY KEY when key is non-composite', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'customers',
          headers: ['customer_id', 'name', 'email'],
          primaryKey: ['customer_id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'postgresql');
      expect(ddl).toContain('"customer_id" VARCHAR(255) PRIMARY KEY');
      expect(ddl).not.toContain('PRIMARY KEY ("customer_id")');
    });

    it('handles tables without any primary keys gracefully', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'logs',
          headers: ['log_timestamp', 'message'],
          primaryKey: [],
        },
      ];

      const ddl = generateTestDDL(tables, 'postgresql');
      expect(ddl).not.toContain('PRIMARY KEY');
      expect(ddl).toContain('CREATE TABLE "logs"');
    });
  });

  describe('2. SQL Reserved Keyword Quoting', () => {
    it('quotes reserved words properly in PostgreSQL using double quotes', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'user',
          headers: ['order', 'group', 'select', 'table', 'values'],
          primaryKey: ['order'],
        },
      ];

      const ddl = generateTestDDL(tables, 'postgresql');
      expect(ddl).toContain('CREATE TABLE "user"');
      expect(ddl).toContain('"order" VARCHAR(255) PRIMARY KEY');
      expect(ddl).toContain('"group" VARCHAR(255)');
      expect(ddl).toContain('"select" VARCHAR(255)');
      expect(ddl).toContain('"table" VARCHAR(255)');
      expect(ddl).toContain('"values" VARCHAR(255)');
    });

    it('quotes reserved words properly in MySQL using backticks', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'order',
          headers: ['order_id', 'user', 'index'],
          primaryKey: ['order_id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'mysql');
      expect(ddl).toContain('CREATE TABLE `order`');
      expect(ddl).toContain('`user` VARCHAR(255)');
      expect(ddl).toContain('`index` VARCHAR(255)');
    });

    it('sanitizes leading numbers and special characters in identifiers', () => {
      expect(quoteSQLIdentifier('123column', 'postgresql')).toBe('"_123column"');
      expect(quoteSQLIdentifier('column with space', 'postgresql')).toBe('"column_with_space"');
      expect(quoteSQLIdentifier('col-dash', 'mysql')).toBe('`col_dash`');
      expect(SQL_RESERVED_KEYWORDS.has('USER')).toBe(true);
      expect(SQL_RESERVED_KEYWORDS.has('ORDER')).toBe(true);
      expect(SQL_RESERVED_KEYWORDS.has('TABLE')).toBe(true);
    });
  });

  describe('3. Dialect Portability', () => {
    it('omits MySQL-specific ENGINE=InnoDB and SET FOREIGN_KEY_CHECKS in PostgreSQL DDL', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'products',
          headers: ['id', 'sku'],
          primaryKey: ['id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'postgresql');
      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
      expect(ddl).not.toContain('ROW_FORMAT');
      expect(ddl).toContain('BEGIN;');
      expect(ddl).toContain('COMMIT;');
    });

    it('generates PRAGMA foreign_keys and omits MySQL clauses in SQLite DDL', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'products',
          headers: ['id', 'sku'],
          primaryKey: ['id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'sqlite');
      expect(ddl).toContain('PRAGMA foreign_keys = OFF;');
      expect(ddl).toContain('PRAGMA foreign_keys = ON;');
      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
    });

    it('includes ENGINE=InnoDB and SET FOREIGN_KEY_CHECKS only when MySQL dialect is selected', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'products',
          headers: ['id', 'sku'],
          primaryKey: ['id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'mysql');
      expect(ddl).toContain('ENGINE=InnoDB');
      expect(ddl).toContain('SET FOREIGN_KEY_CHECKS = 0;');
      expect(ddl).toContain('SET FOREIGN_KEY_CHECKS = 1;');
    });

    it('generates clean ANSI SQL DDL without vendor-specific commands', () => {
      const tables: SQLTableDef[] = [
        {
          tableName: 'products',
          headers: ['id', 'sku'],
          primaryKey: ['id'],
        },
      ];

      const ddl = generateTestDDL(tables, 'ansi');
      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
      expect(ddl).not.toContain('PRAGMA');
      expect(ddl).toContain('CREATE TABLE "products"');
    });
  });

  describe('4. Data Export: Zero and False Value Preservation', () => {
    it('preserves numeric 0 values without converting them to empty strings', () => {
      const dataset = [
        { id: 101, balance: 0, items_count: 0, score: 0 },
        { id: 102, balance: 50, items_count: 3, score: 98 },
      ];

      const csv = exportToCSVString(dataset);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('id,balance,items_count,score');
      expect(lines[1]).toBe('101,0,0,0'); // Bug would have produced 101,,,
      expect(lines[2]).toBe('102,50,3,98');
    });

    it('preserves boolean false values without converting them to empty strings', () => {
      const dataset = [
        { id: 1, is_active: false, is_admin: false },
        { id: 2, is_active: true, is_admin: false },
      ];

      const csv = exportToCSVString(dataset);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('1,false,false'); // Bug would have produced 1,,
      expect(lines[2]).toBe('2,true,false');
    });

    it('correctly handles null and undefined as empty strings', () => {
      const dataset = [
        { id: 1, note: null, description: undefined, val: 0 },
      ];

      const csv = exportToCSVString(dataset);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('1,,,0');
    });

    it('ensures DataUtils.generateRowHash distinguishes 0, false, and empty string', () => {
      const rowZero = { attr: 0 };
      const rowFalse = { attr: false };
      const rowEmpty = { attr: '' };

      const hashZero = DataUtils.generateRowHash(rowZero, ['attr']);
      const hashFalse = DataUtils.generateRowHash(rowFalse, ['attr']);
      const hashEmpty = DataUtils.generateRowHash(rowEmpty, ['attr']);

      // 0, false, and empty string must NOT produce duplicate hashes
      expect(hashZero).toBe('0');
      expect(hashFalse).toBe('false');
      expect(hashEmpty).toBe('');
      expect(hashZero).not.toBe(hashEmpty);
      expect(hashFalse).not.toBe(hashEmpty);
    });

    it('formats CSV cells properly with RFC 4180 escaping', () => {
      expect(DatabaseService.formatCSVCell(0)).toBe('0');
      expect(DatabaseService.formatCSVCell(false)).toBe('false');
      expect(DatabaseService.formatCSVCell(null)).toBe('');
      expect(DatabaseService.formatCSVCell(undefined)).toBe('');
      expect(DatabaseService.formatCSVCell('hello, world')).toBe('"hello, world"');
      expect(DatabaseService.formatCSVCell('quotes "inside"')).toBe('"quotes ""inside"""');
      expect(DatabaseService.formatCSVCell('line1\nline2')).toBe('"line1\nline2"');
      expect(DatabaseService.formatCSVCell('line1\r\nline2')).toBe('"line1\r\nline2"');
    });
  });
});
