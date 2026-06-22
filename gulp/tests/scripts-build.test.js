import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { config } from '../../gulp.config.js';

// Пути к исходникам и финальным бандлам на основе конфига проекта
const appTsSrcPath = path.join(config.srcFolder, 'js', 'app.ts');
const distJsDir = config.paths.scripts.dest; // Папка назначения (обычно dist/js)
const distMinJsPath = path.join(distJsDir, 'app.min.js'); // Финальный бандл скриптов

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

describe('📦 Интеграционные тесты сборки скриптов (Radik.Dev Scripts Pipeline)', () => {
  let originalTsContent = '';
  let originalDistJsContent = null;

  beforeEach(() => {
    // 1. Бекапим исходный код app.ts в src/
    if (fs.existsSync(appTsSrcPath)) {
      originalTsContent = fs.readFileSync(appTsSrcPath, 'utf-8');
    }
    // 2. Бекапим ваш готовый собранный app.min.js в dist/
    if (fs.existsSync(distMinJsPath)) {
      originalDistJsContent = fs.readFileSync(distMinJsPath, 'utf-8');
    }
  });

  afterAll(() => {
    // 1. Восстанавливаем оригинальный исходный код в src/
    if (originalTsContent) {
      fs.writeFileSync(appTsSrcPath, originalTsContent);
    }

    // 2. Восстанавливаем оригинальный рабочий бандл в dist/
    if (originalDistJsContent !== null) {
      fs.writeFileSync(distMinJsPath, originalDistJsContent);
    } else if (fs.existsSync(distMinJsPath)) {
      fs.unlinkSync(distMinJsPath);
    }

    // Чистим карту кода, если она сгенерировалась рядом
    const mapFile = `${distMinJsPath}.map`;
    if (fs.existsSync(mapFile)) fs.unlinkSync(mapFile);
  });

  it('Должен скомпилировать современный JS/TS, объединить модули и сгенерировать бандл app.min.js', () => {
    // Добавляем уникальный тестовый класс/функцию со стрелочным синтаксисом ES6,
    // чтобы проверить, как сборщик справляется с современными стандартами.
    const testCodeSnippet = `
      export const autotestScriptsDelivery = (): void => {
        const uniqueMarker = "radik-dev-bundle-success";
        console.log(\`[Autotest] Bundling state: \${uniqueMarker}\`);
      };
      // Самовызов для гарантированного попадания в итоговый код
      autotestScriptsDelivery();
    `;

    fs.appendFileSync(appTsSrcPath, testCodeSnippet);

    // Запускаем сборку скриптов через Gulp
    runGulpTask('npx gulp scripts');

    // ─── АТОМАРНЫЙ КОНТРОЛЬ СБОРКИ СКРИПТОВ ───

    // 1. Проверяем физическое наличие собранного бандла
    const jsFileExist = fs.existsSync(distMinJsPath);
    expect(
      jsFileExist,
      '❌ Итоговый бандл app.min.js не был создан в папке назначения',
    ).toBe(true);

    const compiledJs = fs.readFileSync(distMinJsPath, 'utf-8');

    // 2. Проверяем успешную компиляцию и объединение кода
    // Ищем маркерную строку, которую мы внедрили в src/
    const isCodeBundled = compiledJs.includes('radik-dev-bundle-success');
    expect(
      isCodeBundled,
      '❌ Тестовый код модуля не попал в скомпилированный бандл app.min.js',
    ).toBe(true);

    // 3. Проверяем генерацию Карт Кода (Sourcemaps)
    // Если в вашей таске scripts подключены sourcemaps, они оставляют след в коде
    expect(
      compiledJs,
      '❌ В собранном файле отсутствуют карты кода (sourceMappingURL)',
    ).toContain('sourceMappingURL');
  });
});
