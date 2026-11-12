// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

beforeAll(() => {
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).DOMMatrixReadOnly ??= class { m22 = 1; constructor() {} };
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const dialog = () => screen.queryByRole('dialog');
const field = () => screen.getByLabelText('Workspace name') as HTMLInputElement;
const tabTitles = () => Array.from(document.querySelectorAll('.nf-tab-title')).map(e => e.textContent);

describe('naming a workspace', () => {
  it('asks for a name when the app opens, with the default selected, and names the first tab', () => {
    render(<App />);
    expect(dialog()).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Name your workspace' })).toBeTruthy();
    expect(field().value).toBe('Workspace 1');
    expect(document.activeElement).toBe(field());

    fireEvent.change(field(), { target: { value: 'Sales data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(dialog()).toBeNull();
    expect(tabTitles()).toEqual(['Sales data']);
  });

  it('cannot be dismissed on launch (a workspace must exist) and will not accept an empty name', () => {
    render(<App />);
    fireEvent.keyDown(dialog()!, { key: 'Escape' });
    expect(dialog()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.change(field(), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Give it a name to continue.')).toBeTruthy();
  });

  it('Enter confirms', () => {
    render(<App />);
    fireEvent.change(field(), { target: { value: 'Orders' } });
    fireEvent.submit(field().closest('form')!);
    expect(tabTitles()).toEqual(['Orders']);
  });

  it('the + button asks for a name before adding the tab, and Cancel adds nothing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    expect(screen.getByRole('heading', { name: 'New workspace' })).toBeTruthy();
    expect(tabTitles()).toEqual(['Workspace 1']); // nothing yet

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(dialog()).toBeNull();
    expect(tabTitles()).toEqual(['Workspace 1']);

    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    fireEvent.keyDown(dialog()!, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(tabTitles()).toEqual(['Workspace 1']);

    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    fireEvent.change(field(), { target: { value: 'Chinook' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(tabTitles()).toEqual(['Workspace 1', 'Chinook']);
    expect(document.querySelector('[aria-current="true"].nf-tab-title')!.textContent).toBe('Chinook');
  });

  it('warns about a duplicate name but still allows it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    fireEvent.change(field(), { target: { value: 'workspace 1' } });
    expect(screen.getByText(/already has this name/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(tabTitles().length).toBe(2);
  });

  it('Ctrl+T opens the same dialog', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.keyDown(window, { key: 't', ctrlKey: true });
    expect(screen.getByRole('heading', { name: 'New workspace' })).toBeTruthy();
  });

  it('a name chosen here is not overwritten by the first uploaded file', () => {
    render(<App />);
    fireEvent.change(field(), { target: { value: 'My name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    // renamed tabs have autoTitle off, so suggestTitle leaves them alone (covered in useWorkspaceTabs tests)
    expect(tabTitles()).toEqual(['My name']);
  });
});
