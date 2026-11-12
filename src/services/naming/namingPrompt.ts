/**
 * The prompt for naming a relation. Columns only: sample values are never included, because a small model copies them into
 * the name and because the values would be the part of the data that most needs to stay private.
 * The examples teach the answer format (one singular noun phrase); they are not rules the code applies.
 */
export const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const EXAMPLES: Array<[string[], string]> = [
  [['emp_no', 'first_name', 'last_name', 'hire_date', 'salary'], 'Employee'],
  [['order_id', 'product_id', 'quantity', 'unit_price'], 'Order line'],
  [['isbn', 'title', 'author', 'publisher'], 'Book'],
  [['student_id', 'course_id', 'grade'], 'Enrollment'],
  [['dept_code', 'dept_name', 'building'], 'Department'],
];

const ask = (columns: string[]) =>
  `Database table columns: ${columns.join(', ')}\n\nName this table with one singular noun phrase of one to three words. Reply with only the name.`;

export function namingMessages(columns: string[]): ChatMessage[] {
  return [
    { role: 'system', content: 'You name database tables.' },
    ...EXAMPLES.flatMap(([c, n]): ChatMessage[] => [
      { role: 'user', content: ask(c) },
      { role: 'assistant', content: n },
    ]),
    { role: 'user', content: ask(columns) },
  ];
}
