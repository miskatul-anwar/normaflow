import { describe, it, expect } from 'vitest';
import { NormalizationEngine } from './normalizationEngine';

describe('3NF synthesis keeps the preferred key among equivalent candidate keys', () => {
  const data = Array.from({ length: 8 }, (_, i) => ({ AlbumId: i + 1, ArtistId: (i % 3) + 1, Title: `T${i}` }));
  // AlbumId and Title identify each other; the table's own identifier ranks first.
  const fds = [
    { lhs: ['AlbumId'], rhs: 'ArtistId', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 8 },
    { lhs: ['AlbumId'], rhs: 'Title', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 8 },
    { lhs: ['Title'], rhs: 'AlbumId', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 8 },
    { lhs: ['Title'], rhs: 'ArtistId', confidence: 1, coverage: 1, violations: 0, uniqueGroups: 8 },
  ];

  it('uses AlbumId, not the equivalent Title, as the primary key', async () => {
    const rels = await NormalizationEngine.synthesize3NF(fds as any, [['AlbumId'], ['Title']], data);
    expect(rels).toHaveLength(1);
    expect(rels[0].primaryKey).toEqual(['AlbumId']);
  });

  it('respects the order it is given', async () => {
    const rels = await NormalizationEngine.synthesize3NF(fds as any, [['Title'], ['AlbumId']], data);
    expect(rels[0].primaryKey).toEqual(['Title']);
  });
});
