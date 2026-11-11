// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { FunctionalDependenciesSection } from './FunctionalDependenciesSection';

afterEach(cleanup);

const fds = Array.from({ length: 6 }, (_, i) => ({
  lhs: [`a${i}`], rhs: `b${i}`, confidence: 1, coverage: 1, violations: 0, uniqueGroups: i + 1,
}));

describe('FunctionalDependenciesSection', () => {
  it('shows the analysis directly under the row whose View was pressed', () => {
    render(<FunctionalDependenciesSection fdData={fds as any} />);
    const views = screen.getAllByRole('button', { name: /view/i });
    fireEvent.click(views[2]);

    const rows = screen.getAllByRole('row');
    const panelIndex = rows.findIndex(r => r.textContent?.includes('Dependency Analysis'));
    expect(panelIndex).toBeGreaterThan(0);
    // The row just above the panel is the third dependency (header row is index 0).
    expect(rows[panelIndex - 1].textContent).toContain('a2');
    expect(rows[panelIndex - 1].textContent).toContain('b2');
    // And the rows after it are the remaining dependencies, not the panel.
    expect(rows[panelIndex + 1].textContent).toContain('a3');
  });

  it('moves the panel when another View is pressed, and Hide closes it', async () => {
    render(<FunctionalDependenciesSection fdData={fds as any} />);
    fireEvent.click(screen.getAllByRole('button', { name: /view/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /view/i })[0]); // now the second row's View
    const panels = () => screen.queryAllByRole('row').filter(r => r.textContent?.includes('Dependency Analysis'));
    await waitFor(() => expect(panels().length).toBe(1)); // the first panel has animated out
    const rows = screen.getAllByRole('row');
    expect(rows[rows.indexOf(panels()[0]) - 1].textContent).toContain('a1');
    fireEvent.click(screen.getByRole('button', { name: /hide/i }));
    await waitFor(() => expect(panels().length).toBe(0));
  });
});

describe('FunctionalDependenciesSection list handling', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({
    lhs: [`col${i}`], rhs: `out${i}`, confidence: i % 3 === 0 ? 0.8 : 1, coverage: 1, violations: 0, uniqueGroups: 1, table: i < 60 ? 'orders' : 'users',
  }));

  it('pages long lists, filters by confidence and searches columns and tables', () => {
    render(<FunctionalDependenciesSection fdData={many as any} />);
    expect(screen.getByText(/Showing 50 of 120/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /show 50 more/i }));
    expect(screen.getByText(/Showing 100 of 120/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'low' }));
    expect(screen.getByText(/40 of 120/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'all' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'users' } });
    expect(screen.getByText(/60 of 120/)).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing-matches' } });
    expect(screen.getByText(/No dependencies match/)).toBeTruthy();
  });
});

describe('FunctionalDependenciesSection small-table warning', () => {
  const fd = (table: string, i: number) => ({ lhs: [`a${i}`], rhs: `b${i}`, confidence: 1, coverage: 1, violations: 0, uniqueGroups: 1, table });

  it('warns when dependencies come from tables with fewer than 100 rows', () => {
    render(<FunctionalDependenciesSection fdData={[fd('customer', 1), fd('customer', 2), fd('invoice', 3)] as any} tableRows={{ customer: 59, invoice: 412 }} />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('2 of these dependencies');
    expect(note.textContent).toContain('customer: 59');
    expect(note.textContent).not.toContain('invoice');
  });

  it('stays quiet when every table is large or the counts are unknown', () => {
    const { rerender } = render(<FunctionalDependenciesSection fdData={[fd('invoice', 1)] as any} tableRows={{ invoice: 412 }} />);
    expect(screen.queryByRole('note')).toBeNull();
    rerender(<FunctionalDependenciesSection fdData={[fd('invoice', 1)] as any} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
