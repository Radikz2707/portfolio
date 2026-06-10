import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import plumber from 'gulp-plumber';
import flatten from 'gulp-flatten';
import imagemin from 'gulp-imagemin';
import mozjpeg from 'imagemin-mozjpeg';
import optipng from 'imagemin-optipng';
import svgo from 'imagemin-svgo';
import webp from 'gulp-webp';
import svgSprite from 'gulp-svg-sprite';
import favicons from 'gulp-favicons';
import newer from 'gulp-newer';
import gulpIf from 'gulp-if';
import { Transform } from 'stream'; // Нативная замена through2 для Gulp 5

import { onError, bs } from './server.js';
const { src, dest } = gulp;

// Общий массив путей к исходным картинкам (исключаем исходник фавиконки)
const imageSources = [
  `${config.srcFolder}/images/**/*`,
  `!${config.srcFolder}/images/src/favicon.png`,
  `!${config.srcFolder}/images/favicon.png`,
  `!${config.srcFolder}/images/favicons/**/*`,
  `${config.srcFolder}/components/**/img/**/*.{jpg,jpeg,png,svg,webp,gif}`,
];

// КРИТИЧЕСКИЙ ФЛАГ ДЛЯ GULP 5: Отключает текстовое кодирование для бинарников
const gulp5Options = { encoding: false };

// =========================================================================
// 🖼 1. ПРОДАКШЕН СБОРКА КАРТИНОК (PIPELINE + REDUCE PATTERN)
// =========================================================================
export function images() {
  const pipeline = [
    src(imageSources, gulp5Options),
    plumber({ errorHandler: onError }),
    newer({
      dest: config.paths.images.dest,
      map: (relative) => path.basename(relative),
    }),
    imagemin([
      mozjpeg({ quality: config.settings.imagemin.jpeg, progressive: true }),
      optipng({ optimizationLevel: config.settings.imagemin.png }),
      svgo({ plugins: [{ name: 'preset-default' }] }),
    ]),
    flatten(),
    dest(config.paths.images.dest),
  ];

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}

// =========================================================================
// ⚡ 2. РЕЖИМ РАЗРАБОТКИ (БЫСТРОЕ КОПИРОВАНИЕ БЕЗ СЖАТИЯ)
// =========================================================================
export function imagesDev() {
  const pipeline = [
    // Передаем тот же массив источников, что и в продакшене (включая компоненты)
    src(imageSources, gulp5Options),
    plumber({ errorHandler: onError }),
    // Обязательно добавляем flatten(), чтобы фото из компонентов сбросило
    // свою вложенность папок и легло ровно в dist/images/photo.jpg
    flatten(),
    dest(config.paths.images.dest),
  ];

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}

// =========================================================================
// 🚀 3. КОНВЕРТАЦИЯ В WEBP
// =========================================================================
export function createWebp() {
  const pipeline = [
    src(
      [
        `${config.srcFolder}/images/**/*.{png,jpg,jpeg}`,
        `!${config.srcFolder}/images/favicon.png`,
        `!${config.srcFolder}/images/favicons/**/*`,
        `${config.srcFolder}/components/**/img/**/*.{png,jpg,jpeg}`,
      ],
      gulp5Options,
    ),
    plumber({ errorHandler: onError }),
    newer({
      dest: config.paths.images.dest,
      map: (relative) =>
        path.basename(relative, path.extname(relative)) + '.webp',
    }),
    imagemin([mozjpeg({ progressive: true })]),
    webp({ quality: config.settings.webpQuality }),
    flatten(),
    dest(config.paths.images.dest),
  ];

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}

// =========================================================================
// 🧬 4. СБОРКА SVG-СПРАЙТОВ
// =========================================================================
export function sprite() {
  const pipeline = [
    src(config.paths.images.svg, gulp5Options),
    plumber({ errorHandler: onError }),
    newer(path.join(config.paths.images.dest, 'sprite.svg')),
    svgSprite({
      mode: { symbol: { dest: '.', sprite: 'sprite.svg' } },
      shape: {
        id: { generator: (name) => name.split('.').shift() },
        transform: [
          {
            svgo: {
              plugins: [
                { name: 'preset-default' },
                { name: 'cleanupIds', active: true },
                {
                  name: 'removeAttrs',
                  params: { attrs: '(fill|stroke|style|class|id|data-name)' },
                },
              ],
            },
          },
        ],
      },
    }),
    dest(config.paths.images.dest),
  ];

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}

// =========================================================================
// 🛡️ 5. ПОСЛЕДОВАТЕЛЬНАЯ ГЕНЕРАЦИЯ ФАВИКОНОК БЕЗ МУСОРА В ИСХОДНИКАХ
// =========================================================================

// Вспомогательный генератор базового потока от плагина
function getFaviconsStream() {
  const faviconPath = config.paths.favicons.src;
  const hasFavicon =
    fs.existsSync(faviconPath) && fs.statSync(faviconPath).size > 0;
  const targetPath = hasFavicon
    ? faviconPath
    : path.join(config.srcFolder, 'images', 'noop.png');

  return src(targetPath, { allowEmpty: true, encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      gulpIf(
        hasFavicon,
        favicons({
          path: 'images/favicons/',
          appName: 'Radik.Dev',
          html: 'favicon-links.html',
          pipeHTML: true,
          icons: {
            appleIcon: true,
            favicons: true,
            android: true,
            windows: false,
            yandex: false,
          },
        }),
      ),
    );
}

// СТРОГИЙ ИЗОЛИРОВАННЫЙ ТАСК ДЛЯ HTML (ПИШЕТ СТРОГО В SRC/PARTS/)
function favsHtml() {
  return getFaviconsStream()
    .pipe(
      new Transform({
        objectMode: true,
        transform(file, enc, cb) {
          // Пропускаем дальше по конвейеру ТОЛЬКО текстовый HTML файл ссылок
          if (file.path.endsWith('.html')) {
            this.push(file);
          }
          cb();
        },
      }),
    )
    .pipe(dest(path.join(config.srcFolder, 'parts')));
}

// СТРОГИЙ ИЗОЛИРОВАННЫЙ ТАСК ДЛЯ КАРТИНОК (ПИШЕТ СТРОГО В DIST/)
function favsImages() {
  return getFaviconsStream()
    .pipe(
      new Transform({
        objectMode: true,
        transform(file, enc, cb) {
          // Пропускаем дальше по конвейеру ВСЁ, КРОМЕ файла разметки
          if (!file.path.endsWith('.html')) {
            this.push(file);
          }
          cb();
        },
      }),
    )
    .pipe(dest(config.paths.favicons.dest));
}

// Главный последовательный экспорт, полностью исключающий гонки потоков
export const favs = gulp.series(favsHtml, favsImages);

// =========================================================================
// 🧹 6. ОЧИСТКА ГРАФИКИ & 7. СТРАХОВОЧНОЕ КОПИРОВАНИЕ ДЛЯ DEV
// =========================================================================
export function cleanimg(done) {
  if (fs.existsSync(config.paths.images.dest)) {
    const files = fs.readdirSync(config.paths.images.dest);
    files.forEach((file) => {
      if (file !== 'favicons') {
        fs.rmSync(path.join(config.paths.images.dest, file), {
          recursive: true,
          force: true,
        });
      }
    });
  }
  done();
}

export function faviconsDev() {
  return new Promise((resolve, reject) => {
    const faviconSourcePath = config.paths.favicons.src;
    const faviconsDestPath = config.paths.favicons.dest;

    if (
      !fs.existsSync(faviconSourcePath) ||
      !fs.existsSync(faviconsDestPath) ||
      fs.readdirSync(faviconsDestPath).length === 0
    ) {
      fs.mkdirSync(faviconsDestPath, { recursive: true });
      resolve();
      return;
    }

    src(path.join(faviconsDestPath, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(dest(faviconsDestPath))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}
