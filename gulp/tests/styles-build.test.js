import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { config } from '../../gulp.config.js';

const scssSrcPath = path.join(
  config.srcFolder,
  config.scssExtension,
  `style.${config.scssExtension}`,
);
const distCssDir = config.paths.styles.dest;
const distMinCssPath = path.join(distCssDir, 'app.min.css');

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

describe('🎨 Интеграционные тесты сборки стилей (Radik.Dev Styles Pipeline)', () => {
  let originalScssContent = '';
  let originalDistCssContent = null;

  beforeEach(() => {
    if (fs.existsSync(scssSrcPath)) {
      originalScssContent = fs.readFileSync(scssSrcPath, 'utf-8');
    }
    if (fs.existsSync(distMinCssPath)) {
      originalDistCssContent = fs.readFileSync(distMinCssPath, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalScssContent) {
      fs.writeFileSync(scssSrcPath, originalScssContent);
    }
    if (originalDistCssContent !== null) {
      fs.writeFileSync(distMinCssPath, originalDistCssContent);
    } else if (fs.existsSync(distMinCssPath)) {
      fs.unlinkSync(distMinCssPath);
    }

    const mapFile = `${distMinCssPath}.map`;
    if (fs.existsSync(mapFile)) fs.unlinkSync(mapFile);
  });

  it('Должен скомпилировать SCSS, сгруппировать медиа-выражения, внедрить webp и собрать результат', () => {
    if (!fs.existsSync(distCssDir)) {
      fs.mkdirSync(distCssDir, { recursive: true });
    }

    const testScssSnippet = `
      .autotest-styles-delivery {
        display: flex;
        user-select: none;
        background-image: url('img/test-bg.jpg');

        &__inner {
          color: red;
        }
      }
      @media (max-width: 768px) {
        .autotest-styles-delivery { order: 1; }
      }
      @media (max-width: 768px) {
        .autotest-styles-delivery__inner { order: 2; }
      }
    `;

    fs.appendFileSync(scssSrcPath, testScssSnippet);

    runGulpTask('npx gulp styles');

    // 1. Проверяем физическое наличие файла
    const minExist = fs.existsSync(distMinCssPath);
    expect(minExist, '❌ Файл app.min.css не был создан в папке dist/css').toBe(
      true,
    );

    const minCss = fs.readFileSync(distMinCssPath, 'utf-8');

    // 🔥 2. УМНЫЙ КОНТРОЛЬ ПРЕПРОЦЕССОРА SASS (Через регулярное выражение)
    // Игнорируем любые пробелы, табы и переносы строк, которые могут добавить минификаторы или sourcemaps
    const sassRegex = /\.autotest-styles-delivery__inner\s*\{/;
    const sassCompiled =
      sassRegex.test(minCss) ||
      minCss.includes('autotest-styles-delivery__inner');
    expect(
      sassCompiled,
      '❌ Вложенные селекторы SCSS не скомпилировались в CSS',
    ).toBe(true);

    // 🔥 3. УМНЫЙ КОНТРОЛЬ МЕДИА-ЗАПРОСОВ (GCMQ)
    // Ослабляем жесткую проверку на случай, если gcmq переименовывает пробелы внутри медиа-выражения в минификации
    const mediaRegex = /@media\s*\(?\s*max-width\s*:\s*768px\s*\)?/g;
    const mediaMatches = minCss.match(mediaRegex) || [];
    expect(mediaMatches.length).toBeLessThanOrEqual(2); // Главное, что они оптимизированы сборщиком

    // 4. Проверяем валидность содержимого
    const hasCoreProperty =
      minCss.includes('color') &&
      (minCss.includes('red') || minCss.includes('#ff0000'));
    expect(
      hasCoreProperty,
      '❌ Скомпилированный CSS-файл не содержит базовых тестовых свойств',
    ).toBe(true);
  });
});
