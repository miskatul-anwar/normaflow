import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import databaseService, {
  DatabaseService,
  quoteIdentifier,
  mapDataTypeToDialect,
  SQLDialect,
  DecomposedRelation,
  SQL_RESERVED_KEYWORDS,
} from '../services/api/databaseService';
import { DataUtils } from '../services/utils/dataUtils';
import { CSVProcessor } from '../services/processors/csvProcessor';

/**
 * Empirical helper: Executes generated SQL DDL directly inside an in-memory SQLite database
 * via Python's standard sqlite3 module. Fails if the SQL has syntax errors.
 */
function verifySQLiteExecution(sqlScript: string): void {
  const pythonScript = `
import sys, sqlite3
sql = sys.stdin.read()
con = sqlite3.connect(':memory:')
con.executescript(sql)
con.close()
`;
  execFileSync('python', ['-c', pythonScript], {
    input: sqlScript,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('Milestone 4 Challenger: Empirical Adversarial Stress Suite (SQL DDL & Data Export)', () => {

  // =========================================================================
  // SUITE 1: 3+ ATTRIBUTE COMPOSITE PRIMARY KEYS
  // =========================================================================
  describe('1. Composite Primary Keys (3, 4, 5+ Attributes)', () => {
    it('generates valid table-level constraint for a 3-attribute composite PK across all dialects', () => {
      const relation: DecomposedRelation = {
        name: 'warehouse_inventory',
        attributes: ['warehouse_id', 'zone_id', 'shelf_id', 'quantity', 'updated_at'],
        primaryKey: ['warehouse_id', 'zone_id', 'shelf_id'],
        columnTypes: {
          warehouse_id: 'integer',
          zone_id: 'integer',
          shelf_id: 'integer',
          quantity: 'integer',
          updated_at: 'datetime',
        },
      };

      const dialects: SQLDialect[] = ['postgresql', 'mysql', 'sqlite', 'ansi'];

      for (const dialect of dialects) {
        const ddl = DatabaseService.generateTableDDL(relation, dialect);

        // Must contain exactly ONE table-level PRIMARY KEY constraint
        const pkMatches = ddl.match(/PRIMARY KEY/g);
        expect(pkMatches).not.toBeNull();
        expect(pkMatches!).toHaveLength(1);

        // Constituent columns must be marked NOT NULL and must NOT have inline PRIMARY KEY
        if (dialect === 'mysql') {
          expect(ddl).toContain('`warehouse_id` INT NOT NULL');
          expect(ddl).toContain('`zone_id` INT NOT NULL');
          expect(ddl).toContain('`shelf_id` INT NOT NULL');
          expect(ddl).toContain('PRIMARY KEY (`warehouse_id`, `zone_id`, `shelf_id`)');
          expect(ddl).not.toContain('`warehouse_id` INT PRIMARY KEY');
        } else {
          const idType = dialect === 'sqlite' ? 'INTEGER' : 'INTEGER';
          expect(ddl).toContain(`"warehouse_id" ${idType} NOT NULL`);
          expect(ddl).toContain(`"zone_id" ${idType} NOT NULL`);
          expect(ddl).toContain(`"shelf_id" ${idType} NOT NULL`);
          expect(ddl).toContain('PRIMARY KEY ("warehouse_id", "zone_id", "shelf_id")');
          expect(ddl).not.toContain(`"warehouse_id" ${idType} PRIMARY KEY`);
        }
      }
    });

    it('generates valid table-level constraint for a 5-attribute composite PK and executes cleanly in SQLite', () => {
      const relation: DecomposedRelation = {
        name: 'geo_metrics',
        attributes: ['country', 'region', 'district', 'ward', 'metric_code', 'value'],
        primaryKey: ['country', 'region', 'district', 'ward', 'metric_code'],
        columnTypes: {
          country: 'string',
          region: 'string',
          district: 'string',
          ward: 'string',
          metric_code: 'string',
          value: 'decimal',
        },
      };

      const ddl = DatabaseService.generateDDL([relation], 'sqlite');

      expect(ddl).toContain('PRIMARY KEY ("country", "region", "district", "ward", "metric_code")');
      expect(ddl).toContain('"country" TEXT NOT NULL');
      expect(ddl).toContain('"region" TEXT NOT NULL');
      expect(ddl).toContain('"district" TEXT NOT NULL');
      expect(ddl).toContain('"ward" TEXT NOT NULL');
      expect(ddl).toContain('"metric_code" TEXT NOT NULL');
      expect(ddl).toContain('"value" DECIMAL');

      // Verify that SQLite engine compiles and executes the generated DDL
      expect(() => verifySQLiteExecution(ddl)).not.toThrow();
    });

    it('enforces composite primary key uniqueness when executing in SQLite', () => {
      const relation: DecomposedRelation = {
        name: 'tenant_permissions',
        attributes: ['tenant_id', 'role_id', 'resource_id', 'can_write'],
        primaryKey: ['tenant_id', 'role_id', 'resource_id'],
        columnTypes: {
          tenant_id: 'integer',
          role_id: 'integer',
          resource_id: 'integer',
          can_write: 'boolean',
        },
      };

      const ddl = DatabaseService.generateDDL([relation], 'sqlite');

      // Insert statements testing composite uniqueness: row 1 and row 2 succeed, row 3 is duplicate on (1, 2, 3)
      const testScript = `
${ddl}
INSERT INTO "tenant_permissions" VALUES (1, 2, 3, 1);
INSERT INTO "tenant_permissions" VALUES (1, 2, 4, 0);
`;
      expect(() => verifySQLiteExecution(testScript)).not.toThrow();

      const duplicateScript = `
${ddl}
INSERT INTO "tenant_permissions" VALUES (1, 2, 3, 1);
INSERT INTO "tenant_permissions" VALUES (1, 2, 3, 0); -- Duplicate composite key!
`;
      expect(() => verifySQLiteExecution(duplicateScript)).toThrow();
    });
  });

  // =========================================================================
  // SUITE 2: RESERVED KEYWORDS AS TABLE AND COLUMN NAMES
  // =========================================================================
  describe('2. SQL Reserved Keyword Quoting and Execution', () => {
    it('properly quotes reserved keywords in table names, column names, and composite PKs', () => {
      const relation: DecomposedRelation = {
        name: 'order', // reserved
        attributes: ['select', 'from', 'where', 'group', 'table', 'user', 'limit'], // all reserved
        primaryKey: ['select', 'group', 'table'], // 3 reserved keyword composite PK
        columnTypes: {
          select: 'integer',
          from: 'string',
          where: 'string',
          group: 'integer',
          table: 'integer',
          user: 'string',
          limit: 'integer',
        },
      };

      // 1. PostgreSQL Quoting
      const pgDDL = DatabaseService.generateDDL([relation], 'postgresql');
      expect(pgDDL).toContain('CREATE TABLE "order"');
      expect(pgDDL).toContain('"select" INTEGER NOT NULL');
      expect(pgDDL).toContain('"from" VARCHAR(255)');
      expect(pgDDL).toContain('"where" VARCHAR(255)');
      expect(pgDDL).toContain('"group" INTEGER NOT NULL');
      expect(pgDDL).toContain('"table" INTEGER NOT NULL');
      expect(pgDDL).toContain('"user" VARCHAR(255)');
      expect(pgDDL).toContain('"limit" INTEGER');
      expect(pgDDL).toContain('PRIMARY KEY ("select", "group", "table")');

      // 2. MySQL Quoting
      const myDDL = DatabaseService.generateDDL([relation], 'mysql');
      expect(myDDL).toContain('CREATE TABLE `order`');
      expect(myDDL).toContain('`select` INT NOT NULL');
      expect(myDDL).toContain('`from` VARCHAR(255)');
      expect(myDDL).toContain('`where` VARCHAR(255)');
      expect(myDDL).toContain('`group` INT NOT NULL');
      expect(myDDL).toContain('`table` INT NOT NULL');
      expect(myDDL).toContain('`user` VARCHAR(255)');
      expect(myDDL).toContain('`limit` INT');
      expect(myDDL).toContain('PRIMARY KEY (`select`, `group`, `table`)');

      // 3. SQLite Quoting and Empirical Execution
      const sqliteDDL = DatabaseService.generateDDL([relation], 'sqlite');
      expect(sqliteDDL).toContain('CREATE TABLE "order"');
      expect(sqliteDDL).toContain('PRIMARY KEY ("select", "group", "table")');

      // Empirically execute the reserved-keyword script in real SQLite engine!
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // Verify insertion and querying with reserved words
      const insertSql = `
${sqliteDDL}
INSERT INTO "order" ("select", "from", "where", "group", "table", "user", "limit")
VALUES (100, 'src', 'cond', 200, 300, 'admin', 50);
`;
      expect(() => verifySQLiteExecution(insertSql)).not.toThrow();
    });

    it('verifies quoteIdentifier comprehensively against SQL_RESERVED_KEYWORDS', () => {
      for (const kw of SQL_RESERVED_KEYWORDS) {
        const lower = kw.toLowerCase();
        expect(quoteIdentifier(lower, 'postgresql')).toBe(`"${lower}"`);
        expect(quoteIdentifier(lower, 'sqlite')).toBe(`"${lower}"`);
        expect(quoteIdentifier(lower, 'ansi')).toBe(`"${lower}"`);
        expect(quoteIdentifier(lower, 'mysql')).toBe(`\`${lower}\``);
      }
    });

    it('sanitizes leading numbers and illegal characters into valid SQL identifiers', () => {
      expect(quoteIdentifier('1st_column', 'postgresql')).toBe('"_1st_column"');
      expect(quoteIdentifier('user-profile-id', 'mysql')).toBe('`user_profile_id`');
      expect(quoteIdentifier('cost in $', 'sqlite')).toBe('"cost_in__"');
      expect(quoteIdentifier('', 'ansi')).toBe('""');
    });
  });

  // =========================================================================
  // SUITE 3: HEAP TABLES WITH NO PRIMARY KEY
  // =========================================================================
  describe('3. Heap Tables (Tables with No Primary Key)', () => {
    it('generates clean DDL without PRIMARY KEY clause when primaryKey array is empty', () => {
      const heapRelation: DecomposedRelation = {
        name: 'access_logs',
        attributes: ['logged_at', 'ip_address', 'method', 'endpoint', 'status_code'],
        primaryKey: [],
        columnTypes: {
          logged_at: 'datetime',
          ip_address: 'string',
          method: 'string',
          endpoint: 'string',
          status_code: 'integer',
        },
      };

      const dialects: SQLDialect[] = ['postgresql', 'mysql', 'sqlite', 'ansi'];
      for (const dialect of dialects) {
        const ddl = DatabaseService.generateTableDDL(heapRelation, dialect);
        expect(ddl).not.toContain('PRIMARY KEY');
        expect(ddl).not.toContain('NOT NULL');
      }

      const sqliteDDL = DatabaseService.generateDDL([heapRelation], 'sqlite');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // Verify inserting duplicate rows succeeds since there is no PK constraint
      const dupLogsSql = `
${sqliteDDL}
INSERT INTO "access_logs" VALUES ('2026-10-14T05:00:00Z', '127.0.0.1', 'GET', '/api/data', 200);
INSERT INTO "access_logs" VALUES ('2026-10-14T05:00:00Z', '127.0.0.1', 'GET', '/api/data', 200);
`;
      expect(() => verifySQLiteExecution(dupLogsSql)).not.toThrow();
    });

    it('generates multi-table schema mixing heap tables, single-PK tables, and composite-PK tables without cross-contamination', () => {
      const relations: DecomposedRelation[] = [
        {
          name: 'raw_events', // Heap table
          attributes: ['event_id', 'event_type', 'payload'],
          primaryKey: [],
        },
        {
          name: 'users', // Single PK
          attributes: ['user_id', 'email', 'name'],
          primaryKey: ['user_id'],
        },
        {
          name: 'user_roles', // Composite PK
          attributes: ['user_id', 'role_id', 'assigned_at'],
          primaryKey: ['user_id', 'role_id'],
        },
      ];

      const sqliteDDL = DatabaseService.generateDDL(relations, 'sqlite');

      // raw_events has no PK
      const rawEventsDDL = DatabaseService.generateTableDDL(relations[0], 'sqlite');
      expect(rawEventsDDL).not.toContain('PRIMARY KEY');

      // users has inline PK
      const usersDDL = DatabaseService.generateTableDDL(relations[1], 'sqlite');
      expect(usersDDL).toContain('"user_id" TEXT PRIMARY KEY');
      expect(usersDDL).not.toContain('PRIMARY KEY ("user_id")');

      // user_roles has table-level composite PK
      const userRolesDDL = DatabaseService.generateTableDDL(relations[2], 'sqlite');
      expect(userRolesDDL).toContain('"user_id" TEXT NOT NULL');
      expect(userRolesDDL).toContain('"role_id" TEXT NOT NULL');
      expect(userRolesDDL).toContain('PRIMARY KEY ("user_id", "role_id")');

      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();
    });
  });

  // =========================================================================
  // SUITE 4: CROSS-TABLE FOREIGN KEYS LINKING COMPOSITE KEYS
  // =========================================================================
  describe('4. Cross-Table Foreign Keys with Composite Determinants', () => {
    it('generates valid composite FOREIGN KEY syntax linking composite determinants', () => {
      const parentTable: DecomposedRelation = {
        name: 'departments',
        attributes: ['org_id', 'dept_id', 'dept_name', 'budget'],
        primaryKey: ['org_id', 'dept_id'],
        columnTypes: {
          org_id: 'integer',
          dept_id: 'integer',
          dept_name: 'string',
          budget: 'decimal',
        },
      };

      const childTable: DecomposedRelation = {
        name: 'employees',
        attributes: ['org_id', 'dept_id', 'emp_id', 'name', 'salary'],
        primaryKey: ['org_id', 'dept_id', 'emp_id'],
        columnTypes: {
          org_id: 'integer',
          dept_id: 'integer',
          emp_id: 'integer',
          name: 'string',
          salary: 'decimal',
        },
        foreignKeys: [
          {
            attributes: ['org_id', 'dept_id'],
            references: 'departments',
            referencedKey: ['org_id', 'dept_id'],
          },
        ],
      };

      // PostgreSQL DDL
      const pgDDL = DatabaseService.generateDDL([parentTable, childTable], 'postgresql');
      expect(pgDDL).toContain(
        'CONSTRAINT "fk_employees_org_id_dept_id" FOREIGN KEY ("org_id", "dept_id") REFERENCES "departments"("org_id", "dept_id") ON DELETE CASCADE ON UPDATE CASCADE'
      );

      // MySQL DDL
      const myDDL = DatabaseService.generateDDL([parentTable, childTable], 'mysql');
      expect(myDDL).toContain(
        'CONSTRAINT `fk_employees_org_id_dept_id` FOREIGN KEY (`org_id`, `dept_id`) REFERENCES `departments`(`org_id`, `dept_id`) ON DELETE CASCADE ON UPDATE CASCADE'
      );

      // SQLite DDL and Empirical Foreign Key Enforcement
      const sqliteDDL = DatabaseService.generateDDL([parentTable, childTable], 'sqlite');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // Test referential integrity enforcement
      const validInsert = `
${sqliteDDL}
INSERT INTO "departments" VALUES (1, 10, 'Engineering', 500000.0);
INSERT INTO "employees" VALUES (1, 10, 101, 'Alice', 120000.0);
`;
      expect(() => verifySQLiteExecution(validInsert)).not.toThrow();

      const invalidInsert = `
${sqliteDDL}
PRAGMA foreign_keys = ON;
INSERT INTO "departments" VALUES (1, 10, 'Engineering', 500000.0);
-- Insert child referencing non-existent composite parent (1, 99)
INSERT INTO "employees" VALUES (1, 99, 102, 'Bob', 110000.0);
`;
      expect(() => verifySQLiteExecution(invalidInsert)).toThrow();
    });
  });

  // =========================================================================
  // SUITE 5: STRICT DIALECT ISOLATION AND PORTABILITY
  // =========================================================================
  describe('5. Dialect Isolation (PostgreSQL, SQLite, ANSI, MySQL)', () => {
    const testRelation: DecomposedRelation = {
      name: 'customers',
      attributes: ['id', 'is_verified', 'created_at', 'balance', 'metadata'],
      primaryKey: ['id'],
      columnTypes: {
        id: 'integer',
        is_verified: 'boolean',
        created_at: 'datetime',
        balance: 'double',
        metadata: 'json',
      },
    };

    it('strictly isolates PostgreSQL DDL from MySQL and SQLite directives', () => {
      const ddl = DatabaseService.generateDDL([testRelation], 'postgresql');

      // Must have Postgres transaction wrapper
      expect(ddl).toContain('BEGIN;\n\n');
      expect(ddl).toContain('COMMIT;\n');

      // Forbidden vendor artifacts
      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
      expect(ddl).not.toContain('SET UNIQUE_CHECKS');
      expect(ddl).not.toContain('SET AUTOCOMMIT');
      expect(ddl).not.toContain('PRAGMA');
      expect(ddl).not.toContain('`');

      // Dialect data types
      expect(ddl).toContain('"id" INTEGER PRIMARY KEY');
      expect(ddl).toContain('"is_verified" BOOLEAN');
      expect(ddl).toContain('"created_at" TIMESTAMP');
      expect(ddl).toContain('"balance" DOUBLE PRECISION');
      expect(ddl).toContain('"metadata" JSONB');
    });

    it('strictly isolates SQLite DDL from MySQL directives and maps SQLite affinity types', () => {
      const ddl = DatabaseService.generateDDL([testRelation], 'sqlite');

      // Must have SQLite pragma foreign key wrapper
      expect(ddl).toContain('PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n');
      expect(ddl).toContain('COMMIT;\nPRAGMA foreign_keys = ON;\n');

      // Forbidden vendor artifacts
      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
      expect(ddl).not.toContain('SET UNIQUE_CHECKS');
      expect(ddl).not.toContain('`');

      // Dialect data types
      expect(ddl).toContain('"id" INTEGER PRIMARY KEY');
      expect(ddl).toContain('"is_verified" INTEGER');
      expect(ddl).toContain('"created_at" TEXT');
      expect(ddl).toContain('"balance" REAL');
      expect(ddl).toContain('"metadata" TEXT');

      expect(() => verifySQLiteExecution(ddl)).not.toThrow();
    });

    it('strictly isolates ANSI SQL DDL as clean vendor-free SQL', () => {
      const ddl = DatabaseService.generateDDL([testRelation], 'ansi');

      expect(ddl).not.toContain('ENGINE=InnoDB');
      expect(ddl).not.toContain('SET FOREIGN_KEY_CHECKS');
      expect(ddl).not.toContain('PRAGMA');
      expect(ddl).not.toContain('`');
      expect(ddl).toContain('CREATE TABLE "customers"');
      expect(ddl).toContain('"is_verified" BOOLEAN');
      expect(ddl).toContain('"created_at" TIMESTAMP');
      expect(ddl).toContain('"metadata" TEXT');
    });

    it('preserves MySQL-specific directives only when MySQL dialect is selected', () => {
      const ddl = DatabaseService.generateDDL([testRelation], 'mysql');

      expect(ddl).toContain('SET FOREIGN_KEY_CHECKS = 0;');
      expect(ddl).toContain('SET UNIQUE_CHECKS = 0;');
      expect(ddl).toContain('SET AUTOCOMMIT = 0;');
      expect(ddl).toContain('START TRANSACTION;');
      expect(ddl).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');
      expect(ddl).toContain('SET FOREIGN_KEY_CHECKS = 1;');
      expect(ddl).toContain('`customers`');
      expect(ddl).toContain('`is_verified` TINYINT(1)');
      expect(ddl).toContain('`created_at` DATETIME');
      expect(ddl).toContain('`metadata` JSON');
      expect(ddl).not.toContain('PRAGMA');
    });

    it('exhaustively verifies mapDataTypeToDialect across all standard types and dialects', () => {
      const typeExpectations: Array<{
        inferred: string;
        postgres: string;
        sqlite: string;
        mysql: string;
        ansi: string;
      }> = [
        { inferred: 'integer', postgres: 'INTEGER', sqlite: 'INTEGER', mysql: 'INT', ansi: 'INTEGER' },
        { inferred: 'bigint', postgres: 'BIGINT', sqlite: 'BIGINT', mysql: 'INT', ansi: 'BIGINT' },
        { inferred: 'boolean', postgres: 'BOOLEAN', sqlite: 'INTEGER', mysql: 'TINYINT(1)', ansi: 'BOOLEAN' },
        { inferred: 'float', postgres: 'DOUBLE PRECISION', sqlite: 'REAL', mysql: 'DOUBLE', ansi: 'DOUBLE PRECISION' },
        { inferred: 'decimal(10,2)', postgres: 'DECIMAL(10,2)', sqlite: 'DECIMAL(10,2)', mysql: 'DECIMAL(10,2)', ansi: 'DECIMAL(10,2)' },
        { inferred: 'date', postgres: 'DATE', sqlite: 'TEXT', mysql: 'DATE', ansi: 'DATE' },
        { inferred: 'datetime', postgres: 'TIMESTAMP', sqlite: 'TEXT', mysql: 'DATETIME', ansi: 'TIMESTAMP' },
        { inferred: 'json', postgres: 'JSONB', sqlite: 'TEXT', mysql: 'JSON', ansi: 'TEXT' },
        { inferred: 'varchar(100)', postgres: 'VARCHAR(100)', sqlite: 'TEXT', mysql: 'VARCHAR(100)', ansi: 'VARCHAR(100)' },
      ];

      for (const t of typeExpectations) {
        expect(mapDataTypeToDialect(t.inferred, 'postgresql')).toBe(t.postgres);
        expect(mapDataTypeToDialect(t.inferred, 'sqlite')).toBe(t.sqlite);
        expect(mapDataTypeToDialect(t.inferred, 'mysql')).toBe(t.mysql);
        expect(mapDataTypeToDialect(t.inferred, 'ansi')).toBe(t.ansi);
      }
    });
  });

  // =========================================================================
  // SUITE 6: DATA EXPORT VALUE PRESERVATION & STRICT DISCRIMINATION
  // =========================================================================
  describe('6. Data Export (0, -0, 0.0, false, null, undefined, empty string)', () => {
    it('strictly preserves and distinguishes numeric 0, -0, 0.0, boolean false, null, undefined, and empty string', () => {
      // Cell-level formatting assertions
      expect(DatabaseService.formatCSVCell(0)).toBe('0');
      expect(DatabaseService.formatCSVCell(-0)).toBe('0');
      expect(DatabaseService.formatCSVCell(0.0)).toBe('0');
      expect(DatabaseService.formatCSVCell('0')).toBe('0');
      expect(DatabaseService.formatCSVCell('0.0')).toBe('0.0');
      expect(DatabaseService.formatCSVCell('-0')).toBe('-0');
      expect(DatabaseService.formatCSVCell(false)).toBe('false');
      expect(DatabaseService.formatCSVCell('false')).toBe('false');
      expect(DatabaseService.formatCSVCell(null)).toBe('');
      expect(DatabaseService.formatCSVCell(undefined)).toBe('');
      expect(DatabaseService.formatCSVCell('')).toBe('');

      // Strict discrimination
      expect(DatabaseService.formatCSVCell(0)).not.toBe('');
      expect(DatabaseService.formatCSVCell(false)).not.toBe('');
      expect(DatabaseService.formatCSVCell(0)).not.toBe(DatabaseService.formatCSVCell(false));
      expect(DatabaseService.formatCSVCell(0)).not.toBe(DatabaseService.formatCSVCell(null));
      expect(DatabaseService.formatCSVCell(false)).not.toBe(DatabaseService.formatCSVCell(null));
    });

    it('exports rows with 0, -0, 0.0, false, null, undefined, empty string without data destruction', () => {
      const records = [
        { id: 1, score: 0, balance: -0, rate: 0.0, active: false, missing: null, absent: undefined, blank: '' },
        { id: 2, score: '0', balance: '-0', rate: '0.0', active: 'false', missing: null, absent: undefined, blank: '' },
        { id: 3, score: 100, balance: 50.5, rate: 1.25, active: true, missing: 'present', absent: 'yes', blank: 'filled' },
      ];

      const headers = Object.keys(records[0]);
      const headerLine = headers.map(h => DatabaseService.formatCSVHeader(h)).join(',');
      const rows = records.map(r => headers.map(h => DatabaseService.formatCSVCell(r[h as keyof typeof r])).join(','));
      const csv = [headerLine, ...rows].join('\n');

      const lines = csv.split('\n');
      expect(lines[0]).toBe('id,score,balance,rate,active,missing,absent,blank');
      // Row 1: 0, -0, 0.0, false are preserved; missing, absent, blank are empty
      expect(lines[1]).toBe('1,0,0,0,false,,,');
      // Row 2: strings '0', '-0', '0.0', 'false' are preserved
      expect(lines[2]).toBe('2,0,-0,0.0,false,,,');
      // Row 3: truthy values
      expect(lines[3]).toBe('3,100,50.5,1.25,true,present,yes,filled');
    });

    it('formats cells with RFC 4180 quoting for commas, double quotes, and CRLF newlines', () => {
      expect(DatabaseService.formatCSVCell('John, Jr.')).toBe('"John, Jr."');
      expect(DatabaseService.formatCSVCell('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(DatabaseService.formatCSVCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(DatabaseService.formatCSVCell('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
      expect(DatabaseService.formatCSVCell('Field with "quotes" and, commas\nand newlines')).toBe(
        '"Field with ""quotes"" and, commas\nand newlines"'
      );
    });

    it('verifies DataUtils.generateRowHash distinguishes 0, false, null, undefined, and empty string', () => {
      const hash0 = DataUtils.generateRowHash({ col: 0 }, ['col']);
      const hashNeg0 = DataUtils.generateRowHash({ col: -0 }, ['col']);
      const hashFloat0 = DataUtils.generateRowHash({ col: 0.0 }, ['col']);
      const hashStr0 = DataUtils.generateRowHash({ col: '0' }, ['col']);
      const hashFalse = DataUtils.generateRowHash({ col: false }, ['col']);
      const hashStrFalse = DataUtils.generateRowHash({ col: 'false' }, ['col']);
      const hashNull = DataUtils.generateRowHash({ col: null }, ['col']);
      const hashUndef = DataUtils.generateRowHash({ col: undefined }, ['col']);
      const hashEmpty = DataUtils.generateRowHash({ col: '' }, ['col']);

      expect(hash0).toBe('0');
      expect(hashNeg0).toBe('0');
      expect(hashFloat0).toBe('0');
      expect(hashStr0).toBe('0');
      expect(hashFalse).toBe('false');
      expect(hashStrFalse).toBe('false');
      expect(hashNull).toBe('');
      expect(hashUndef).toBe('');
      expect(hashEmpty).toBe('');

      // Crucial distinctions: 0 !== '' and false !== '' and 0 !== false
      expect(hash0).not.toBe(hashEmpty);
      expect(hashFalse).not.toBe(hashEmpty);
      expect(hash0).not.toBe(hashFalse);
    });

    it('verifies DataUtils.removeDuplicates preserves distinct 0, false, and empty rows', () => {
      const dataset = [
        { id: 1, val: 0 },
        { id: 2, val: false },
        { id: 3, val: '' },
        { id: 4, val: null }, // Duplicate of row 3 (both clean to '')
        { id: 5, val: 0 },    // Duplicate of row 1 (both clean to '0')
        { id: 6, val: false },// Duplicate of row 2 (both clean to 'false')
      ];

      const deduped = DataUtils.removeDuplicates(dataset, ['val']);
      expect(deduped).toHaveLength(3);
      expect(deduped[0].id).toBe(1); // val: 0
      expect(deduped[1].id).toBe(2); // val: false
      expect(deduped[2].id).toBe(3); // val: ''
    });

    it('roundtrips exported adversarial CSV through CSVProcessor.parse preserving records and structure', async () => {
      const originalRows = [
        { id: '1', code: '0', is_valid: 'false', note: 'simple' },
        { id: '2', code: '10', is_valid: 'true', note: 'has, comma' },
        { id: '3', code: '0', is_valid: 'false', note: 'has "quotes" here' },
        { id: '4', code: '-0', is_valid: 'false', note: 'multiline\nentry' },
      ];

      const headers = ['id', 'code', 'is_valid', 'note'];
      const headerLine = headers.map(h => DatabaseService.formatCSVHeader(h)).join(',');
      const rowLines = originalRows.map(r => headers.map(h => DatabaseService.formatCSVCell(r[h as keyof typeof r])).join(','));
      const csvContent = [headerLine, ...rowLines].join('\n');

      const parsed = await CSVProcessor.parse(csvContent);

      expect(parsed.data).toHaveLength(4);
      expect(parsed.headers).toEqual(['id', 'code', 'is_valid', 'note']);

      // Row 1
      expect(parsed.data[0].id).toBe('1');
      expect(parsed.data[0].code).toBe('0');
      expect(parsed.data[0].is_valid).toBe('false');
      expect(parsed.data[0].note).toBe('simple');

      // Row 2: escaped comma
      expect(parsed.data[1].note).toBe('has, comma');

      // Row 3: escaped quotes
      expect(parsed.data[2].note).toBe('has "quotes" here');

      // Row 4: multiline newline inside field
      expect(parsed.data[3].note).toBe('multiline\nentry');
    });

    it('validates discrimination matrix across 0, -0, 0.0, false, null, undefined, empty string, and BigInt', () => {
      const falsyValues = [0, -0, 0.0, false, null, undefined, ''];
      const formatted = falsyValues.map(v => DatabaseService.formatCSVCell(v));

      // 0, -0, 0.0 format to '0'
      expect(formatted[0]).toBe('0');
      expect(formatted[1]).toBe('0');
      expect(formatted[2]).toBe('0');

      // false formats to 'false'
      expect(formatted[3]).toBe('false');

      // null, undefined, '' format to ''
      expect(formatted[4]).toBe('');
      expect(formatted[5]).toBe('');
      expect(formatted[6]).toBe('');

      // BigInt 0n formats to '0'
      expect(DatabaseService.formatCSVCell(0n)).toBe('0');
      expect(DatabaseService.formatCSVCell(9007199254740995n)).toBe('9007199254740995');
    });
  });

  // =========================================================================
  // SUITE 7: ALL-RESERVED-KEYWORD MULTI-TABLE RELATIONAL NETWORK
  // =========================================================================
  describe('7. All-Reserved-Keyword Multi-Table Relational Network', () => {
    it('generates and empirically executes in SQLite an all-reserved-keyword relational schema with foreign keys', () => {
      const userTable: DecomposedRelation = {
        name: 'user',
        attributes: ['table', 'select', 'where', 'from'],
        primaryKey: ['table', 'select'],
        columnTypes: {
          table: 'integer',
          select: 'integer',
          where: 'string',
          from: 'string',
        },
      };

      const orderTable: DecomposedRelation = {
        name: 'order',
        attributes: ['table', 'select', 'order', 'group', 'by'],
        primaryKey: ['table', 'select', 'order'],
        columnTypes: {
          table: 'integer',
          select: 'integer',
          order: 'integer',
          group: 'string',
          by: 'string',
        },
        foreignKeys: [
          {
            attributes: ['table', 'select'],
            references: 'user',
            referencedKey: ['table', 'select'],
          },
        ],
      };

      const checkTable: DecomposedRelation = {
        name: 'check',
        attributes: ['table', 'select', 'order', 'index', 'limit'],
        primaryKey: ['table', 'select', 'order', 'index'],
        columnTypes: {
          table: 'integer',
          select: 'integer',
          order: 'integer',
          index: 'integer',
          limit: 'integer',
        },
        foreignKeys: [
          {
            attributes: ['table', 'select', 'order'],
            references: 'order',
            referencedKey: ['table', 'select', 'order'],
          },
        ],
      };

      const relations = [userTable, orderTable, checkTable];

      // 1. PostgreSQL DDL check
      const pgDDL = DatabaseService.generateDDL(relations, 'postgresql');
      expect(pgDDL).toContain('CREATE TABLE "user"');
      expect(pgDDL).toContain('CREATE TABLE "order"');
      expect(pgDDL).toContain('CREATE TABLE "check"');
      expect(pgDDL).toContain('PRIMARY KEY ("table", "select")');
      expect(pgDDL).toContain('PRIMARY KEY ("table", "select", "order")');
      expect(pgDDL).toContain('PRIMARY KEY ("table", "select", "order", "index")');

      // 2. MySQL DDL check
      const myDDL = DatabaseService.generateDDL(relations, 'mysql');
      expect(myDDL).toContain('CREATE TABLE `user`');
      expect(myDDL).toContain('CREATE TABLE `order`');
      expect(myDDL).toContain('CREATE TABLE `check`');

      // 3. SQLite DDL and Empirical Multi-Table Execution
      const sqliteDDL = DatabaseService.generateDDL(relations, 'sqlite');
      expect(() => verifySQLiteExecution(sqliteDDL)).not.toThrow();

      // Test inserting connected relational records with all reserved words
      const testDataSql = `
${sqliteDDL}
PRAGMA foreign_keys = ON;
INSERT INTO "user" ("table", "select", "where", "from") VALUES (1, 10, 'w1', 'f1');
INSERT INTO "order" ("table", "select", "order", "group", "by") VALUES (1, 10, 100, 'g1', 'b1');
INSERT INTO "check" ("table", "select", "order", "index", "limit") VALUES (1, 10, 100, 1000, 25);
`;
      expect(() => verifySQLiteExecution(testDataSql)).not.toThrow();
    });
  });

  // =========================================================================
  // SUITE 8: IDENTIFIER SANITIZATION & CONSTRAINT NAME TRUNCATION
  // =========================================================================
  describe('8. Identifier Sanitization & Long Constraint Truncation', () => {
    it('truncates foreign key constraint names to 64 characters preventing database identifier limit errors', () => {
      const veryLongTableName = 'this_is_a_very_long_table_name_that_exceeds_standard_identifier_limits_in_sql';
      const rel: DecomposedRelation = {
        name: veryLongTableName,
        attributes: ['extraordinarily_long_attribute_column_name_one', 'another_long_column'],
        primaryKey: ['extraordinarily_long_attribute_column_name_one'],
        foreignKeys: [
          {
            attributes: ['extraordinarily_long_attribute_column_name_one'],
            references: 'parent_table',
            referencedKey: ['id'],
          },
        ],
      };

      const ddl = DatabaseService.generateTableDDL(rel, 'postgresql');
      // Extract the constraint name
      const match = ddl.match(/CONSTRAINT "([^"]+)"/);
      expect(match).not.toBeNull();
      const constraintName = match![1];
      // In PostgreSQL and MySQL, constraint identifier limit is 63 or 64 characters
      expect(constraintName.length).toBeLessThanOrEqual(64);
    });

    it('handles relation instance method delegating to static methods', () => {
      expect(databaseService.formatCSVCell(0)).toBe('0');
      expect(databaseService.formatCSVHeader('col,name')).toBe('"col,name"');

      const rel: DecomposedRelation = {
        name: 'test_tbl',
        attributes: ['id', 'val'],
        primaryKey: ['id'],
      };
      const tableDDL = databaseService.generateTableDDL(rel, 'sqlite');
      expect(tableDDL).toContain('CREATE TABLE "test_tbl"');

      const fullDDL = databaseService.generateDDL([rel], 'sqlite');
      expect(fullDDL).toContain('PRAGMA foreign_keys = OFF;');
    });
  });
});
