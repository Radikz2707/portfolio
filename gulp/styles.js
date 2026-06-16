import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import plumber from 'gulp-plumber';
import newer from 'gulp-newer';

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
  const srcOptions = !isProd ? { sourcemaps: true } : {};

  const pipeline = [
    src(config.paths.styles.src, srcOptions),
    plumber({ errorHandler: onError }),
    // Кешируем только изменённые файлы SCSS
    newer({ dest: config.paths.styles.dest, ext: '.css' }),
  ];

  pipeline.push(
    sass({
      silenceDeprecations: ['import'],
      loadPaths: ['node_modules'],
    }),
    postcss([
      sortMediaQueries({ sort: 'mobile-first' }),
      autoprefixer({
        overrideBrowserslist: config.settings.autoprefixer,
        grid: 'autoplace',
      }),
      webpInCss,
    ]),
  );

  if (isProd) {
    pipeline.push(
      cleancss({
        level: {
          1: {
            all: true,
            transform: (name, value) => value,
          },
          2: {
            all: true,
            mergeMedia: true,
            mergeAdjacentRules: true,
            removeDistinctSemicolons: true,
            removeDuplicateRules: true,
            restructureRules: false,
          },
        },
      }),
    );
  }

  pipeline.push(
    rename({
      basename: path
        .basename(config.paths.styles.output, '.css')
        .replace('.min', ''),
      suffix: '.min',
    }),
  );

  const destOptions = !isProd ? { sourcemaps: '.' } : {};

  pipeline.push(dest(config.paths.styles.dest, destOptions), bs.stream());

  return pipeline.reduce((stream, plugin) => stream.pipe(plugin));
}
