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

    // 🔥 АКТУАЛЬНЫЙ СИНТАКСИС VITEST ДЛЯ ИЗОЛЯЦИИ ТЕСТОВОГО СЕРВЕРА:
    server: {
      deps: {
        external: [/gulp/],
      },
    },
  },
});
