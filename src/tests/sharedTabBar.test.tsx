// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { saveCachedResult, clearCachedResult } from '../utils/resultCache';

beforeAll(() => {
  // React Flow measures nodes with these; jsdom has neither.
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).DOMMatrixReadOnly ??= class { m22 = 1; constructor() {} };
});
afterEach(() => {
  cleanup();
  clearCachedResult('t1');
  clearCachedResult('t2');
  window.history.pushState({}, '', '/');
});

const sqlResult = (sql: string) => ({ success: true, outputFiles: [{ name: 's.sql', type: 'sql', content: sql }] });

describe('one tab bar for the pipeline and the output page', () => {
  it('shows the tab strip on the pipeline page and on the output page', () => {
    saveCachedResult(sqlResult('SELECT 1;'), 't1');
    window.history.pushState({}, '', '/');
    const { unmount } = render(<App />);
    expect(screen.getByRole('navigation', { name: 'Workspaces' })).toBeTruthy();
    unmount();

    window.history.pushState({}, '', '/output');
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Workspace \d+$/ }).length).toBe(1);
  });

  it('switching tabs on the output page shows that tab\'s own results and keeps you on the output page', () => {
    saveCachedResult(sqlResult('SELECT 1;'), 't1');
    saveCachedResult(sqlResult('SELECT 2;'), 't2');
    window.history.pushState({}, '', '/output');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' })); // the first workspace is named on launch
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' })); // accepts "Workspace 2"; adds t2 and selects it
    expect(window.location.pathname).toBe('/output');
    expect(document.querySelector('[aria-current="true"].nf-tab-title')!.textContent).toContain('Workspace 2');

    fireEvent.click(screen.getAllByRole('button', { name: /^Workspace \d+$/ })[0]); // back to Workspace 1
    expect(window.location.pathname).toBe('/output');
    expect(document.querySelector('[aria-current="true"].nf-tab-title')!.textContent).toContain('Workspace 1');
  });
});
