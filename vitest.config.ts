import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'gulp/tests/**/*.{test,spec}.js',
    ],
    setupFiles: ['./vitest.setup.ts'],

    // 🔥 ГЛАВНЫЙ СЕКРЕТ ДЛЯ СЕРВЕРНОГО КОДА В JSDOM:
    // Говорим Vite не анализировать импорты в папке gulp, а отдавать их напрямую в Node.js
    server: {
      deps: {
        inline: [/gulp/],
      },
    },
  },
});
