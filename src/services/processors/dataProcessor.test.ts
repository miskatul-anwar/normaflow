import { describe, expect, it } from 'vitest';
import { DataProcessor } from './dataProcessor';

describe('DataProcessor', () => {
  describe('clean', () => {
    it('removes completely empty rows', async () => {
      const data = [
        { id: '1', name: 'Alice' },
        { id: '', name: '' },
        { id: null, name: undefined },
        { id: '2', name: 'Bob' }
      ];
      const cleaned = await DataProcessor.clean(data);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0]).toEqual({ id: '1', name: 'Alice' });
      expect(cleaned[1]).toEqual({ id: '2', name: 'Bob' });
    });

    it('preserves rows with valid 0 or false values', async () => {
      const data = [
        { id: '1', count: '0', active: 'false' },
        { id: '2', count: 0, active: false }
      ];
      const cleaned = await DataProcessor.clean(data);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].count).toBe('0');
      expect(cleaned[0].active).toBe('false');
    });

    it('cleans and trims keys and values', async () => {
      const data = [
        { '  title  ': '  Software Engineer  ', '  status  ': 'null' }
      ];
      const cleaned = await DataProcessor.clean(data);
      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]).toEqual({ title: 'Software Engineer', status: '' });
    });

    it('returns empty array when input is empty or null', async () => {
      expect(await DataProcessor.clean([])).toEqual([]);
      expect(await DataProcessor.clean(null as any)).toEqual([]);
    });
  });

  describe('checkAtomicity', () => {
    it('identifies non-atomic columns and isolates violations', async () => {
      const data = [
        { id: '1', skills: 'React, TypeScript, Node', department: 'Engineering' },
        { id: '2', skills: 'Figma; Photoshop', department: 'Design' }
      ];
      const result = await DataProcessor.checkAtomicity(data);
      expect(result.atomicity.id).toBe(true);
      expect(result.atomicity.department).toBe(true);
      expect(result.atomicity.skills).toBe(false);
      expect(result.violations.skills).toHaveLength(2);
      expect(result.violations.skills[0].row).toBe(1);
    });

    it('returns clean atomicity map when all columns are 1NF compliant', async () => {
      const data = [
        { id: '1', first_name: 'Alice', city: 'London' },
        { id: '2', first_name: 'Bob', city: 'Paris' }
      ];
      const result = await DataProcessor.checkAtomicity(data);
      expect(result.atomicity.id).toBe(true);
      expect(result.atomicity.first_name).toBe(true);
      expect(result.atomicity.city).toBe(true);
      expect(Object.keys(result.violations)).toHaveLength(0);
    });

    it('handles empty input gracefully', async () => {
      const result = await DataProcessor.checkAtomicity([]);
      expect(result).toEqual({ atomicity: {}, violations: {} });
    });
  });

  describe('profileDataTypes', () => {
    it('profiles data types across all columns correctly', async () => {
      const data = [
        { id: '1', score: '95.5', registered: 'true', email: 'test@example.com' },
        { id: '2', score: '88.0', registered: 'false', email: 'dev@example.org' }
      ];
      const types = await DataProcessor.profileDataTypes(data);
      expect(types.id).toBe('integer');
      expect(types.score).toBe('decimal');
      expect(types.registered).toBe('boolean');
      expect(types.email).toBe('email');
    });

    it('does not classify numeric street addresses as integer', async () => {
      const data = [
        { id: '1', address: '123 Main St' },
        { id: '2', address: '456 Oak Ave' }
      ];
      const types = await DataProcessor.profileDataTypes(data);
      expect(types.id).toBe('integer');
      expect(types.address).toBe('string');
    });

    it('correctly profiles columns containing only zeros', async () => {
      const data = [
        { id: '1', counter: 0 },
        { id: '2', counter: 0 }
      ];
      const types = await DataProcessor.profileDataTypes(data);
      expect(types.counter).toBe('integer');
    });

    it('returns empty object for empty input', async () => {
      expect(await DataProcessor.profileDataTypes([])).toEqual({});
    });
  });
});
