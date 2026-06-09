import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import plumber from "gulp-plumber";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sourcemaps = require("gulp-sourcemaps");
const cleancss = require("gulp-clean-css");
const rename = require("gulp-rename");
const gulpSass = require("gulp-sass");

import * as dartSass from "sass";
import postcss from "gulp-postcss";
import autoprefixer from "autoprefixer";
import webpInCssModule from "webp-in-css/plugin.js";
import sortMediaQueries from "postcss-sort-media-queries";
const webpInCss = webpInCssModule.default || webpInCssModule;

import { onError, bs } from "./server.js";

const { src, dest } = gulp;
const sass = gulpSass(dartSass);

/**
 * Флаг режима сборки.
 * Возвращает true, если в команду терминала передан аргумент "build" (npm run build).
 * Используется для включения сжатия CSS и отключения генерации карт кода (sourcemaps).
 */
export const isProd = process.argv.includes("build");

export function styles() {
  const pipeline = [
    src(config.paths.styles.src),
    plumber({ errorHandler: onError }),
  ];

  // Инициализируем карту кода строго в начале потока для режима разработки
  if (!isProd) {
    pipeline.push(sourcemaps.init());
  }

  // Базовые плагины трансформации (Dart Sass + PostCSS)
  pipeline.push(
    sass({
      silenceDeprecations: ["import"],
      loadPaths: ["node_modules"],
    }),
    postcss([
      sortMediaQueries({ sort: "mobile-first" }),
      webpInCss,
      autoprefixer({
        overrideBrowserslist: config.settings.autoprefixer,
        grid: false,
      }),
    ]),
  );

  // Сжатие стилей выполняется исключительно для продакшена
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
