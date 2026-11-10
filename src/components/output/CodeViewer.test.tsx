// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CodeViewer } from './CodeViewer';
import OutputPage from '../OutputPage';
import { clearCachedResult } from '../../utils/resultCache';

afterEach(cleanup);

const bigSql = (n: number) =>
  Array.from({ length: n }, (_, i) => `INSERT INTO t_${i} (a, b) VALUES (${i}, 'row ${i}'); -- note ${i}`).join('\n');

describe('CodeViewer', () => {
  it('opens a 100,000-line file quickly and only renders the rows near the viewport', () => {
    const code = bigSql(100_000);
    const t0 = performance.now();
    const { container } = render(<CodeViewer code={code} />);
    const ms = performance.now() - t0;
    const rows = container.querySelectorAll('div.flex');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
    expect(ms).toBeLessThan(1500);
    expect(container.textContent).toContain('t_0');
    expect(container.textContent).not.toContain('t_99999');
  });

  it('sizes the scroll area for every line so the scrollbar is the real length', () => {
    const { container } = render(<CodeViewer code={bigSql(1000)} />);
    const inner = container.querySelector('[role="region"] > div') as HTMLElement;
    expect(inner.style.height).toBe(`${1000 * 20}px`);
  });

  it('highlights keywords, strings, numbers, quoted identifiers and comments', () => {
    const { container } = render(<CodeViewer code={'CREATE TABLE "t" (id INT DEFAULT 42, n TEXT DEFAULT \'x\'); -- done'} />);
    const colored = Array.from(container.querySelectorAll('span[style*="color"]')).map(s => [s.textContent, (s as HTMLElement).style.color]);
    const byText = Object.fromEntries(colored.map(([t, c]) => [t, c]));
    expect(byText['CREATE']).toBe(byText['TABLE']); // keyword colour
    expect(byText['"t"']).not.toBe(byText['CREATE']); // identifier colour
    expect(byText["'x'"]).toBeDefined(); // string
    expect(byText['42']).toBeDefined(); // number
    expect(byText['-- done']).toBeDefined(); // comment
    expect(new Set([byText['CREATE'], byText['"t"'], byText["'x'"], byText['42'], byText['-- done']]).size).toBe(5);
  });

  it('keeps multi-line block comments highlighted on rows that start inside them', () => {
    const { container } = render(<CodeViewer code={'/* start\nmiddle SELECT\nend */ SELECT 1'} />);
    const middle = Array.from(container.querySelectorAll('span[style*="italic"]')).find(s => s.textContent === 'middle SELECT');
    expect(middle).toBeDefined(); // whole row is one comment token, SELECT is not a keyword here
    const end = Array.from(container.querySelectorAll('span[style*="italic"]')).map(s => s.textContent);
    expect(end).toContain('end */'); // comment closes mid-line
    const keywords = Array.from(container.querySelectorAll('span')).filter(s => s.textContent === 'SELECT' && !(s as HTMLElement).style.fontStyle);
    expect(keywords.length).toBe(1); // only the SELECT after the comment
  });

  it('shows plain text without highlighting', () => {
    const { container } = render(<CodeViewer code={'SELECT 1'} language="text" />);
    expect(container.querySelectorAll('span[style*="color: rgb(198"]').length).toBe(0);
  });

  it('copes with empty input, long lines and CRLF', () => {
    expect(() => render(<CodeViewer code="" />)).not.toThrow();
    const { container } = render(<CodeViewer code={'a\r\nb\r\n' + 'x'.repeat(50_000)} />);
    expect(container.textContent).toContain('x'.repeat(100));
  });
});

describe('OutputPage workspace badge', () => {
  const results = { success: true, outputFiles: [{ name: 's.sql', type: 'sql', content: 'SELECT 1;' }] };
  const tabs = [
    { id: 't1', title: 'Workspace 1', autoTitle: true, color: null },
    { id: 't2', title: 'Sales data', autoTitle: false, color: '#2563eb' },
  ];
  const at = (tabId: string) => (
    <MemoryRouter initialEntries={[{ pathname: '/output', state: { results, tabId } }]}>
      <OutputPage tabId={tabId} tabs={tabs} />
    </MemoryRouter>
  );

  it('has no workspace or status badges in the header (the tab strip says which workspace it is)', () => {
    render(at('t2'));
    expect(screen.queryByTitle(/These results come from the workspace/)).toBeNull();
    expect(screen.queryByText('Complete Pipeline Executed')).toBeNull();
    expect(screen.queryByText(/Tables Processed/)).toBeNull();
    expect(screen.getByText(/Analysis results/)).toBeTruthy();
  });

  it('uses the same shell as the pipeline page: header card, palette-style sidebar, content panel', () => {
    const { container } = render(at('t1'));
    expect(container.querySelector('.nf-shell > header.nf-header')).toBeTruthy();
    expect(container.querySelector('.nf-shell > aside.nf-palette')).toBeTruthy();
    expect(container.querySelector('.nf-shell > main.nf-canvas-panel')).toBeTruthy();
    const nav = screen.getByTestId('results-sidebar');
    expect(nav.textContent).toContain('Results');
    expect(nav.textContent).toContain('Summary');
    expect(nav.textContent).toContain('Analysis');
    expect(nav.textContent).toContain('Generated');
    expect(nav.textContent).toContain('DDL for your schema'); // row description, like the operations palette
  });

  it('still renders for a tab that no longer exists', () => {
    render(at('gone'));
    expect(screen.getByText(/Analysis results/)).toBeTruthy();
  });

  it('never shows one tab\'s fresh results under another tab', () => {
    // Results were passed for t2, but t1 is the active tab and has nothing cached.
    clearCachedResult('t1');
    render(
      <MemoryRouter initialEntries={[{ pathname: '/output', state: { results, tabId: 't2' } }]}>
        <OutputPage tabId="t1" tabs={tabs} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No results yet for “Workspace 1”/)).toBeTruthy();
    expect(screen.queryByText('SELECT 1;')).toBeNull();
  });
});
