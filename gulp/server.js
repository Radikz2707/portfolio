import { config } from '../gulp.config.js';
import gulp from 'gulp';
import browserSync from 'browser-sync';
import path from 'path';
import fs from 'fs';

const { watch, series } = gulp;
export const bs = browserSync.create();

export const isProd = process.argv.includes('build');

// =========================================================================
// 🎛️ 1. БЕЗОПАСНЫЙ ОБРАБОТЧИК ОШИБОК ДЛЯ ПОТОКОВ GULP 5 (STREAMX)
// =========================================================================
export const onError = function (err) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    `[Error] ${err.plugin || 'Gulp'}: ${err.message || err.toString()}`,
  );
  if (err.plugin !== 'webpack-stream') {
    this.emit('end');
  }
};

// =========================================================================
// 🌐 2. ИНИЦИАЛИЗАЦИЯ ЛОКАЛЬНОГО СЕРВЕРА BROWSER-SYNC (ИСПРАВЛЕНО)
// =========================================================================
export function browsersync(done) {
  // 🔥 Вернули оригинальное имя функции
  bs.init(
    {
      server: {
        baseDir: config.buildFolder, // папка dist
      },
      ghostMode: false,
      notify: false,
      online: true,
      port: 3000,
      open: true, // Принудительно открывает браузер при старте
    },
    done,
  ); // Передали done вторым аргументом, чтобы Gulp не бросал сокеты
}

// Вспомогательный хелпер для ленивого запуска тасок внутри вотчера
const dynamicRun = (moduleName, functionName) => {
  return async (done) => {
    try {
      const mod = await import(`./${moduleName}.js`);
      const task = mod[functionName] || mod.default;
      if (typeof task === 'function') {
        return task(done);
      }
      done();
    } catch (err) {
      console.error(
        `\x1b[31m[Watcher Error] Не удалось запустить ${functionName}: ${err.message}\x1b[0m`,
      );
      done(err);
    }
  };
};

// =========================================================================
// 👁️ 3. СЛЕДИТЕЛЬ ЗА ИЗМЕНЕНИЯМИ (WATCHER ENGINE ДЛЯ GULP 5)
// =========================================================================
export function startwatch() {
  const watchOptions = { delay: 300, queue: true };

  // 1. Наблюдатель за стилями (SCSS)
  const styleWatcher = watch(
    [`${config.srcFolder}/**/*.${config.preprocessor}`],
    watchOptions,
  );
  styleWatcher.on('change', (filePath) => {
    console.log(`✨ [Style Change] Изменен: ${path.basename(filePath)}`);
    series(dynamicRun('styles', 'styles'))();
  });

  // 2. Наблюдатель за скриптами (JS/TS) — ТЕПЕРЬ ПОЛНОСТЬЮ БЕЗОПАСНЫЙ И ЛИНЕЙНЫЙ
  const scriptWatcher = watch(
    [`${config.srcFolder}/**/*.{js,ts}`],
    watchOptions,
  );
  scriptWatcher.on('change', (filePath) => {
    console.log(`✨ [Script Change] Изменен: ${path.basename(filePath)}`);
    series(dynamicRun('scripts', 'scripts'))();
  });

  // 3. Наблюдатель за глобальной разметкой (HTML-компоненты и инклуды)
  const htmlWatcher = watch(
    [
      `${config.srcFolder}/*.html`,
      `${config.srcFolder}/components/**/*.html`,
      `${config.srcFolder}/parts/**/*.html`,
    ],
    watchOptions,
  );
  htmlWatcher.on('change', (filePath) => {
    console.log(`✨ [HTML Change] Изменен: ${path.basename(filePath)}`);
    series(dynamicRun('html', 'html'))();
  });

  // 4. Наблюдатель за текстовым контентом (Markdown / Word-статьи блога)
  const contentWatcher = watch(
    [`${config.srcFolder}/content/**/*`],
    watchOptions,
  );
  contentWatcher.on('change', (filePath) => {
    const relativePath = path.relative(
      path.join(config.srcFolder, 'content'),
      filePath,
    );
    const folder = relativePath.split(path.sep);

    if (folder) {
      console.log(`📝 [Content Update] Обновление секции блога: ${folder}`);
      series(async (done) => {
        const { wrapInMasterLayout } =
          await import('./utils/content-processor.js');
        const tempDestPath = path.join(
          config.buildFolder,
          folder.toLowerCase(),
        );

        try {
          await wrapInMasterLayout(tempDestPath, folder);
          bs.reload();
          done();
        } catch (err) {
          done(err);
        }
      })();
    }
  });

  // 5. Наблюдатель за картинками компонентов
  const componentImagesWatcher = watch(
    [`${config.srcFolder}/components/**/*.{jpg,jpeg,png,svg,webp,gif}`],
    watchOptions,
  );
  componentImagesWatcher.on('change', (filePath) => {
    console.log(
      `🖼️ [Image Change] Добавлена картинка в компонент: ${path.basename(filePath)}`,
    );
    series(dynamicRun('images', 'imagesDev'))();
  });

  // 6. Наблюдатель за векторными иконками (SVG Sprite)
  if (config.paths?.images?.svg) {
    const svgWatcher = watch([config.paths.images.svg], watchOptions);
    svgWatcher.on('change', (filePath) => {
      console.log(
        `🧬 [Sprite Change] Обновлена иконка: ${path.basename(filePath)}`,
      );
      series(dynamicRun('images', 'sprite'))();
    });
  }
}
