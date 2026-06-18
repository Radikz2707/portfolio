import { config } from '../gulp.config.js';
import gulp from 'gulp';
import browserSync from 'browser-sync';
import path from 'path';
import fs from 'fs';

const { watch, series } = gulp;
export const bs = browserSync.create();

export const isProd = process.env.NODE_ENV === 'production';

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
export function browsersync() {
  return new Promise((resolve) => {
    bs.init({
      server: {
        baseDir: config.buildFolder,
      },
      host: '127.0.0.1',
      port: 8080,
      ui: false,
      watch: false,
      ghostMode: false,
      notify: false,
      online: false,
      open: 'local',
      // 🔥 НОВОЕ: Ограничители сетевых коллизий
      reloadDelay: 500, // Ждем 500мс после изменений кода перед обновлением вкладки
      reloadDebounce: 500, // Группируем пачку быстрых изменений в один единственный релоад
      watchOptions: {
        awaitWriteFinish: {
          stabilityThreshold: 300, // Ждем, пока файл полностью допишется на диск (300мс тишины)
          poll: 100,
        },
      },
    });

    resolve();
  });
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
export function startwatch(done) {
  const watchOptions = { delay: 500, queue: true, ignoreInitial: true };

  // Слежение за SCSS/CSS (Исправлено через dynamicRun)
  watch([`${config.srcFolder}/**/*.${config.scssExtension}`], watchOptions).on(
    'change',
    (filePath) => {
      console.log(`✨ [Style Change] Изменен: ${path.basename(filePath)}`);
      dynamicRun('styles', 'styles')(() => {});
    },
  );

  // Слежение за Скриптами (Исправлено через dynamicRun)
  watch([`${config.srcFolder}/**/*.{js,ts}`], watchOptions).on(
    'change',
    (filePath) => {
      console.log(`✨ [Script Change] Изменен: ${path.basename(filePath)}`);
      dynamicRun('scripts', 'scripts')(() => {});
    },
  );

  // Слежение за HTML (Исправлено: вызывает blogIndex из html.js, релоадит вкладку и не падает!)
  watch(
    [
      `${config.srcFolder}/*.html`,
      `${config.srcFolder}/components/**/*.html`,
      `${config.srcFolder}/parts/**/*.html`,
    ],
    watchOptions,
  ).on('change', (filePath) => {
    console.log(`✨ [HTML Change] Изменен: ${path.basename(filePath)}`);
    dynamicRun(
      'html',
      'blogIndex',
    )(() => {
      bs.reload();
    });
  });

  // Слежение за контентом Markdown / Word (Оставляем ваш оригинальный рабочий блок)
  watch([`${config.srcFolder}/content/**/*`], watchOptions).on(
    'change',
    (filePath) => {
      const relativePath = path.relative(
        path.join(config.srcFolder, 'content'),
        filePath,
      );
      const folder = relativePath.split(path.sep);

      if (folder && folder[0]) {
        console.log(
          `📝 [Content Update] Обновление секции блога: ${folder[0]}`,
        );
        (async () => {
          const { wrapInMasterLayout } =
            await import('./utils/content-processor.js');
          const tempDestPath = path.join(
            config.buildFolder,
            folder[0].toLowerCase(),
          );
          try {
            await wrapInMasterLayout(tempDestPath, folder[0]);
            bs.reload();
          } catch (err) {
            onError(err);
          }
        })();
      }
    },
  );

  // Слежение за картинками (Исправлено)
  watch(
    [
      `${config.srcFolder}/components/**/*.{jpg,jpeg,png,svg,gif}`,
      `!${config.srcFolder}/components/**/*.webp`,
    ],
    watchOptions,
  ).on('change', (filePath) => {
    console.log(
      `🖼️ [Image Change] Добавлена картинка в компонент: ${path.basename(filePath)}`,
    );
    dynamicRun('images', 'imagesDev')(() => {});
  });

  // Слежение за SVG-спрайтами (Исправлено)
  if (config.paths?.images?.svg) {
    watch([config.paths.images.svg], watchOptions).on('change', (filePath) => {
      console.log(
        `🧬 [Sprite Change] Обновлена иконка: ${path.basename(filePath)}`,
      );
      dynamicRun('images', 'sprite')(() => {});
    });
  }

  done();
}
