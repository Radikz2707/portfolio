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

    // 🔥 РАСШИРЕНИЕ ДЛЯ СТАБИЛЬНОСТИ ТЯЖЕЛОГО СБОРЩИКА:
    // Выделяем до 20 секунд на выполнение долгих дисковых операций Gulp
    testTimeout: 20000,
    hookTimeout: 20000,

    // Запускаем файлы тестов по очереди (в один поток), чтобы они не дрались за диск
    fileParallelism: false,

    // 🔥 АКТУАЛЬНЫЙ СИНТАКСИС VITEST ДЛЯ ИЗОЛЯЦИИ ТЕСТОВОГО СЕРВЕРА:
    server: {
      deps: {
        external: [/gulp/],
      },
    },
  },
});
