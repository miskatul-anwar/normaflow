// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Button, IconButton, buttonVariants } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('defaults to a secondary, type=button button (never submits a form by accident)', () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('border-gray-200');
    expect(b.className).toContain('rounded-lg');
  });

  it('uses the same shape for every variant and size; only colour and size differ', () => {
    for (const variant of ['primary', 'secondary', 'ghost'] as const) {
      for (const size of ['sm', 'md', 'icon-sm', 'icon'] as const) {
        expect(buttonVariants({ variant, size })).toContain('rounded-lg');
      }
    }
    expect(buttonVariants({ variant: 'primary' })).toContain('text-white');
    // no gradients or one-off palettes
    for (const variant of ['primary', 'secondary', 'ghost'] as const) {
      expect(buttonVariants({ variant })).not.toMatch(/gradient|emerald|rounded-(xl|full)/);
    }
  });

  it('loading disables the button, marks it busy and blocks clicks', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Run</Button>);
    const b = screen.getByRole('button', { name: 'Run' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the tooltip on disabled buttons (no pointer-events: none)', () => {
    render(<Button disabled title="Upload a file first">Run</Button>);
    expect(screen.getByRole('button').className).not.toContain('disabled:pointer-events-none');
  });
});

describe('IconButton', () => {
  it('gives the icon-only button an accessible name and tooltip from its label', () => {
    const onClick = vi.fn();
    render(<IconButton label="Undo" icon={<svg data-testid="i" />} onClick={onClick} />);
    const b = screen.getByRole('button', { name: 'Undo' });
    expect(b.getAttribute('title')).toBe('Undo');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });
});
