/**
 * State for the workspace tabs: which tabs exist, which one is active, their
 * titles, and a small status each workspace reports (running, step count).
 *
 * Ids and the title counter are handled outside state updaters, which must stay
 * pure (React StrictMode runs them twice).
 */
import { useCallback, useRef, useState } from 'react';
import { isHexColor } from '../utils/tabColors';

export const MAX_TABS = 12;

export interface WorkspaceTab {
  id: string;
  title: string;
  /** True until the user renames it; an uploaded file name may then become the title. */
  autoTitle: boolean;
  /** Accent colour (`#rrggbb`), or null for the default look. */
  color: string | null;
}

export interface TabStatus {
  running: boolean;
  operations: number;
}

const IDLE: TabStatus = { running: false, operations: 0 };

export function useWorkspaceTabs() {
  const counter = useRef(1);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [{ id: 't1', title: 'Workspace 1', autoTitle: true, color: null }]);
  const [activeId, setActiveId] = useState('t1');
  const [status, setStatusMap] = useState<Record<string, TabStatus>>({});
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  /** Adds a tab. A given name is used as is (and stops a loaded file from renaming it); otherwise "Workspace n". */
  const addTab = useCallback((name?: string): string | null => {
    if (tabsRef.current.length >= MAX_TABS) return null;
    const n = ++counter.current;
    const given = name?.trim().slice(0, 40);
    const tab: WorkspaceTab = { id: `t${n}`, title: given || `Workspace ${n}`, autoTitle: !given, color: null };
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
      next = [{ id: `t${n}`, title: `Workspace ${n}`, autoTitle: true, color: null }];
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

  /** Colour a tab (`#rrggbb`), or pass null to clear it. Anything else is ignored. */
  const setTabColor = useCallback((id: string, color: string | null) => {
    if (color !== null && !isHexColor(color)) return;
    setTabs(t => t.map(x => (x.id === id ? { ...x, color } : x)));
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

  /** The default name the next new workspace would get. */
  const nextDefaultName = useCallback(() => `Workspace ${counter.current + 1}`, []);

  return { tabs, activeId, nextDefaultName, status, addTab, closeTab, renameTab, setTabColor, suggestTitle, selectTab, cycleTab, setStatus };
}
