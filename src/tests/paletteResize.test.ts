import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PALETTE_WIDTH,
  MIN_PALETTE_WIDTH,
  COLLAPSE_THRESHOLD,
  calculatePaletteColumns,
  clampPaletteWidth,
} from '../hooks/usePaletteResize';

describe('usePaletteResize logic & column organization', () => {
  describe('Constants', () => {
    it('defines standard palette default and bounds', () => {
      expect(DEFAULT_PALETTE_WIDTH).toBe(84);
      expect(MIN_PALETTE_WIDTH).toBe(70);
      expect(COLLAPSE_THRESHOLD).toBe(45);
    });
  });

  describe('calculatePaletteColumns', () => {
    it('organizes into 1 column for narrow widths (<= 100px)', () => {
      expect(calculatePaletteColumns(70)).toBe(1);
      expect(calculatePaletteColumns(84)).toBe(1);
      expect(calculatePaletteColumns(100)).toBe(1);
    });

    it('organizes dynamically into 2 columns for widths between ~120px and 170px', () => {
      expect(calculatePaletteColumns(130)).toBe(2);
      expect(calculatePaletteColumns(150)).toBe(2);
    });

    it('organizes dynamically into 3 columns for widths between ~175px and 230px', () => {
      expect(calculatePaletteColumns(180)).toBe(3);
      expect(calculatePaletteColumns(210)).toBe(3);
    });

    it('organizes dynamically into 4 columns for widths between ~235px and 290px', () => {
      expect(calculatePaletteColumns(240)).toBe(4);
      expect(calculatePaletteColumns(280)).toBe(4);
    });

    it('organizes dynamically into 5 or more columns for wide widths (>= 300px)', () => {
      expect(calculatePaletteColumns(300)).toBe(5);
      expect(calculatePaletteColumns(350)).toBe(6);
      expect(calculatePaletteColumns(450)).toBe(7);
      expect(calculatePaletteColumns(600)).toBe(10);
    });
  });

  describe('clampPaletteWidth', () => {
    it('snaps to collapsed when target width is below threshold (< 45px)', () => {
      const result = clampPaletteWidth(40, 1200);
      expect(result.isCollapsed).toBe(true);
      expect(result.width).toBe(DEFAULT_PALETTE_WIDTH);

      const resultZero = clampPaletteWidth(0, 1200);
      expect(resultZero.isCollapsed).toBe(true);
    });

    it('uncollapses and clamps to MIN_PALETTE_WIDTH when between threshold and min', () => {
      const result = clampPaletteWidth(55, 1200);
      expect(result.isCollapsed).toBe(false);
      expect(result.width).toBe(MIN_PALETTE_WIDTH);
    });

    it('allows expanding smoothly to standard and wide dimensions', () => {
      const w1 = clampPaletteWidth(84, 1200);
      expect(w1.isCollapsed).toBe(false);
      expect(w1.width).toBe(84);

      const w2 = clampPaletteWidth(260, 1200);
      expect(w2.isCollapsed).toBe(false);
      expect(w2.width).toBe(260);

      const w3 = clampPaletteWidth(500, 1200);
      expect(w3.isCollapsed).toBe(false);
      expect(w3.width).toBe(500);
    });

    it('clamps width to maximum viewport limit (windowWidth - 160)', () => {
      // For windowWidth = 1000, max width is 1000 - 160 = 840
      const result = clampPaletteWidth(950, 1000);
      expect(result.isCollapsed).toBe(false);
      expect(result.width).toBe(840);
    });
  });
});
