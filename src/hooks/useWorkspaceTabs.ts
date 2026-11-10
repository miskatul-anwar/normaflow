/**
 * State for the workspace tabs: which tabs exist, which one is active, their
 * titles, and a small status each workspace reports (running, step count).
 *
 * Ids and the title counter are handled outside state updaters, which must stay
 * pure (React StrictMode runs them twice).
 */
import { useCallback, useRef, useState } from 'react';

export const MAX_TABS = 12;

export interface WorkspaceTab {
  id: string;
  title: string;
  /** True until the user renames it; an uploaded file name may then become the title. */
  autoTitle: boolean;
}

export interface TabStatus {
  running: boolean;
  operations: number;
}

const IDLE: TabStatus = { running: false, operations: 0 };

export function useWorkspaceTabs() {
  const counter = useRef(1);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [{ id: 't1', title: 'Workspace 1', autoTitle: true }]);
  const [activeId, setActiveId] = useState('t1');
  const [status, setStatusMap] = useState<Record<string, TabStatus>>({});
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  const addTab = useCallback((): string | null => {
    if (tabsRef.current.length >= MAX_TABS) return null;
    const n = ++counter.current;
    const tab: WorkspaceTab = { id: `t${n}`, title: `Workspace ${n}`, autoTitle: true };
    tabsRef.current = [...tabsRef.current, tab];
    setTabs(tabsRef.current);
    setActiveId(tab.id);
    return tab.id;
  }, []);

  /** Closes a tab; the last remaining tab is replaced by a fresh empty one. */
  const closeTab = useCallback((id: string) => {
    const current = tabsRef.current;
    const index = current.findIndex(t => t.id === id);
    if (index < 0) return;
    let next = current.filter(t => t.id !== id);
    let nextActive = activeRef.current;
    if (next.length === 0) {
      const n = ++counter.current;
      next = [{ id: `t${n}`, title: `Workspace ${n}`, autoTitle: true }];
      nextActive = next[0].id;
    } else if (activeRef.current === id) {
      nextActive = (next[index] ?? next[index - 1]).id;
    }
    tabsRef.current = next;
    setTabs(next);
    setActiveId(nextActive);
    setStatusMap(s => {
      const { [id]: _removed, ...rest } = s;
      return rest;
    });
  }, []);

  const renameTab = useCallback((id: string, title: string) => {
    const clean = title.trim().slice(0, 40);
    if (!clean) return;
    setTabs(t => t.map(x => (x.id === id ? { ...x, title: clean, autoTitle: false } : x)));
  }, []);

  /** Name an untouched tab after its first file. */
  const suggestTitle = useCallback((id: string, title: string) => {
    const clean = title.trim().slice(0, 40);
    if (!clean) return;
    setTabs(t => t.map(x => (x.id === id && x.autoTitle && x.title !== clean ? { ...x, title: clean } : x)));
  }, []);

  const selectTab = useCallback((id: string) => {
    if (tabsRef.current.some(t => t.id === id)) setActiveId(id);
  }, []);

  /** Move the selection by `delta` tabs, wrapping around. */
  const cycleTab = useCallback((delta: number) => {
    const list = tabsRef.current;
    const i = list.findIndex(t => t.id === activeRef.current);
    setActiveId(list[(i + delta + list.length) % list.length].id);
  }, []);

  const setStatus = useCallback((id: string, next: TabStatus) => {
    setStatusMap(s => {
      const prev = s[id] ?? IDLE;
      return prev.running === next.running && prev.operations === next.operations ? s : { ...s, [id]: next };
    });
  }, []);

  return { tabs, activeId, status, addTab, closeTab, renameTab, suggestTitle, selectTab, cycleTab, setStatus };
}
