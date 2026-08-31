import path from 'path';
import { config } from '../gulp.config.js';
import { execFile } from 'child_process';
import { createRequire } from 'module';

// Создаем безопасный контекст require для динамических пакетов
const require = createRequire(import.meta.url);

// Мягко импортируем нотификатор. Если пакета нет на диске, проект НЕ упадет
let notifier = null;
try {
  notifier = require('node-notifier');
} catch {
  // Пакет не установлен, пропускаем отправку пушей
}

const isProdBuild = process.argv.includes('build');
const execOptions = {
  env: { ...process.env, FORCE_COLOR: '1' },
  windowsHide: true,
  shell: true,
};
const sanitizePath = (p) => (p ? p.replace(/[&|;`]/g, '') : '');

// === БЕЗОПАСНЫЙ ТАСК STYLELINT ===
export const lintCss = (arg = null) => {
  return new Promise((resolve, reject) => {
    const filePath = typeof arg === 'function' ? null : arg;
    const args = ['stylelint'];

    if (filePath) {
      args.push(sanitizePath(filePath));
    } else {
      args.push(`${config.srcFolder}/**/*.${config.scssExtension}`);
    }

    if (isProdBuild) args.push('--fix');
    args.push(
      '--allow-empty-input',
      '--custom-formatter=stylelint-formatter-pretty',
    );

    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    execFile(cmd, args, execOptions, (err, stdout, stderr) => {
      if (stdout) {
        process.stdout.write(stdout);

        // Парсим вывод консоли только если пакет node-notifier успешно загружен
        if (
          notifier &&
          (stdout.includes('warning') || stdout.includes('error') || err)
        ) {
          const filePaths = stdout.match(/(src\/[^\s\n]+)/g) || [];
          const uniqueFiles = [...new Set(filePaths)].map((p) =>
            path.basename(p),
          );

          const filesChunk =
            uniqueFiles.length > 0
              ? `Файлы: ${uniqueFiles.slice(0, 3).join(', ')}`
              : 'Обнаружены ошибки в стилях';

          notifier.notify({
            title: '⚠️ [Stylelint Control] SCSS Defects!',
            message: `${filesChunk}. Проверьте терминал VS Code для исправления.`,
            sound: true,
            wait: false,
          });
        }
      }

      if (stderr) process.stderr.write(stderr);

      if (err && isProdBuild) {
        return reject(
          new Error(
            'Stylelint found unfixable defects. Fix them before deploy.',
          ),
        );
      }
      resolve();
    });
  });
};

// === БЕЗОПАСНЫЙ ТАСК ESLINT ===
export const lintJs = (arg = null) => {
  return new Promise((resolve, reject) => {
    const filePath = typeof arg === 'function' ? null : arg;
    const args = ['eslint'];

    if (filePath) {
      args.push(sanitizePath(filePath));
    } else {
      args.push(`${config.srcFolder}/**/*.{js,ts}`);
    }

    if (isProdBuild) args.push('--fix');

    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    execFile(cmd, args, execOptions, (err, stdout, stderr) => {
      if (stdout) {
        process.stdout.write(stdout);

        if (
          notifier &&
          (stdout.includes('warning') ||
            stdout.includes('error') ||
            stdout.includes('no-unused-vars'))
        ) {
          const filePaths =
            stdout.match(/(src\/[^\s\n]+|gulpfile\.js|gulp\/[^\s\n]+)/g) || [];
          const uniqueFiles = [...new Set(filePaths)].map((p) =>
            path.basename(p),
          );

          const filesChunk =
            uniqueFiles.length > 0
              ? `Файлы: ${uniqueFiles.slice(0, 3).join(', ')}${uniqueFiles.length > 3 ? '...' : ''}`
              : 'Обнаружены неиспользуемые переменные';

          notifier.notify({
            title: '⚠️ [ESLint Control] Unused Variables!',
            message: `${filesChunk}. Проверьте терминал VS Code для очистки кода.`,
            sound: true,
            wait: false,
          });
        }
      }

      if (stderr) process.stderr.write(stderr);

      if (err && isProdBuild) {
        return reject(
          new Error('ESLint found unfixable errors. Fix them before deploy.'),
        );
      }
      resolve();
    });
  });
};
