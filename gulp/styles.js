import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import plumber from 'gulp-plumber';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cleancss = require('gulp-clean-css');
const rename = require('gulp-rename');
const gulpSass = require('gulp-sass');

import * as dartSass from 'sass';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import webpInCssModule from 'webp-in-css/plugin.js';
import sortMediaQueries from 'postcss-sort-media-queries';

const webpInCss = webpInCssModule.default || webpInCssModule;
import { onError, bs } from './server.js';

const { src, dest } = gulp;
const sass = gulpSass(dartSass);

export const isProd = process.argv.includes('build');

export function styles() {
  // Настройка опций для src() в Gulp 5
  // Если это разработка, включаем генерацию нативных карт кода
  const srcOptions = !isProd ? { sourcemaps: true } : {};

  // Инициализируем пайплайн оригинальным методом, передавая опции в src
  const pipeline = [
    src(config.paths.styles.src, srcOptions),
    plumber({ errorHandler: onError }),
  ];

  // Основные плагины трансформации (Sass + PostCSS)
  pipeline.push(
    sass({
      silenceDeprecations: ['import'],
      loadPaths: ['node_modules'],
    }),
    postcss([
      sortMediaQueries({ sort: 'mobile-first' }),
      webpInCss,
      autoprefixer({
        overrideBrowserslist: config.settings.autoprefixer,
        grid: false,
      }),
    ]),
  );

  // Сжатие стилей выполняется исключительно для продакшена
  if (isProd) {
    pipeline.push(
      cleancss({
        level: {
          2: { mergeMedia: true },
        },
      }),
    );
  }

  // Переименование результирующего файла
  pipeline.push(
    rename({
      basename: path
        .basename(config.paths.styles.output, '.css')
        .replace('.min', ''),
      suffix: '.min',
    }),
  );

  const destOptions = !isProd ? { sourcemaps: '.' } : {};

  // Завершаем пайплайн записью на диск и обновлением браузера
  pipeline.push(dest(config.paths.styles.dest, destOptions), bs.stream());

  // Ваш оригинальный нативный метод связки стримов через reduce
  return pipeline.reduce((stream, plugin) => stream.pipe(plugin));
}
