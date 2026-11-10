// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Heading from './heading';

afterEach(cleanup);

describe('upload button badge', () => {
  it('shows no count before anything is uploaded', () => {
    render(<Heading uploadedFileCount={0} />);
    const btn = screen.getByRole('button', { name: 'Upload CSV Datasets' });
    expect(btn.textContent).toBe('Upload'); // the label only, no count
    expect(btn.getAttribute('title')).toBe('Upload CSV files to analyse');
  });

  it('counts only files the user uploaded', () => {
    render(<Heading uploadedFileCount={2} />);
    const btn = screen.getByRole('button', { name: 'Upload CSV Datasets' });
    expect(btn.textContent).toBe('Upload2');
    expect(btn.getAttribute('title')).toMatch(/2 files loaded/);
  });
});
