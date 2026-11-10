import { describe, it, expect } from 'vitest';
import { isHexColor, tint, activeSurface, inactiveSurface, TAB_COLOR_PRESETS, NEUTRAL_SURFACE } from './tabColors';

describe('tab colours', () => {
  it('validates #rrggbb only', () => {
    expect(isHexColor('#0d9488')).toBe(true);
    expect(isHexColor('#0D9488')).toBe(true);
    for (const bad of ['0d9488', '#fff', '#12345g', 'red', 'url(x)', '', null, undefined, 5]) expect(isHexColor(bad)).toBe(false);
    for (const p of TAB_COLOR_PRESETS) expect(isHexColor(p.value)).toBe(true);
  });

  it('tints toward white', () => {
    expect(tint('#000000', 0)).toBe('#ffffff');
    expect(tint('#336699', 1)).toBe('#336699');
    expect(tint('#000000', 0.5)).toBe('#808080');
  });

  it('gives the active tab and the header one shared surface', () => {
    expect(activeSurface(null)).toBe(NEUTRAL_SURFACE);
    expect(activeSurface('#2563eb')).toBe(tint('#2563eb', 0.16));
    expect(inactiveSurface('#2563eb')).not.toBe(activeSurface('#2563eb'));
  });
});
