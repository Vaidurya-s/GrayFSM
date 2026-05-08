module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // `any` is now an error — every escape hatch must be justified with
    // an inline `// eslint-disable-next-line` and a comment. `unknown`
    // plus an explicit narrow is almost always the better choice.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Quality-of-life rules that catch real bugs:
    'eqeqeq': ['error', 'always'],
    'no-debugger': 'error',
    'prefer-const': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
