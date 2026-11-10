import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Read-only code viewer that stays fast on very large files.
 *
 * Only the rows inside the viewport (plus a small overscan) are in the DOM, and
 * only those rows are tokenized, so opening a 50,000-line schema costs the same
 * as opening a 50-line one. The previous viewer (Prism through
 * react-syntax-highlighter) built a React element for every token of every
 * line up front, which froze the page for seconds on large DDL.
 *
 * Highlighting is a small SQL tokenizer (comments, strings, quoted
 * identifiers, numbers, keywords). Block comments that span lines are tracked
 * once, in a single pass, so a row can be highlighted on its own.
 */

const ROW_HEIGHT = 20;
const OVERSCAN = 20;
/** Lines longer than this are shown unhighlighted; they are almost always data. */
const MAX_HIGHLIGHT_LENGTH = 2000;

const KEYWORDS = new Set(
  (
    'add all alter and as asc auto_increment begin between by cascade check column commit constraint create ' +
    'database default delete desc distinct drop engine exists foreign from if in index insert into is join key ' +
    'like not null on or order primary references restrict rollback schema select set table temporary ' +
    'transaction truncate unique unsigned update use using values view where with without zerofill charset ' +
    'collate comment start enable disable replace begin end then else case when generated always identity ' +
    'serial bigserial type domain sequence trigger function returns return language for each row execute ' +
    'before after instead of to rename no action deferrable initially deferred immediate pragma ' +
    'integer int bigint smallint tinyint mediumint decimal numeric float double real boolean bool bit ' +
    'char varchar nchar nvarchar text tinytext mediumtext longtext blob date time datetime timestamp year ' +
    'json jsonb uuid bytea character varying precision interval'
  ).split(' '),
);

type TokenKind = 'comment' | 'string' | 'ident' | 'number' | 'keyword' | 'plain';
interface Token {
  kind: TokenKind;
  text: string;
}

const COLORS: Record<TokenKind, string | undefined> = {
  comment: '#7f848e',
  string: '#98c379',
  ident: '#e5c07b',
  number: '#d19a66',
  keyword: '#c678dd',
  plain: undefined,
};

/** Whether each line starts inside a /* ... *\/ comment. One pass over the text. */
function blockCommentStarts(lines: string[]): Uint8Array {
  const starts = new Uint8Array(lines.length);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = inBlock ? 1 : 0;
    const line = lines[i];
    if (!inBlock && line.indexOf('/*') === -1) continue;
    let p = 0;
    while (p < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', p);
        if (end === -1) break;
        inBlock = false;
        p = end + 2;
      } else {
        const open = line.indexOf('/*', p);
        const dash = line.indexOf('--', p);
        if (open === -1 || (dash !== -1 && dash < open)) break;
        inBlock = true;
        p = open + 2;
      }
    }
  }
  return starts;
}

function tokenize(line: string, startsInBlock: boolean): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = line.length;
  let plainFrom = 0;
  const flush = (to: number) => {
    if (to > plainFrom) out.push({ kind: 'plain', text: line.slice(plainFrom, to) });
  };
  const push = (kind: TokenKind, from: number, to: number) => {
    flush(from);
    out.push({ kind, text: line.slice(from, to) });
    plainFrom = to;
  };

  if (startsInBlock) {
    const end = line.indexOf('*/');
    if (end === -1) return [{ kind: 'comment', text: line }];
    push('comment', 0, end + 2);
    i = end + 2;
  }

  while (i < n) {
    const c = line[i];
    const next = line[i + 1];
    if (c === '-' && next === '-') {
      push('comment', i, n);
      i = n;
    } else if (c === '#' && i === 0) {
      push('comment', i, n);
      i = n;
    } else if (c === '/' && next === '*') {
      const end = line.indexOf('*/', i + 2);
      const to = end === -1 ? n : end + 2;
      push('comment', i, to);
      i = to;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (line[j] === c) {
          if (line[j + 1] === c) j += 2; // doubled quote is an escaped quote
          else break;
        } else j++;
      }
      const to = Math.min(j + 1, n);
      push(c === "'" ? 'string' : 'ident', i, to);
      i = to;
    } else if (c >= '0' && c <= '9' && (i === 0 || !/[\w$]/.test(line[i - 1]))) {
      let j = i + 1;
      while (j < n && /[0-9.eE]/.test(line[j])) j++;
      push('number', i, j);
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(line[j])) j++;
      if (KEYWORDS.has(line.slice(i, j).toLowerCase())) push('keyword', i, j);
      i = j;
    } else {
      i++;
    }
  }
  flush(n);
  return out;
}

const Row = memo(function Row({ line, startsInBlock, highlight }: { line: string; startsInBlock: boolean; highlight: boolean }) {
  if (!highlight || line.length > MAX_HIGHLIGHT_LENGTH) return <>{line || ' '}</>;
  const tokens = tokenize(line, startsInBlock);
  if (tokens.length === 0) return <>{' '}</>;
  return (
    <>
      {tokens.map((t, k) => {
        const color = COLORS[t.kind];
        return color ? (
          <span key={k} style={{ color, fontStyle: t.kind === 'comment' ? 'italic' : undefined }}>
            {t.text}
          </span>
        ) : (
          t.text
        );
      })}
    </>
  );
});

export interface CodeViewerProps {
  code: string;
  /** Highlight as SQL. Anything else is shown as plain text. */
  language?: 'sql' | 'text';
  /** Height of the scroll area. */
  height?: string;
}

export function CodeViewer({ code, language = 'sql', height = 'calc(100vh - 17rem)' }: CodeViewerProps) {
  const lines = useMemo(() => code.split(/\r\n|\r|\n/), [code]);
  const blockStarts = useMemo(() => (language === 'sql' ? blockCommentStarts(lines) : new Uint8Array(lines.length)), [lines, language]);
  const longest = useMemo(() => lines.reduce((m, l) => (l.length > m ? l.length : m), 0), [lines]);
  const gutter = String(lines.length).length;

  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const frame = useRef(0);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setViewport(v => (v.top === el.scrollTop && v.height === el.clientHeight ? v : { top: el.scrollTop, height: el.clientHeight }));
  }, []);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [measure]);

  // A new document starts at the top.
  useEffect(() => {
    const el = scroller.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }, [code]);

  const first = Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(lines.length, Math.ceil((viewport.top + viewport.height) / ROW_HEIGHT) + OVERSCAN);
  const highlight = language === 'sql';

  const rows = [];
  for (let i = first; i < last; i++) {
    rows.push(
      <div key={i} className="flex" style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}>
        <span
          aria-hidden
          className="sticky left-0 select-none text-right pr-4 pl-3 shrink-0"
          style={{ minWidth: `${gutter + 3}ch`, color: '#636d83', background: '#282c34' }}
        >
          {i + 1}
        </span>
        <span className="whitespace-pre pr-6" style={{ color: '#abb2bf' }}>
          <Row line={lines[i]} startsInBlock={blockStarts[i] === 1} highlight={highlight} />
        </span>
      </div>,
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      role="region"
      aria-label="Code"
      tabIndex={0}
      className="overflow-auto rounded-lg"
      style={{
        height,
        background: '#282c34',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
      }}
    >
      <div style={{ height: lines.length * ROW_HEIGHT, minWidth: `${longest + gutter + 9}ch`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: first * ROW_HEIGHT, left: 0, right: 0 }}>{rows}</div>
      </div>
    </div>
  );
}
