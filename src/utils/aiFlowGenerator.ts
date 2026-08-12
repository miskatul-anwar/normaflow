import { OllamaWrapper } from '../services/ollama-wrapper';
import { OPERATIONS, ALL_OPERATION_NAMES } from '../config/operations';

export interface AIFlowGenerationResult {
  operations: string[];
  explanation: string;
  source: 'ollama' | 'rule-engine';
  modelUsed?: string;
}

const SYSTEM_PROMPT = `You are a database workflow generator. Map natural language commands to exact operation arrays.

AVAILABLE OPERATIONS:
- CSV Data Loader
- Data Cleaner
- Atomicity Checker
- Data Type Profiler
- NER Classifier
- 1NF
- FD Miner
- Key Discovery
- Relation Detector
- Ollama AI Analyst
- Cardinality Analyzer
- 2NF
- 3NF
- Lossless Check
- Dependency Preservation
- ERD Generator
- Relation Generator
- SQL Generator
- Report Generator

OUTPUT FORMAT:
JSON only: {"operations": ["CSV Data Loader", ...], "explanation": "Generated 4 operations."}`;

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

  if (ollama && ollama.isServiceAvailable()) {
    try {
      const response = await ollama.chat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed }
        ],
        options: { temperature: 0.1 }
      });

      const content = response.message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.operations)) {
            const validOps = parsed.operations
              .map((op: string) => op.trim())
              .filter((op: string) => OPERATIONS[op]);

            if (validOps.length > 0) {
              const orderedOps = ALL_OPERATION_NAMES.filter(op => validOps.includes(op));
              return {
                operations: orderedOps,
                explanation: `Generated ${orderedOps.length} operations.`,
                source: 'ollama',
                modelUsed: response.modelUsed
              };
            }
          }
        } catch {
          // Fallback to text parsing
        }
      }

      const extractedOps = ALL_OPERATION_NAMES.filter(op => 
        content.toLowerCase().includes(op.toLowerCase())
      );

      if (extractedOps.length > 0) {
        return {
          operations: extractedOps,
          explanation: `Extracted ${extractedOps.length} operations.`,
          source: 'ollama',
          modelUsed: response.modelUsed
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
