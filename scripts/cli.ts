/**
 * NormaFlow command-line mode: the same engine as the desktop app.
 *
 *   npm run cli -- analyze data/*.csv --out out/ --dialect postgresql --json
 *
 * Options
 *   --out <dir>        write every generated file here (default: ./normaflow-out)
 *   --dialect <name>   postgresql | mysql | sqlite | ansi (default: sqlite)
 *   --ops a,b,c        operation names to run (default: all)
 *   --max-lhs <n>      largest determinant size (default: 4)
 *   --json             print a machine-readable summary to stdout
 *   --verbose          print the engine log to stderr
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseService, type SQLDialect } from '../src/services/api/databaseService';
import { ALL_OPERATION_NAMES, canonicalOperationName } from '../src/config/operations';

interface Args {
  files: string[];
  out: string;
  dialect: SQLDialect;
  ops: string[];
  maxLhs: number;
  json: boolean;
  verbose: boolean;
}

const DIALECTS: SQLDialect[] = ['postgresql', 'mysql', 'sqlite', 'ansi'];

export function parseArgs(argv: string[]): Args | { error: string } {
  const [command, ...rest] = argv;
  if (command !== 'analyze') return { error: 'usage: normaflow analyze <file.csv|xlsx|ods>... [--out dir] [--dialect d] [--ops a,b] [--json]' };
  const args: Args = { files: [], out: 'normaflow-out', dialect: 'sqlite', ops: ALL_OPERATION_NAMES, maxLhs: 4, json: false, verbose: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const value = () => {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    try {
      if (a === '--out') args.out = value();
      else if (a === '--dialect') {
        const d = value() === 'postgres' ? 'postgresql' : rest[i];
        if (!DIALECTS.includes(d as SQLDialect)) return { error: `unknown dialect "${d}" (use ${DIALECTS.join(', ')})` };
        args.dialect = d as SQLDialect;
      } else if (a === '--ops') {
        args.ops = value().split(',').map(s => canonicalOperationName(s.trim())).filter(Boolean);
        const unknown = args.ops.filter(o => !ALL_OPERATION_NAMES.includes(o));
        if (unknown.length) return { error: `unknown operation(s): ${unknown.join(', ')}` };
      } else if (a === '--max-lhs') args.maxLhs = Math.max(1, Number(value()) || 4);
      else if (a === '--json') args.json = true;
      else if (a === '--verbose') args.verbose = true;
      else if (a.startsWith('--')) return { error: `unknown option ${a}` };
      else args.files.push(a);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  if (args.files.length === 0) return { error: 'no input files' };
  return args;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(2);
  }
  const args = parsed;

  // The engine logs through console; keep stdout clean unless asked.
  if (!args.verbose) {
    for (const m of ['log', 'info', 'debug', 'warn'] as const) console[m] = () => undefined;
  } else {
    for (const m of ['log', 'info', 'debug'] as const) console[m] = (...a: unknown[]) => process.stderr.write(`${a.join(' ')}\n`);
  }

  const files = args.files.map(p => new File([readFileSync(p)], basename(p), { type: 'text/csv' }));
  const service = new DatabaseService();
  const result = await service.processFiles(files, args.ops, undefined, {
    maxLhsSize: args.maxLhs,
    sqlDialect: args.dialect,
  });

  if (!result.success) {
    process.stderr.write(`failed: ${result.error}\n`);
    process.exit(1);
  }

  mkdirSync(args.out, { recursive: true });
  const written: string[] = [];
  for (const f of result.outputFiles) {
    const content = typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2);
    writeFileSync(join(args.out, f.name), content);
    written.push(f.name);
  }

  const summary = {
    success: true,
    tables: (result.tables ?? []).map(t => ({ name: t.tableName, rows: t.rowCount, columns: t.headers.length })),
    relations: (result.relations ?? []).map((r: any) => ({ name: r.name, attributes: r.attributes, primaryKey: r.primaryKey, foreignKeys: r.foreignKeys })),
    crossTableRelationships: result.crossTableRelationships ?? [],
    outputDir: args.out,
    files: written,
    duration: result.duration,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(`Analysed ${files.length} file(s) in ${result.duration}; ${summary.relations.length} relations.\n`);
    process.stdout.write(`Wrote ${written.length} files to ${args.out}/\n`);
  }
}

if (process.argv[1] && /cli\.ts$/.test(process.argv[1])) {
  main().catch(e => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
}
