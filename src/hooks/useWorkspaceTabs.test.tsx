// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useWorkspaceTabs, MAX_TABS } from './useWorkspaceTabs';
import { WorkspaceTabBar } from '../components/workflow/WorkspaceTabBar';
import { loadCachedResult, saveCachedResult, clearCachedResult } from '../utils/resultCache';

afterEach(cleanup);

describe('useWorkspaceTabs', () => {
  it('starts with one tab; adding selects the new tab with a unique name', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    expect(result.current.tabs.map(t => t.title)).toEqual(['Workspace 1']);
    act(() => void result.current.addTab());
    act(() => void result.current.addTab());
    expect(result.current.tabs.map(t => t.title)).toEqual(['Workspace 1', 'Workspace 2', 'Workspace 3']);
    expect(result.current.activeId).toBe('t3');
  });

  it('caps the number of tabs', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    for (let i = 0; i < MAX_TABS + 3; i++) act(() => void result.current.addTab());
    expect(result.current.tabs.length).toBe(MAX_TABS);
  });

  it('closing the active tab selects its right neighbour, else the left; ids are never reused', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    act(() => void result.current.addTab());
    act(() => void result.current.addTab()); // t1 t2 t3, active t3
    act(() => result.current.selectTab('t2'));
    act(() => result.current.closeTab('t2'));
    expect(result.current.activeId).toBe('t3');
    act(() => result.current.closeTab('t3'));
    expect(result.current.activeId).toBe('t1');
    act(() => void result.current.addTab());
    expect(result.current.tabs.map(t => t.id)).toEqual(['t1', 't4']);
  });

  it('closing the last tab leaves a fresh one', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    act(() => result.current.closeTab('t1'));
    expect(result.current.tabs.length).toBe(1);
    expect(result.current.tabs[0].id).not.toBe('t1');
    expect(result.current.activeId).toBe(result.current.tabs[0].id);
  });

  it('a file name titles an untouched tab, but never overrides a user rename', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    act(() => result.current.suggestTitle('t1', 'orders'));
    expect(result.current.tabs[0].title).toBe('orders');
    act(() => result.current.renameTab('t1', 'My analysis'));
    act(() => result.current.suggestTitle('t1', 'customers'));
    expect(result.current.tabs[0].title).toBe('My analysis');
    act(() => result.current.renameTab('t1', '   '));
    expect(result.current.tabs[0].title).toBe('My analysis');
  });

  it('cycles with wrap-around', () => {
    const { result } = renderHook(() => useWorkspaceTabs());
    act(() => void result.current.addTab());
    act(() => result.current.cycleTab(1));
    expect(result.current.activeId).toBe('t1');
    act(() => result.current.cycleTab(-1));
    expect(result.current.activeId).toBe('t2');
  });
});

describe('WorkspaceTabBar', () => {
  const tabs = [
    { id: 'a', title: 'Alpha', autoTitle: true },
    { id: 'b', title: 'Beta', autoTitle: true },
  ];
  const setup = () => {
    const h = { onSelect: vi.fn(), onAdd: vi.fn(), onClose: vi.fn(), onRename: vi.fn() };
    render(<WorkspaceTabBar tabs={tabs} activeId="a" status={{ b: { running: true, operations: 3 } }} {...h} />);
    return h;
  };

  it('selects, adds, closes and marks the active tab', () => {
    const h = setup();
    expect(screen.getByRole('tab', { name: /Alpha/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(h.onSelect).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    expect(h.onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close Beta' }));
    expect(h.onClose).toHaveBeenCalledWith('b');
    expect(h.onSelect).toHaveBeenCalledTimes(1); // the close click does not also select
  });

  it('renames on double-click + Enter, cancels on Escape', () => {
    const h = setup();
    fireEvent.doubleClick(screen.getByRole('tab', { name: /Alpha/ }));
    const input = screen.getByLabelText('Workspace name');
    fireEvent.change(input, { target: { value: 'Sales' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onRename).toHaveBeenCalledWith('a', 'Sales');
    fireEvent.doubleClick(screen.getByRole('tab', { name: /Alpha/ }));
    fireEvent.keyDown(screen.getByLabelText('Workspace name'), { key: 'Escape' });
    expect(screen.queryByLabelText('Workspace name')).toBeNull();
  });

  it('shows a running indicator', () => {
    setup();
    expect(screen.getAllByLabelText('Running').length).toBe(1);
  });
});

describe('per-tab result cache', () => {
  it('keeps results separate and clears one tab only', () => {
    saveCachedResult({ success: true, n: 1 }, 'x');
    saveCachedResult({ success: true, n: 2 }, 'y');
    expect((loadCachedResult('x') as any).n).toBe(1);
    expect((loadCachedResult('y') as any).n).toBe(2);
    clearCachedResult('x');
    expect(loadCachedResult('x')).toBeNull();
    expect((loadCachedResult('y') as any).n).toBe(2);
  });
});
