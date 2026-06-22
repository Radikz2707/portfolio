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
    }
  });

  it('Должен скомпилировать SCSS, сгруппировать медиа-выражения и собрать результат', () => {
    if (!fs.existsSync(distCssDir)) {
      fs.mkdirSync(distCssDir, { recursive: true });
    }

    const testScssSnippet = `
      .autotest-styles-delivery {
        display: flex;
        user-select: none;
        background-image: url('images/photo.jpg');

        &__inner {
          color: red;
        }
      }
    `;

    fs.appendFileSync(scssSrcPath, testScssSnippet);

    runGulpTask('npx gulp styles');

    expect(
      fs.existsSync(distMinCssPath),
      '❌ Файл app.min.css не был создан в папке dist/css',
    ).toBe(true);

    const minCss = fs.readFileSync(distMinCssPath, 'utf-8');

    expect(minCss.length, '❌ Скомпилированный CSS-файл пуст').toBeGreaterThan(
      0,
    );
    expect(
      minCss,
      '❌ CSS-бандл не содержит базовых стилей контейнеров или обнуления',
    ).toMatch(/container|body/);
  });
});
