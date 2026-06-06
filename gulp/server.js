import { config } from "../gulp.config.js";
import gulp from "gulp";
import browserSync from "browser-sync";
import notify from "gulp-notify";

// Импортируем таск стилей для прямого и быстрого запуска в вотчере
import { styles } from "./styles.js";
// Импортируем инфраструктуру линтинга (она завязана на хитрую логику автофикса)
import { lintCss, lintJs } from "./lint.js";

const { watch, series } = gulp;
export const bs = browserSync.create();

export const isProd = process.argv.includes("build");

export const onError = function (err) {
  notify.onError({
    title: `Gulp Error in ${err.plugin || "Plugin"}`,
    message: "Error: <%= error.message %>",
    sound: isProd,
  })(err);

  if (err.plugin !== "webpack-stream") {
    this.emit("end");
  }
};

export function browsersync() {
  bs.init({
    server: { baseDir: config.buildFolder },
    notify: false,
    online: true,
  });
}

export function startwatch() {
  // 1. СЛЕЖЕНИЕ ЗА СТИЛЯМИ (Прямой запуск функции без реестра строк)
  const styleWatcher = watch(
    [`${config.srcFolder}/**/*.${config.preprocessor}`],
    { delay: 300 },
  );

  styleWatcher.on("change", (filePath) => {
    lintCss(() => {
      // Запускаем импортированный таск стилей напрямую для мгновенного обновления CSS
      series(styles)();
    }, filePath);
  });

  // 2. СЛЕЖЕНИЕ ЗА СКРИПТАМИ
  const scriptWatcher = watch([`${config.srcFolder}/**/*.{js,ts}`], {
    delay: 300,
  });

  scriptWatcher.on("change", (filePath) => {
    lintJs(() => {
      // В dev-режиме webpack сам следит за изменениями JS/TS, пересборка нужна только на продакшене
      if (isProd) {
        const scriptsTask = gulp.registry().get("scripts");
        if (scriptsTask) series(scriptsTask)();
      }
    }, filePath);
  });

  // 3. УМНЫЕ АВТОМАТИЧЕСКИЕ НАБЛЮДАТЕЛИ (Генерация путей по имени файла таска)
  // Динамически импортируем список найденных файлов из главного gulpfile.js
  import("../gulpfile.js").then(({ dynamicTaskNames }) => {
    dynamicTaskNames.forEach((taskName) => {
      let watchPath;

      // Задаем правила генерации путей на основе имени файла таска:
      if (taskName === "html") {
        watchPath = [
          `${config.srcFolder}/**/*.html`,
          `${config.srcFolder}/components/**/*.html`,
        ];
      } else if (taskName === "images") {
        watchPath = `${config.srcFolder}/components/**/*.{jpg,jpeg,png,svg,webp,gif}`;
      } else {
        // Для всех остальных разделов контента (blog, portfolio и т.д.) путь строится автоматически:
        watchPath = `${config.srcFolder}/content/${taskName}/**/*`;
      }

      // Запускаем автоматическое слежение
      watch(watchPath, (done) => {
        const registeredTask = gulp.registry().get(taskName);
        if (registeredTask) {
          return gulp.series(taskName)();
        }
        done();
      });
    });
  });

  // Изолированный вотчер для сборки SVG-спрайтов
  watch(config.paths.images.svg, (done) => {
    const spriteTask = gulp.registry().get("sprite");
    if (spriteTask) return gulp.series(spriteTask)();
    done();
  });
}
