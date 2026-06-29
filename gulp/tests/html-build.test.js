import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { config } from '../../gulp.config.js';

const indexHtmlSrcPath = path.join(config.srcFolder, 'index.html');
const distHtmlPath = path.join(config.buildFolder, 'index.html');

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

describe('📄 Интеграционные тесты сборки разметки (Radik.Dev HTML Pipeline)', () => {
  let originalHtmlContent = '';
  let originalDistHtmlContent = null;

  beforeEach(() => {
    if (fs.existsSync(indexHtmlSrcPath)) {
      originalHtmlContent = fs.readFileSync(indexHtmlSrcPath, 'utf-8');
    }
    if (fs.existsSync(distHtmlPath)) {
      originalDistHtmlContent = fs.readFileSync(distHtmlPath, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalHtmlContent) {
      fs.writeFileSync(indexHtmlSrcPath, originalHtmlContent);
    }
    if (originalDistHtmlContent !== null) {
      fs.writeFileSync(distHtmlPath, originalDistHtmlContent);
    } else if (fs.existsSync(distHtmlPath)) {
      fs.unlinkSync(distHtmlPath);
    }
  });

  it('Должен собрать HTML-шаблоны через file-include и отформатировать разметку', () => {
    // Внедряем маркерную строку, которая гарантированно пройдёт сквозь сборщик
    const uniqueTestMarker = 'class="radik-dev-html-build-success-marker"';
    const testSnippet = `\n<div ${uniqueTestMarker}></div>\n`;

    fs.appendFileSync(indexHtmlSrcPath, testSnippet);

    // Запускаем сборку разметки
    runGulpTask('npx gulp html');

    // ─── АУДИТ СБОРКИ HTML ───

    // 1. Проверяем физическое наличие файла в папке назначения
    expect(
      fs.existsSync(distHtmlPath),
      '❌ Файл index.html не был создан в папке dist',
    ).toBe(true);

    const compiledHtml = fs.readFileSync(distHtmlPath, 'utf-8');

    // 2. Проверяем, что сборщик успешно обработал файл и сохранил структуру
    expect(
      compiledHtml,
      '❌ Тестовый фрагмент разметки не попал в итоговый index.html',
    ).toContain(uniqueTestMarker);

    // 3. Проверяем, что в собранном файле успешно склеились ваши реальные компоненты (например, header)
    expect(
      compiledHtml,
      '❌ Шаблонизатор сломался: в итоговом файле не найден класс header',
    ).toContain('class="header"');
    expect(
      compiledHtml,
      '❌ Директивы @@include остались в коде нерасшифрованными',
    ).not.toContain('@@include');

    // 4. Проверяем форматирование разметки (html-beautify)
    const lines = compiledHtml.split(/\r?\n/);
    expect(
      lines.length,
      '❌ Ошибка форматирования: итоговый HTML склеен в одну строку',
    ).toBeGreaterThan(5);
  });
});
