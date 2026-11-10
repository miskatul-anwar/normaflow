import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PALETTE_WIDTH,
  MIN_PALETTE_WIDTH,
  LIST_MODE_MIN_WIDTH,
  MAX_PALETTE_WIDTH,
  COLLAPSE_THRESHOLD,
  clampPaletteWidth,
  isListMode,
} from '../hooks/usePaletteResize';

describe('sidebar sizing', () => {
  it('opens as a list, and the icon rail is the narrow end', () => {
    expect(isListMode(DEFAULT_PALETTE_WIDTH)).toBe(true);
    expect(isListMode(MIN_PALETTE_WIDTH)).toBe(false);
    expect(isListMode(LIST_MODE_MIN_WIDTH)).toBe(true);
    expect(isListMode(LIST_MODE_MIN_WIDTH - 1)).toBe(false);
    expect(MIN_PALETTE_WIDTH).toBeLessThan(LIST_MODE_MIN_WIDTH);
    expect(LIST_MODE_MIN_WIDTH).toBeLessThan(DEFAULT_PALETTE_WIDTH);
    expect(DEFAULT_PALETTE_WIDTH).toBeLessThan(MAX_PALETTE_WIDTH);
  });

  it('collapses fully when dragged below the threshold', () => {
    for (const w of [0, COLLAPSE_THRESHOLD - 1]) {
      const r = clampPaletteWidth(w, 1200);
      expect(r.isCollapsed).toBe(true);
      expect(r.width).toBe(DEFAULT_PALETTE_WIDTH); // re-expands to the default, not to a sliver
    }
  });

  it('clamps to the rail width at the narrow end and to the maximum at the wide end', () => {
    expect(clampPaletteWidth(COLLAPSE_THRESHOLD + 1, 1200)).toEqual({ width: MIN_PALETTE_WIDTH, isCollapsed: false });
    expect(clampPaletteWidth(200, 1200)).toEqual({ width: 200, isCollapsed: false });
    expect(clampPaletteWidth(900, 1600)).toEqual({ width: MAX_PALETTE_WIDTH, isCollapsed: false });
  });

  it('never exceeds the window minus room for the canvas', () => {
    const r = clampPaletteWidth(900, 480); // 480 - 160 = 320
    expect(r.width).toBe(320);
  });
});
