// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { OperationPalette } from './OperationPalette';
import { ALL_OPERATION_NAMES } from '../../config/operations';

afterEach(cleanup);

const setup = (props: Partial<React.ComponentProps<typeof OperationPalette>> = {}) => {
  const h = { onAdd: vi.fn(), onAddWithPrerequisites: vi.fn(), onCollapse: vi.fn(), onResetWidth: vi.fn() };
  render(<OperationPalette width={248} {...h} {...props} />);
  return h;
};
const item = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}\\.`) });

describe('OperationPalette (list)', () => {
  it('shows every operation with its name and description', () => {
    setup();
    expect(screen.getAllByRole('listitem').length).toBe(ALL_OPERATION_NAMES.length);
    expect(within(item('1NF')).getByText('Enforces First Normal Form')).toBeTruthy();
  });

  it('marks added, ready and locked steps, and says why in words', () => {
    setup({ activeOperations: ['CSV Data Loader'] });
    expect(item('CSV Data Loader').getAttribute('data-state')).toBe('added');
    expect((item('CSV Data Loader') as HTMLButtonElement).disabled).toBe(true);
    expect(item('Data Cleaner').getAttribute('data-state')).toBe('ready');
    expect(item('3NF').getAttribute('data-state')).toBe('locked');
    expect(item('3NF').getAttribute('aria-label')).toMatch(/Needs 2NF\. Click to add it with its prerequisites/);
    expect(item('Data Cleaner').getAttribute('aria-label')).toMatch(/Click to add/);
  });

  it('a ready step is added directly; a locked step adds its prerequisites', () => {
    const h = setup({ activeOperations: ['CSV Data Loader'] });
    fireEvent.click(item('Data Cleaner'));
    expect(h.onAdd).toHaveBeenCalledWith('Data Cleaner');
    fireEvent.click(item('3NF'));
    expect(h.onAddWithPrerequisites).toHaveBeenCalledWith('3NF');
    expect(h.onAdd).toHaveBeenCalledTimes(1);
  });

  it('an added step does nothing when clicked', () => {
    const h = setup({ activeOperations: ['CSV Data Loader'] });
    fireEvent.click(item('CSV Data Loader'));
    expect(h.onAdd).not.toHaveBeenCalled();
  });

  it('shows progress per phase and overall', () => {
    setup({ activeOperations: ['CSV Data Loader', 'Data Cleaner'] });
    expect(screen.getByLabelText('2 of 19 on the canvas')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Prepare' })).getByText('2/5')).toBeTruthy();
  });

  it('filters by name or description, and Escape clears the filter', () => {
    setup();
    const box = screen.getByLabelText('Filter operations');
    fireEvent.change(box, { target: { value: 'sql' } });
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringContaining('SQL Generator')]);
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText(/No operations match/)).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.getAllByRole('listitem').length).toBe(ALL_OPERATION_NAMES.length);
  });

  it('arrow keys move focus between operations, skipping added ones', () => {
    setup({ activeOperations: ['Data Cleaner'] });
    item('CSV Data Loader').focus();
    fireEvent.keyDown(item('CSV Data Loader'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Atomicity Checker'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('CSV Data Loader'));
  });

  it('collapse and reset-width buttons work', () => {
    const h = setup({ width: 300 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset sidebar width' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(h.onResetWidth).toHaveBeenCalled();
    expect(h.onCollapse).toHaveBeenCalled();
  });
});

describe('OperationPalette (narrow rail)', () => {
  it('drops names, filter and footer but keeps every operation reachable and named', () => {
    setup({ width: 64 });
    expect(screen.queryByLabelText('Filter operations')).toBeNull();
    expect(screen.queryByText('Operations')).toBeNull();
    expect(screen.getAllByRole('listitem').length).toBe(ALL_OPERATION_NAMES.length);
    expect(item('2NF').getAttribute('data-state')).toBe('locked');
  });
});
