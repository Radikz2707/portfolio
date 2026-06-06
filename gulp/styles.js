import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import plumber from "gulp-plumber";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sourcemaps = require("gulp-sourcemaps");
const cleancss = require("gulp-clean-css");
const rename = require("gulp-rename");
const purgecss = require("gulp-purgecss");
const gulpSass = require("gulp-sass");

import * as dartSass from "sass";
import postcss from "gulp-postcss";
import autoprefixer from "autoprefixer";

import webpInCssModule from "webp-in-css/plugin.js";
import sortMediaQueries from "postcss-sort-media-queries";
const webpInCss = webpInCssModule.default || webpInCssModule;

import { onError, isProd, bs } from "./server.js";

const { src, dest } = gulp;
const sass = gulpSass(dartSass);

export function styles() {
  const pipeline = [
    src(config.paths.styles.src),
    plumber({ errorHandler: onError }),
  ];

  // ИСПРАВЛЕНО: Карта инициализируется строго в самом начале потока
  if (!isProd) {
    pipeline.push(sourcemaps.init());
  }

  // Базовые плагины трансформации
  pipeline.push(
    // ИСПРАВЛЕНО: убран .on('error'), так как за ошибки отвечает plumber
    sass({ silenceDeprecations: ["import"] }),
    postcss([
      sortMediaQueries({ sort: "mobile-first" }), // Перенесли сортировку медиа-запросов сюда
      webpInCss,
      autoprefixer({
        overrideBrowserslist: config.settings.autoprefixer,
        grid: false,
      }),
    ]),
  );

  // ИСПРАВЛЕНО: Сжатие стилей выполняется исключительно для продакшена
  if (isProd) {
    pipeline.push(cleancss({ level: { 2: { mergeMedia: true } } }));
  }

  pipeline.push(
    rename({
      basename: path
        .basename(config.paths.styles.output, ".css")
        .replace(".min", ""),
      suffix: ".min",
    }),
  );

  // Фиксация карты кода для режима разработки
  if (!isProd) {
    pipeline.push(
      sourcemaps.write(".", {
        includeContent: false,
        // Динамически собираем путь для точного маппинга
        sourceRoot: path.relative(
          config.paths.styles.dest,
          path.join(config.srcFolder, config.preprocessor),
        ),
      }),
    );
  }

  pipeline.push(dest(config.paths.styles.dest), bs.stream());

  return pipeline.reduce((stream, plugin) => stream.pipe(plugin));
}

export function cssPurge(done) {
  if (!isProd) return done();

  return src(path.join(config.paths.styles.dest, "*.min.css"))
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      purgecss({
        content: [
          path.join(config.buildFolder, "**", "*.html"),
          path.join(config.buildFolder, "js", "**", "*.js"),
        ],
        // Добавлен класс container и стандартные классы кастомизации на всякий случай
        safelist: ["webp", "no-webp", "container"],
      }),
    )
    .pipe(dest(config.paths.styles.dest))
    .pipe(bs.stream());
}
