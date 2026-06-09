import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'archives/**',
      'gulpfile.js',
      'gulp/**/*.js',
      'gulp/**/*.ts',
      'webpack.config.js',
      '.vscode/**',
      '.idea/**',
      '*.log',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,

  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Автоудаление неиспользуемых переменных и импортов
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Предупреждение о any
      '@typescript-eslint/no-explicit-any': 'warn',
      // Запрет console.log только в продакшене
      'no-console': process.argv.includes('build') ? 'error' : 'off',
      // Строгие одиночные кавычки
      quotes: ['error', 'single', { avoidEscape: true }],
      // Обязательные точки с запятой
      semi: ['error', 'always'],
    },
  },
);
