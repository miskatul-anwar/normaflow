/**
 * Light / dark theme. The choice is stored locally; with no stored choice the app follows the
 * operating system. The theme is applied as `data-theme` on <html>, which switches the design tokens
 * in `styles/App.css` and the palette remap in `styles/theme.css`.
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'normaflow.theme';

function read(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // storage blocked
  }
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function currentTheme(): Theme {
  return read() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Apply the stored (or system) theme before the first paint. */
export function initTheme(): Theme {
  const t = currentTheme();
  applyTheme(t);
  return t;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  // Follow the system while the user has not chosen explicitly.
  useEffect(() => {
    let mq: MediaQueryList | undefined;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () => {
      if (read() === null) {
        const t = systemTheme();
        applyTheme(t);
        setTheme(t);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, []);

  const set = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* the choice still applies for this session */
    }
    applyTheme(t);
    setTheme(t);
  }, []);

  const toggle = useCallback(() => set(theme === 'dark' ? 'light' : 'dark'), [set, theme]);
  return { theme, set, toggle };
}
