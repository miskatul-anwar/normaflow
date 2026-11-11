// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RelationshipsSection, KeysByTable, QualityByTable } from './MultiTableSections';

afterEach(cleanup);

describe('multi-table result sections', () => {
  it('lists the links between tables with cardinality and match ratio', () => {
    render(
      <RelationshipsSection
        relationships={[
          { sourceTable: 'track', sourceColumn: 'AlbumId', targetTable: 'album', targetColumn: 'AlbumId', cardinality: '1:N', confidence: 0.99, matchRatio: 1, detectedBy: 'VALUE_OVERLAP' },
        ]}
      />,
    );
    expect(screen.getByText('1:N', { selector: 'span.rounded-md.px-2' })).toBeTruthy();
    expect(screen.getByText('99.0%')).toBeTruthy();
    expect(document.body.textContent).toContain('album.AlbumId');
  });

  it('says so when no links were found', () => {
    render(<RelationshipsSection relationships={[]} />);
    expect(screen.getByText('No links between tables')).toBeTruthy();
  });

  it('shows keys per table, not as one flat list', () => {
    render(
      <KeysByTable
        tables={[
          { tableName: 'album', primaryKey: ['AlbumId'], candidateKeys: [{ attributes: ['AlbumId'] }, { attributes: ['Title'] }] },
          { tableName: 'artist', primaryKey: ['ArtistId'], candidateKeys: [{ attributes: ['ArtistId'] }] },
        ]}
      />,
    );
    expect(screen.getByText('album')).toBeTruthy();
    expect(screen.getByText('artist')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('summarises quality across tables and expands one on demand', () => {
    render(
      <QualityByTable
        tables={[
          { tableName: 'a', losslessCheck: { isLossless: true }, dependencyPreservation: { isPreserved: true } },
          { tableName: 'b', losslessCheck: { isLossless: true }, dependencyPreservation: { isPreserved: false } },
        ]}
      />,
    );
    expect(screen.getByText('Not preserved')).toBeTruthy();
    expect(screen.getAllByText(/\/ 2 tables/).length).toBe(2);
    const row = screen.getByRole('button', { name: /^b/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('explains how to get quality checks when none ran', () => {
    render(<QualityByTable tables={[{ tableName: 'a' }]} />);
    expect(screen.getByText('No quality checks yet')).toBeTruthy();
  });
});
