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
    expect(screen.getByRole('tablist', { name: 'Workspaces' })).toBeTruthy();
    unmount();

    window.history.pushState({}, '', '/output');
    render(<App />);
    expect(screen.getByRole('tablist', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.getAllByRole('tab').length).toBe(1);
  });

  it('switching tabs on the output page shows that tab\'s own results and keeps you on the output page', () => {
    saveCachedResult(sqlResult('SELECT 1;'), 't1');
    saveCachedResult(sqlResult('SELECT 2;'), 't2');
    window.history.pushState({}, '', '/output');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' })); // adds t2 and selects it
    expect(window.location.pathname).toBe('/output');
    expect(screen.getByText('Workspace 2', { selector: '.truncate' })).toBeTruthy();

    fireEvent.click(screen.getAllByRole('tab')[0]); // back to Workspace 1
    expect(window.location.pathname).toBe('/output');
    expect(screen.getByText('Workspace 1', { selector: '.truncate' })).toBeTruthy();
  });
});
