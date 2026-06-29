// gulp/lint.js — Абсолютная безопасность статического анализа кодовой базы
import { config } from '../gulp.config.js';
import { execFile } from 'child_process';

const isProdBuild = process.argv.includes('build');

// 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ СРЕДЫ WINDOWS:
// Параметр shell: true гарантирует запуск npx.cmd без вызова системного сбоя EINVAL
const execOptions = {
  env: { ...process.env, FORCE_COLOR: '1' },
  windowsHide: true,
  shell: true,
};

/**
 * Функция безопасного экранирования путей для Windows-сред (cmd/powershell)
 */
const sanitizePath = (p) => {
  if (!p) return '';
  // Удаляем любые попытки инъекции символов конвейеризации команд (&, |, ;, $, `)
  return p.replace(/[&|;$`]/g, '');
};

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

    // На Windows вызываем npx.cmd, на Unix-системах — чистый npx
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    execFile(cmd, args, execOptions, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
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
      if (stdout) process.stdout.write(stdout);
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
