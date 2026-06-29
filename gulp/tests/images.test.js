import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';
import { config } from '../../gulp.config.js';

const distImgDir = config.paths.images.dest; // Папка dist/images
const testWebpFile = path.join(distImgDir, 'photo.webp');

const runGulpTask = (command) => {
  try {
    const result = execSync(command, { stdio: 'pipe' });
    execSync('node -e "setTimeout(() => {}, 200)"');
    return result.toString();
  } catch (error) {
    throw new Error(
      `Ошибка команды "${command}": ${error.stderr?.toString() || error.message}`,
      { cause: error },
    );
  }
};

describe('🖼️ Интеграционные тесты графического пайплайна (Images, WebP & Sprite)', () => {
  it('Должен успешно обрабатывать графические ресурсы и генерировать WebP', () => {
    // 1. Запускаем сборку картинок и генерацию WebP
    runGulpTask('npx gulp images');
    runGulpTask('npx gulp createWebp');
    runGulpTask('npx gulp sprite');

    // 2. ПРОВЕРКА: Физическое наличие папки dist/images
    expect(
      fs.existsSync(distImgDir),
      '❌ Папка dist/images не существует',
    ).toBe(true);

    // 3. ПРОВЕРКА: Конвертация в WebP работает исправно
    expect(
      fs.existsSync(testWebpFile),
      '❌ Таска createWebp не сгенерировала photo.webp',
    ).toBe(true);
  }, 30000); // 🔥 ТОТАЛЬНЫЙ КОНТРОЛЬ: Расширяем таймаут до 30 секунд для тяжелых графических плагинов Gulp!
});
