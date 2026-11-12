import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri', 'node_modules', 'docs', 'public', 'scripts/**/*.mjs', 'scripts/**/*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    rules: {
      // Ratchet: warnings are capped in `npm run lint` (see --max-warnings) and lowered over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
      'preserve-caught-error': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
