process.env.ENABLE_NEW_JSX_TRANSFORM = 'true';

const mcAppConfig = require('@commercetools-frontend/eslint-config-mc-app');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'dist/**', 'coverage/**'],
  },
  ...mcAppConfig,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
    },
  },
  {
    files: ['eslint.config.js'],
    rules: { 'import/extensions': 'off' },
  },
];
