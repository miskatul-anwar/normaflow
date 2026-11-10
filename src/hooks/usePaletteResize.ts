import { useCallback, useEffect, useState } from 'react';

// v2: the sidebar is now a list; widths saved by the old icon grid would open it as a thin rail.
const STORAGE_KEY_WIDTH = 'normaflow_palette_width_v2';
const STORAGE_KEY_COLLAPSED = 'normaflow_palette_collapsed';
/** Default width: a list with names and one-line descriptions. */
export const DEFAULT_PALETTE_WIDTH = 248;
/** Narrowest width; this is the icon-only rail. */
export const MIN_PALETTE_WIDTH = 64;
/** From this width up the sidebar shows the list; below it, the icon rail. */
export const LIST_MODE_MIN_WIDTH = 168;
export const MAX_PALETTE_WIDTH = 360;
export const COLLAPSE_THRESHOLD = 40;

/** True when the sidebar is wide enough to show names and descriptions. */
export const isListMode = (width: number): boolean => width >= LIST_MODE_MIN_WIDTH;

/** Calculate clamped width and collapsed flag given a target drag position. */
export function clampPaletteWidth(targetWidth: number, windowWidth = 1200): { width: number; isCollapsed: boolean } {
  if (targetWidth < COLLAPSE_THRESHOLD) {
    return { width: DEFAULT_PALETTE_WIDTH, isCollapsed: true };
  }
  const maxWidth = Math.min(MAX_PALETTE_WIDTH, Math.max(MIN_PALETTE_WIDTH, windowWidth - 160));
  const clamped = Math.min(Math.max(MIN_PALETTE_WIDTH, targetWidth), maxWidth);
  return { width: clamped, isCollapsed: false };
}

export interface UsePaletteResizeResult {
  width: number;
  isCollapsed: boolean;
  isDragging: boolean;
  toggleCollapse: () => void;
  resetWidth: () => void;
  handleResizeStart: (event: React.MouseEvent, startFromCollapsed?: boolean) => void;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePaletteResize(): UsePaletteResizeResult {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
      const parsed = saved ? parseInt(saved, 10) : DEFAULT_PALETTE_WIDTH;
      return Number.isFinite(parsed) && parsed >= MIN_PALETTE_WIDTH ? parsed : DEFAULT_PALETTE_WIDTH;
    } catch {
      return DEFAULT_PALETTE_WIDTH;
    }
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(width));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [width]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(isCollapsed));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [isCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      return next;
    });
  }, []);

  const resetWidth = useCallback(() => {
    setWidth(DEFAULT_PALETTE_WIDTH);
    setIsCollapsed(false);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }, []);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent, startFromCollapsed = false) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);

      const startX = event.clientX;
      const initialWidth = startFromCollapsed || isCollapsed ? 0 : width;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const targetWidth = initialWidth + delta;

        if (targetWidth < COLLAPSE_THRESHOLD) {
          setIsCollapsed(true);
        } else {
          const maxWidth = Math.min(MAX_PALETTE_WIDTH, Math.max(MIN_PALETTE_WIDTH, window.innerWidth - 160));
          const clamped = Math.min(Math.max(MIN_PALETTE_WIDTH, targetWidth), maxWidth);
          setIsCollapsed(false);
          setWidth(clamped);
        }
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isCollapsed, width],
  );

  return {
    width,
    isCollapsed,
    isDragging,
    toggleCollapse,
    resetWidth,
    handleResizeStart,
    setWidth,
    setIsCollapsed,
  };
}
