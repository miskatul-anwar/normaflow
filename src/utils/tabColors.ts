/** Colours for workspace tabs. Plain hex strings so they can be stored and sent anywhere. */

export const TAB_COLOR_PRESETS: Array<{ name: string; value: string }> = [
  { name: 'Teal', value: '#0d9488' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Slate', value: '#475569' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/** Mix `hex` with white; `amount` 0 is white, 1 is the colour itself. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(255 + (c - 255) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Neutral surface used by the header and uncoloured tabs. */
export const NEUTRAL_SURFACE = 'var(--nf-chrome-base)';

/** Background shared by the active tab and the header, so the two read as one piece. */
/** A tab colour mixed into the theme's chrome surface, so it reads correctly in light and dark. */
const mixed = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, var(--nf-chrome-base))`;
export const activeSurface = (color: string | null): string => (color ? mixed(color, 16) : NEUTRAL_SURFACE);
export const inactiveSurface = (color: string | null): string =>
  color ? mixed(color, 9) : 'color-mix(in srgb, var(--nf-surface) 55%, transparent)';
