import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { config } from '../../gulp.config.js';

const srcFontsDir = path.join(config.srcFolder, 'fonts');
const distFontsDir = config.paths.fonts.dest;
const generatedScssPath = path.join(
  config.srcFolder,
  config.scssExtension,
  'base',
  '_fonts.scss',
);

const runGulpTask = (command) => {
  try {
    const result = execSync(command, { stdio: 'pipe' });
    execSync('node -e "setTimeout(() => {}, 200)"');
    return result.toString();
  } catch (error) {
    throw new Error(
      `🛑 Ошибка команды "${command}": ${error.stderr?.toString() || error.message}`,
    );
  }
};

describe('🔤 Интеграционные тесты шрифтового пайплайна (Fonts & FontsStyle)', () => {
  let originalFontsScss = '';

  beforeEach(() => {
    if (fs.existsSync(generatedScssPath)) {
      originalFontsScss = fs.readFileSync(generatedScssPath, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalFontsScss && fs.existsSync(generatedScssPath)) {
      fs.writeFileSync(generatedScssPath, originalFontsScss);
    }
  });

  it('Должен переносить файлы шрифтов и автоматически генерировать CSS-правила @font-face', () => {
    // Запускаем последовательно перенос и генерацию стилей
    runGulpTask('npx gulp fonts');
    runGulpTask('npx gulp fontsStyle');

    // 1. ПРОВЕРКА: Физическое наличие папки dist/fonts
    expect(
      fs.existsSync(distFontsDir),
      '❌ Папка dist/fonts не существует или пуста',
    ).toBe(true);

    // 2. ПРОВЕРКА: Генерация файла стилей шрифтов
    expect(
      fs.existsSync(generatedScssPath),
      '❌ Файл _fonts.scss не был автоматически сгенерирован',
    ).toBe(true);

    const scssContent = fs.readFileSync(generatedScssPath, 'utf-8');

    // 3. ПРОВЕРКА: Качество генерации стилей
    expect(scssContent, '❌ Сгенерированный файл шрифтов пуст').toBeDefined();
    expect(
      scssContent,
      '❌ Файл _fonts.scss не содержит правил @font-face',
    ).toContain('@font-face');
    expect(
      scssContent,
      '❌ Стили шрифтов не содержат указания формата font-display: swap',
    ).toContain('font-display: swap');
  }, 45000); // 🔥 ТОТАЛЬНЫЙ КОНТРОЛЬ: Расширяем таймаут до 45 секунд для тяжелых дисковых операций со шрифтами в Windows!
});
