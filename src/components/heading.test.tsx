// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Heading from './heading';

afterEach(cleanup);

describe('upload button badge', () => {
  it('shows no count while the built-in sample is in use', () => {
    const { container } = render(<Heading uploadedFileCount={0} usingSample />);
    expect(container.textContent).not.toMatch(/^\s*1\s*$/);
    const btn = screen.getByRole('button', { name: 'Upload CSV Datasets' });
    expect(btn.textContent).toBe('');
    expect(btn.getAttribute('title')).toMatch(/built-in sample/i);
  });

  it('counts only files the user uploaded', () => {
    render(<Heading uploadedFileCount={2} usingSample={false} />);
    const btn = screen.getByRole('button', { name: 'Upload CSV Datasets' });
    expect(btn.textContent).toBe('2');
    expect(btn.getAttribute('title')).toMatch(/2 files loaded/);
  });
});
