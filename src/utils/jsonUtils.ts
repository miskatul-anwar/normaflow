/**
 * Robust JSON extraction from LLM output.
 *
 * Models routinely wrap JSON in Markdown code fences or surround it with
 * prose ("Sure! Here's your JSON: …"). These helpers recover structured data
 * without failing on the first non-JSON character.
 */

export interface ExtractedJson<T = unknown> {
  /** The raw JSON substring found in the text. */
  raw: string;
  parsed: T;
}

/** Find the first balanced JSON object/array in free text (string-aware). */
function findBalanced(text: string, open: '{' | '['): string | null {
  const close = open === '{' ? '}' : ']';
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    switch (ch) {
      case '"':
        inString = true;
        break;
      case open:
        depth++;
        break;
      case close:
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
        break;
      default:
        break;
    }
  }
  return null;
}

/** Strip <think>/<thinking> reasoning blocks emitted by local models. */
export function stripThinkTags(input: string): string {
  let out = input;
  for (const tag of ['think', 'thinking']) {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'i');
    if (re.test(out)) out = out.replace(re, '');
    else {
      // Unterminated block: everything after the opening tag is reasoning.
      const openIndex = out.search(new RegExp(`<${tag}>`, 'i'));
      if (openIndex !== -1) out = out.slice(0, openIndex);
    }
  }
  return out.trim();
}

/** Remove Markdown code fences around JSON payloads. */
export function stripCodeFences(input: string): string {
  return input.replace(/^\s*```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

/**
 * Parse the first JSON object OR array embedded in arbitrary model output.
 * When multiple balanced structures exist, the earliest one in the text wins.
 */
export function extractJson<T = unknown>(text: string): ExtractedJson<T> | null {
  if (!text) return null;
  const cleaned = stripCodeFences(stripThinkTags(text));

  const candidates = [
    cleaned,
    findBalanced(cleaned, '{'),
    findBalanced(cleaned, '['),
  ].filter((c): c is string => Boolean(c));

  // Prefer the structure that appears earliest (an array wrapping objects
  // should win over its first inner object).
  candidates.sort((a, b) => cleaned.indexOf(a) - cleaned.indexOf(b));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return { raw: candidate, parsed: parsed as T };
    } catch {
      // try next strategy
    }
  }
  return null;
}
