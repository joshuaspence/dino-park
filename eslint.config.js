import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // core/ is plain TypeScript: no rendering, audio, UI or DOM-framework imports.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'core/ must not import three.js.' },
            { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: 'core/ must not import React.' },
            {
              group: ['**/render/**', '**/ui/**', '**/audio/**'],
              message: 'core/ must not import render/, ui/ or audio/.',
            },
          ],
        },
      ],
    },
  },
);
