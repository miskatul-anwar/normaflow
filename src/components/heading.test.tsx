// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Heading from './heading';

afterEach(cleanup);

describe('upload button badge', () => {
  it('shows no count before anything is uploaded', () => {
    render(<Heading uploadedFileCount={0} />);
    const btn = screen.getByRole('button', { name: 'Upload Datasets' });
    expect(btn.textContent).toBe('Upload'); // the label only, no count
    expect(btn.getAttribute('title')).toBe('Upload CSV or spreadsheet files to analyse');
  });

  it('counts only files the user uploaded', () => {
    render(<Heading uploadedFileCount={2} />);
    const btn = screen.getByRole('button', { name: 'Upload Datasets' });
    expect(btn.textContent).toBe('Upload2');
    expect(btn.getAttribute('title')).toMatch(/2 files loaded/);
  });
});

describe('header layout', () => {
  const pos = (el: Element, ref: Element) => (el.compareDocumentPosition(ref) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after');

  it('keeps undo, redo and reset beside the logo, file actions in the centre, run and output on the right', () => {
    const { container } = render(<Heading />);
    const zones = Array.from(container.querySelector('.grid')!.children) as HTMLElement[];
    expect(zones).toHaveLength(3);
    const [left, centre, right] = zones;
    const inZone = (z: HTMLElement) => Array.from(z.querySelectorAll('button')).map(b => b.getAttribute('aria-label') ?? b.textContent);
    expect(left.querySelector('img')).toBeTruthy();
    expect(inZone(left)).toEqual(['Undo (Ctrl+Z)', 'Redo (Ctrl+Y)', 'Reset workspace']);
    expect(inZone(centre)).toEqual(['Open workflow', 'Save workflow', 'Upload Datasets']);
    expect(inZone(right)).toEqual(['Run the pipeline steps on the canvas', 'View results']);
    expect(pos(left, centre)).toBe('before');
    expect(pos(centre, right)).toBe('before');
  });

  it('centres the middle zone between two equal-width side columns', () => {
    const { container } = render(<Heading />);
    expect(container.querySelector('.grid')!.className).toContain('grid-cols-[1fr_auto_1fr]');
  });
});
