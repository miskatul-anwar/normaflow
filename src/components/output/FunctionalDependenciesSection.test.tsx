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
