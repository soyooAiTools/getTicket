module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    jest: true,
    node: true,
  },
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/.vite/**'],
  extends: ['eslint:recommended'],
  globals: {
    defineAppConfig: 'readonly',
    wx: 'readonly',
  },
  rules: {
    'no-unused-vars': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  ],
};
