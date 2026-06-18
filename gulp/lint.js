import { config } from '../gulp.config.js';
import { exec } from 'child_process';

const isProdBuild = process.argv.includes('build');
const execOptions = { env: { ...process.env, FORCE_COLOR: '1' } };

// === ИСПРАВЛЕННЫЙ ТАСК STYLELINT ===
export const lintCss = (arg = null) => {
  return new Promise((resolve, reject) => {
    // Если первый аргумент — функция (коллбэк от Gulp), сбрасываем его в null
    const filePath = typeof arg === 'function' ? null : arg;

    const targetPath = filePath
      ? `"${filePath}"`
      : `"${config.srcFolder}/**/*.${config.scssExtension}"`;
    const fixFlag = isProdBuild ? '--fix' : '';

    exec(
      `npx stylelint ${targetPath} ${fixFlag} --allow-empty-input --custom-formatter=stylelint-formatter-pretty`,
      execOptions,
      (err, stdout, stderr) => {
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
      },
    );
  });
};

// === ИСПРАВЛЕННЫЙ ТАСК ESLINT ===
export const lintJs = (arg = null) => {
  return new Promise((resolve, reject) => {
    // 🔥 ЗАЩИТА: Если Gulp передал функцию done, игнорируем её и берём дефолтный путь
    const filePath = typeof arg === 'function' ? null : arg;

    const targetPath = filePath
      ? `"${filePath}"`
      : `"${config.srcFolder}/**/*.{js,ts}"`;
    const fixFlag = isProdBuild ? '--fix' : '';

    exec(
      `npx eslint ${targetPath} ${fixFlag}`,
      execOptions,
      (err, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);

        if (err && isProdBuild) {
          return reject(
            new Error('ESLint found unfixable errors. Fix them before deploy.'),
          );
        }
        resolve();
      },
    );
  });
};
