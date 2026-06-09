import { config } from '../gulp.config.js';
import gulp from 'gulp';
import browserSync from 'browser-sync';
import path from 'path';
import fs from 'fs';

import { styles } from './styles.js';
import { lintCss, lintJs } from './lint.js';

const { watch, series } = gulp;
export const bs = browserSync.create();

// Флаг режима продакшен сборки
export const isProd = process.argv.includes('build');

export const onError = function (err) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    `[Error] ${err.plugin || 'Gulp'}: ${err.message || err.toString()}`,
  );
  if (err.plugin !== 'webpack-stream') {
    this.emit('end');
  }
};

export function browsersync() {
  bs.init({
    server: {
      baseDir: config.buildFolder,
    },
    startPath: '/',
    open: 'local',
    notify: false,
    online: true,
  });
}

export function startwatch() {
  // 1. СЛЕДИТЕЛЬ ЗА СТИЛЯМИ
  const styleWatcher = watch(
    [`${config.srcFolder}/**/*.${config.preprocessor}`],
    { delay: 300 },
  );

  styleWatcher.on('change', async (filePath) => {
    try {
      await lintCss(filePath);
      series(styles)();
    } catch (err) {
      onError(err);
    }
  });

  // 2. СЛЕДИТЕЛЬ ЗА СКРИПТАМИ
  const scriptWatcher = watch([`${config.srcFolder}/**/*.{js,ts}`], {
    delay: 300,
  });

  scriptWatcher.on('change', async (filePath) => {
    try {
      await lintJs(filePath);
      if (isProd) {
        const scriptsTask = gulp.registry().get('scripts');
        if (scriptsTask) series(scriptsTask)();
      }
    } catch (err) {
      onError(err);
    }
  });

  // 3. АВТОНОМНЫЕ ВОТЧЕРЫ ДЛЯ РАЗМЕТКИ И КОНТЕНТА
  // Слежение за глобальными HTML-файлами проекта и компонентами
  watch(
    [
      `${config.srcFolder}/**/*.html`,
      `${config.srcFolder}/components/**/*.html`,
      `${config.srcFolder}/parts/**/*.html`,
    ],
    (done) => {
      const htmlTask = gulp.registry().get('html');
      if (htmlTask) return gulp.series('html')();
      done();
    },
  );

  // Слежение за изменениями текстов контента (blog, portfolio)
  watch(`${config.srcFolder}/content/**/*`, (done) => {
    const contentDir = path.join(config.srcFolder, 'content');
    if (fs.existsSync(contentDir)) {
      const folders = fs.readdirSync(contentDir);
      folders.forEach((folder) => {
        const taskKey = folder.toLowerCase();
        const registeredTask = gulp.registry().get(taskKey);
        if (registeredTask) gulp.series(taskKey)();
      });
    }
    done();
  });

  // Слежение за картинками в компонентах
  watch(
    `${config.srcFolder}/components/**/*.{jpg,jpeg,png,svg,webp,gif}`,
    (done) => {
      const imagesTask = gulp.registry().get('imagesDev');
      if (imagesTask) return gulp.series('imagesDev')();
      done();
    },
  );

  // Слежение за SVG-иконками для автосборки спрайта
  watch(config.paths.images.svg, (done) => {
    const spriteTask = gulp.registry().get('sprite');
    if (spriteTask) return gulp.series('sprite')();
    done();
  });
}
