import { OllamaWrapper } from '../services/ollama-wrapper';
import { ALL_OPERATION_NAMES } from '../config/operations';
import { invoke } from '@tauri-apps/api/core';
import { extractJson } from './jsonUtils';

export interface AIFlowGenerationResult {
  operations: string[];
  explanation: string;
  source: 'ollama' | 'rule-engine';
  modelUsed?: string;
}

const SYSTEM_PROMPT = `You are a database workflow generator. Map natural language commands to exact operation arrays.

AVAILABLE OPERATIONS:
${ALL_OPERATION_NAMES.map(op => `- ${op}`).join('\n')}

OUTPUT FORMAT:
JSON only, no code fences: {"operations": ["CSV Data Loader", ...], "explanation": "Generated operations."}`;

export function synthesizeSequenceFromRules(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const selected = new Set<string>();

  if (
    lower.includes('csv') ||
    lower.includes('load') ||
    lower.includes('clean') ||
    lower.includes('prep') ||
    lower.includes('normalize') ||
    lower.includes('database') ||
    lower.includes('schema') ||
    lower.includes('all')
  ) {
    selected.add('CSV Data Loader');
    selected.add('Data Cleaner');
    selected.add('Atomicity Checker');
    selected.add('Data Type Profiler');
  }

  if (lower.includes('ner') || lower.includes('entity') || lower.includes('tag')) {
    selected.add('NER Classifier');
  }

  if (
    lower.includes('1nf') ||
    lower.includes('fd') ||
    lower.includes('functional') ||
    lower.includes('dependency') ||
    lower.includes('key') ||
    lower.includes('2nf') ||
    lower.includes('3nf') ||
    lower.includes('normalize') ||
    lower.includes('all')
  ) {
    selected.add('1NF');
    selected.add('FD Miner');
    selected.add('Key Discovery');
  }

  if (lower.includes('foreign') || lower.includes('relation') || lower.includes('fk') || lower.includes('multi')) {
    selected.add('Relation Detector');
  }

  if (lower.includes('ai') || lower.includes('ollama') || lower.includes('llm')) {
    selected.add('Ollama AI Analyst');
  }

  if (lower.includes('cardinality') || lower.includes('erd') || lower.includes('all')) {
    selected.add('Cardinality Analyzer');
  }

  if (lower.includes('2nf') || lower.includes('3nf') || lower.includes('normalize') || lower.includes('all')) {
    selected.add('2NF');
  }

  if (lower.includes('3nf') || lower.includes('normalize') || lower.includes('all')) {
    selected.add('3NF');
    selected.add('Lossless Check');
    selected.add('Dependency Preservation');
  }

  if (lower.includes('erd') || lower.includes('diagram') || lower.includes('all')) {
    selected.add('ERD Generator');
  }

  if (lower.includes('sql') || lower.includes('ddl') || lower.includes('create table') || lower.includes('all')) {
    selected.add('Relation Generator');
    selected.add('SQL Generator');
  }

  if (lower.includes('report') || lower.includes('summary') || lower.includes('all')) {
    selected.add('Report Generator');
  }

  if (selected.size === 0) {
    return [
      'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler',
      '1NF', 'FD Miner', 'Key Discovery', '2NF', '3NF', 'ERD Generator', 'SQL Generator'
    ];
  }

  return ALL_OPERATION_NAMES.filter(op => selected.has(op));
}

export async function generateFlowFromNaturalLanguage(
  userPrompt: string,
  ollama?: OllamaWrapper | null
): Promise<AIFlowGenerationResult> {
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    return {
      operations: [],
      explanation: 'No input provided.',
      source: 'rule-engine'
    };
  }

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const model = ollama?.getSelectedModel() || 'qwen3:4b';
      const rustRes = await invoke<{ operations?: string[]; explanation?: string }>('generate_flow_ollama', {
        model,
        userPrompt: trimmed,
      });

      if (rustRes && Array.isArray(rustRes.operations)) {
        // Never surface unknown operation names — filter to the registry and
        // restore canonical pipeline order.
        const validOps = ALL_OPERATION_NAMES.filter(op =>
          rustRes.operations!.some(received => received.trim().toLowerCase() === op.toLowerCase()),
        );
        if (validOps.length > 0) {
          return {
            operations: validOps,
            explanation: rustRes.explanation || `Generated ${validOps.length} operations.`,
            source: 'ollama',
            modelUsed: model,
          };
        }
        console.warn('[AIFlowGenerator] Rust response contained no known operations:', rustRes.operations);
      }
    } catch (err) {
      console.warn('[AIFlowGenerator] Tauri generate_flow_ollama failed, falling back:', err);
    }
  }

  if (ollama && ollama.isServiceAvailable()) {
    try {
      const response = await ollama.chat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        options: { temperature: 0.1 },
      });

      const extracted = extractJson<{ operations?: string[]; explanation?: string }>(response.message.content);
      const parsedOperations = extracted?.parsed?.operations;
      if (Array.isArray(parsedOperations) && parsedOperations.length > 0) {
        const validOps = ALL_OPERATION_NAMES.filter(op =>
          parsedOperations.some((received: string) => String(received).trim().toLowerCase() === op.toLowerCase()),
        );
        if (validOps.length > 0) {
          return {
            operations: validOps,
            explanation: extracted?.parsed?.explanation || `Generated ${validOps.length} operations.`,
            source: 'ollama',
            modelUsed: response.modelUsed,
          };
        }
      }

      // Last resort: scan the prose for operation names.
      const contentLower = response.message.content.toLowerCase();
      const extractedOps = ALL_OPERATION_NAMES.filter(op => contentLower.includes(op.toLowerCase()));
      if (extractedOps.length > 0) {
        return {
          operations: extractedOps,
          explanation: `Extracted ${extractedOps.length} operations.`,
          source: 'ollama',
          modelUsed: response.modelUsed,
        };
      }
    } catch (error) {
      console.warn('[AIFlowGenerator] Ollama query error:', error);
    }
  }

  const ruleOperations = synthesizeSequenceFromRules(trimmed);
  return {
    operations: ruleOperations,
    explanation: `Synthesized ${ruleOperations.length} operations.`,
    source: 'rule-engine'
  };
}
