// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportView } from './ReportView';

describe('ReportView', () => {
  it('shows structured sections, memory and cache figures, and a PDF download', () => {
    render(
      <ReportView
        markdown="# Report"
        fdData={[{ lhs: ['a'], rhs: 'b', confidence: 1 }]}
        levels={[{ id: '3NF', relations: [{ name: 'R1', attributes: ['a', 'b'], primaryKey: ['a'] }] }]}
        results={{
          duration: '1s',
          stats: { performanceMetrics: { checkpoints: [{ name: 'Done', time: 5, memory: 12.5 }], memorySource: 'heap', cacheHitRate: 0.5, cacheHits: 2, cacheMisses: 2 } },
          losslessCheck: { isLossless: true },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeTruthy();
    expect(screen.getByText('Memory (MB)')).toBeTruthy();
    expect(screen.getByText('12.50')).toBeTruthy();
    expect(screen.getByText(/Lossless join/)).toBeTruthy();
    expect(screen.getByText(/2 of 4 partition requests/)).toBeTruthy();
    expect(screen.getByText(/R1/)).toBeTruthy();
  });
});
