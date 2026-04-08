// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import path from 'path';

const camelCaseFilename = {
  plugins: {
    'local': {
      rules: {
        'camelcase-filename': {
          create(context) {
            return {
              Program() {
                const filename = path.basename(context.filename, path.extname(context.filename));
                if (!/^[a-z][a-zA-Z0-9]*$/.test(filename)) {
                  context.report({
                    loc: { line: 1, column: 0 },
                    message: `Filename "{{ name }}" must be camelCase.`,
                    data: { name: filename },
                  });
                }
              },
            };
          },
        },
      },
    },
  },
  files: ['**/*.ts'],
  rules: {
    'local/camelcase-filename': 'error',
  },
};

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  camelCaseFilename,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
