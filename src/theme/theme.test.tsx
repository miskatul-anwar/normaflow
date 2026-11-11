// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { currentTheme, initTheme } from './theme';
import { ThemeToggle } from './ThemeToggle';

function mockSystem(dark: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: dark && q.includes('dark'), addEventListener: () => {}, removeEventListener: () => {} }));
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  mockSystem(false);
});

describe('theme', () => {
  it('follows the system until the user chooses', () => {
    mockSystem(true);
    expect(initTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('a stored choice wins over the system', () => {
    mockSystem(true);
    localStorage.setItem('normaflow.theme', 'light');
    expect(currentTheme()).toBe('light');
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('normaflow.theme', 'purple');
    expect(currentTheme()).toBe('light');
  });

  it('the toggle switches, applies and remembers the theme', () => {
    initTheme();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('normaflow.theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    initTheme();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    vi.restoreAllMocks();
  });
});
