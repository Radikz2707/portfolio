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
import replace from 'gulp-replace';
import { Transform } from 'stream';
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
  return new Promise((resolve, reject) => {
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

    pipeline
      .reduce((stream, plugin) => stream.pipe(plugin))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}

// =========================================================================
// ⚡ 2. РЕЖИМ РАЗРАБОТКИ (БЫСТРОЕ КОПИРОВАНИЕ БЕЗ СЖАТИЯ)
// =========================================================================
export function imagesDev() {
  return new Promise((resolve, reject) => {
    const pipeline = [
      src(imageSources, gulp5Options),
      plumber({ errorHandler: onError }),
      flatten(),
      dest(config.paths.images.dest),
    ];

    pipeline
      .reduce((stream, plugin) => stream.pipe(plugin))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}

// =========================================================================
// 🚀 3. КОНВЕРТАЦИЯ В WEBP
// =========================================================================
export function createWebp() {
  return new Promise((resolve, reject) => {
    const pipeline = [
      src(
        [
          `${config.srcFolder}/images/**/*.{png,jpg,jpeg}`,
          `!${config.srcFolder}/images/**/favicon.png`,
          `!${config.srcFolder}/images/favicons/**/*`,
          `${config.srcFolder}/components/**/img/**/*.{png,jpg,jpeg}`,
        ],
        gulp5Options,
      ),
      plumber({ errorHandler: onError }),
      // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Исправлен маппинг newer.
      // Теперь картинки с одинаковыми именами из разных компонентов не блокируют друг друга.
      newer({
        dest: config.paths.images.dest,
        map: (relative) => relative.replace(/\.(png|jpg|jpeg)$/i, '.webp'),
      }),
      imagemin([mozjpeg({ progressive: true })]),
      webp({ quality: config.settings.webpQuality }),
      flatten(),
      dest(config.paths.images.dest),
    ];

    pipeline
      .reduce((stream, plugin) => stream.pipe(plugin))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}

// =========================================================================
// 🧬 4. СБОРКА SVG-СПРАЙТОВ
// =========================================================================
export function sprite() {
  return new Promise((resolve, reject) => {
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

    pipeline
      .reduce((stream, plugin) => stream.pipe(plugin))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}

// =========================================================================
// 🛠 5. GULP-ТАСК ДЛЯ ПОСТПРОЦЕССИНГА МАНИФЕСТА
// =========================================================================
function processManifest() {
  const manifestPath = path.join(
    config.paths.favicons.dest,
    'manifest.webmanifest',
  );

  return src(manifestPath, { allowEmpty: true, encoding: false })
    .pipe(
      new Transform({
        objectMode: true,
        transform(file, enc, cb) {
          if (file.isBuffer()) {
            let content = file.contents.toString();
            // Полностью удаляем путь "/images/favicons/", оставляя только имя файла
            let finalContent = content.replace(
              /"src":\s*"?\s*\/images\/favicons\//gi,
              '"src": "',
            );
            // Аналогично очищаем свойство "path", если оно используется
            finalContent = finalContent.replace(
              /"path":\s*"?\s*\/images\/favicons\//gi,
              '"path": "',
            );
            file.contents = Buffer.from(finalContent);
          }
          this.push(file);
          cb();
        },
      }),
    )
    .pipe(dest(config.paths.favicons.dest));
}

// =========================================================================
// ⚡ 6. ПОСЛЕДОВАТЕЛЬНАЯ ГЕНЕРАЦИЯ ФАВИКОНОК БЕЗ МУСОРА В ИСХОДНИКАХ
// =========================================================================
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
          appName: config.siteName,
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

export function favsHtml() {
  return getFaviconsStream()
    .pipe(
      new Transform({
        objectMode: true,
        transform(file, enc, cb) {
          // Пропускаем в src/parts/ ТОЛЬКО ТЕКСТОВЫЙ файл ссылок
          if (file.path.endsWith('.html') && file.isBuffer()) {
            let content = file.contents.toString();
            content = content.replace(
              /(href=["']\s*)\/?images\/favicons\//gi,
              '$1images/favicons/',
            );
            file.contents = Buffer.from(content);
            this.push(file);
          }
          cb();
        },
      }),
    )
    .pipe(gulp.dest(path.dirname(config.paths.favicons.htmlOutput)));
}

function favsImages() {
  const faviconsDestPath = config.paths.favicons.dest;
  if (!fs.existsSync(faviconsDestPath)) {
    fs.mkdirSync(faviconsDestPath, { recursive: true });
  }

  return getFaviconsStream()
    .pipe(
      new Transform({
        objectMode: true,
        transform(file, enc, cb) {
          // Пропускаем в dist ТОЛЬКО картинки и манифест
          if (!file.path.endsWith('.html')) {
            this.push(file);
          }
          cb();
        },
      }),
    )
    .pipe(dest(faviconsDestPath));
}

// Главный последовательный экспорт, полностью исключающий гонки потоков
export const favs = gulp.series(favsImages, favsHtml, processManifest);

// =========================================================================
// 🧹 7. ОЧИСТКА ГРАФИКИ & СТРАХОВОЧНОЕ КОПИРОВАНИЕ ДЛЯ DEV
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
  return new Promise((resolve) => {
    // 🔥 ИСПРАВЛЕНО ДЛЯ ДЕБАГА: Убрана самоперезапись потока, вызывавшая бесконечный цикл.
    // Просто триггерим обновление BrowserSync без нагрузки на файловую систему.
    bs.reload();
    resolve();
  });
}
