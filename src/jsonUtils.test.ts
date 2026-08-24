import { describe, expect, it } from 'vitest';
import { extractJson, stripCodeFences, stripThinkTags } from './utils/jsonUtils';

describe('stripThinkTags', () => {
  it('removes terminated think blocks', () => {
    expect(stripThinkTags('<think>reasoning here</think>final answer')).toBe('final answer');
  });
  it('handles the legacy <thinking> variant', () => {
    expect(stripThinkTags('<thinking>r</thinking>ok')).toBe('ok');
  });
  it('drops unterminated blocks entirely', () => {
    expect(stripThinkTags('<think>dangling…')).toBe('');
  });
  it('leaves plain text untouched', () => {
    expect(stripThinkTags('plain')).toBe('plain');
  });
});

describe('stripCodeFences', () => {
  it('removes json fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe('extractJson', () => {
  it('parses direct JSON objects', () => {
    const result = extractJson<{ a: number }>('{"a":1}');
    expect(result?.parsed).toEqual({ a: 1 });
  });

  it('recovers JSON wrapped in prose and fences', () => {
    const input = 'Sure!\n```json\n{"operations":["1NF"],"explanation":"x"}\n```\nHope that helps';
    const result = extractJson(input);
    expect(result?.parsed).toEqual({ operations: ['1NF'], explanation: 'x' });
  });

  it('survives braces inside strings', () => {
    const result = extractJson('{"note": "has } brace"}');
    expect(result?.parsed).toEqual({ note: 'has } brace' });
  });

  it('extracts arrays', () => {
    const result = extractJson('prefix [{"type":"A","title":"t"}] suffix');
    expect(Array.isArray(result?.parsed)).toBe(true);
  });

  it('returns null when nothing is parseable', () => {
    expect(extractJson('no json at all')).toBeNull();
    expect(extractJson('')).toBeNull();
  });
});
