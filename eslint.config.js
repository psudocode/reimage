import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Worker side of the code must never import React: it would be shipped to every
    // worker (see ADR 002). UI lives in `ui.ts` / `Panel.tsx` / `src/app`.
    files: [
      'src/core/**/*.ts',
      'src/codecs/**/*.ts',
      'src/tools/runtimeRegistry.ts',
      'src/tools/*/runtime.ts',
      'src/tools/*/options.ts',
    ],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react-dom/*',
                'react/*',
                '**/*.tsx',
                '**/ui.ts',
                '**/uiRegistry.ts',
              ],
              message:
                'Worker-side code must not import React or UI modules (see docs/adr/002-split-tool-runtime-and-ui.md).',
            },
          ],
        },
      ],
    },
  },
);
