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
import through2 from 'through2';

import { onError, bs } from './server.js';

const { src, dest } = gulp;

// Общий массив путей к исходным картинкам
const imageSources = [
  `${config.srcFolder}/images/**/*`,
  `!${config.srcFolder}/images/favicon.png`,
  `!${config.srcFolder}/images/favicons/**/*`,
  `${config.srcFolder}/components/**/img/**/*.{jpg,jpeg,png,svg,webp,gif}`,
];

// 1. ПРОДАКШЕН СБОРКА КАРТИНОК
export function images() {
  return src(imageSources, { encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      newer({
        dest: config.paths.images.dest,
        map: (relative) => path.basename(relative),
      }),
    )
    .pipe(
      imagemin([
        mozjpeg({ quality: config.settings.imagemin.jpeg, progressive: true }),
        optipng({ optimizationLevel: config.settings.imagemin.png }),
        svgo({ plugins: [{ name: 'preset-default' }] }),
      ]),
    )
    .pipe(flatten())
    .pipe(dest(config.paths.images.dest))
    .on('end', bs.reload);
}

// === КРИСТАЛЬНО ЧИСТАЯ И ИСПРАВЛЕННАЯ ФУНКЦИЯ В gulp/images.js ===
export function imagesDev() {
  return (
    src([
      `${config.srcFolder}/images/**/*`,
      `!${config.srcFolder}/images/favicons/**/*`,
    ])
      .pipe(plumber({ errorHandler: onError }))
      /* 🔥 ИСПРАВЛЕНО: Читаем свойство .dest (маленькими буквами), 
       в точности как оно объявлено в вашем gulp.config.js! */
      .pipe(dest(config.paths.images.dest))
      .on('end', bs.reload)
  );
}

// 3. СТАБИЛЬНАЯ КОНВЕРТАЦИЯ В WEBP С АВТОПОВОРОТОМ
export function createWebp() {
  return src(
    [
      `${config.srcFolder}/images/**/*.{png,jpg,jpeg}`,
      `!${config.srcFolder}/images/favicon.png`,
      `!${config.srcFolder}/images/favicons/**/*`,
      `${config.srcFolder}/components/**/img/**/*.{png,jpg,jpeg}`,
    ],
    { encoding: false },
  )
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      newer({
        dest: config.paths.images.dest,
        map: (relative) =>
          path.basename(relative, path.extname(relative)) + '.webp',
      }),
    )
    .pipe(imagemin([mozjpeg({ progressive: true })]))
    .pipe(webp({ quality: config.settings.webpQuality }))
    .pipe(flatten())
    .pipe(dest(config.paths.images.dest))
    .on('end', bs.reload);
}

// 4. СБОРКА SVG-СПРАЙТОВ (Чистая векторная оптимизация ВСТРОЕННЫМИ средствами)
export function sprite() {
  return src(config.paths.images.svg, { encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(newer(path.join(config.paths.images.dest, 'sprite.svg')))
    .pipe(
      svgSprite({
        mode: { symbol: { dest: '.', sprite: 'sprite.svg' } },
        shape: {
          id: { generator: (name) => name.split('.').shift() },
          transform: [
            {
              /* 🔥 ИСПОЛЬЗУЕМ ВСТРОЕННЫЙ SVGO: Никаких внешних плагинов не нужно! */
              svgo: {
                plugins: [
                  { name: 'preset-default' },
                  { name: 'cleanupIds', active: true },
                  /* 🔥 ТОТАЛЬНАЯ ОЧИСТКА: Жестко вырезаем цвета и инлайновые стили из всех вложенных тегов */
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
    )
    .pipe(dest(config.paths.images.dest))
    .on('end', bs.reload);
}

// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ГЕНЕРИРУЕТ ФАВИКОНКИ И ВОЗВРАЩАЕТ ОДИН ПОТОК ===
function generateFavicons() {
  const faviconPath = path.join(config.srcFolder, 'images', 'favicon.png');
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
          path: '',
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

// 5. ГЕНЕРАЦИЯ ФАВИКОНОК — ИСПРАВЛЕННАЯ ВЕРСИЯ
// 🔥 ИСПРАВЛЕНО: Теперь функция правильно записывает HTML в src/parts/ и картинки в dist/images/favicons/
export function favs() {
  return new Promise((resolve, reject) => {
    // 🔥 Генерируем фавиконки
    const faviconsStream = generateFavicons();

    // 🔥 Массивы для накопления файлов
    const htmlFiles = [];
    const imageFiles = [];

    // 🔥 Обрабатываем поток с помощью through2.obj()
    faviconsStream
      .pipe(
        through2.obj(function (file, encoding, callback) {
          if (file.isBuffer()) {
            // Если это HTML-файл, сохраняем для записи в src/parts/
            if (file.path.endsWith('.html')) {
              let content = file.contents.toString('utf-8');
              content = content.replace(/href="\/portfolio\//g, 'href="');
              content = content.replace(/href="\/\//g, 'href="');
              file.contents = Buffer.from(content, 'utf-8');
              htmlFiles.push(file);
            }
            // Если это картинка, сохраняем для записи в dist/images/favicons/
            else {
              imageFiles.push(file);
            }
          }
          callback(null, file);
        }),
      )
      // 🔥 Записываем HTML-файлы в src/parts/
      .pipe(
        through2.obj(function (file, encoding, callback) {
          if (file.isBuffer() && file.path.endsWith('.html')) {
            this.push(file);
          }
          callback(null, file);
        }),
      )
      .pipe(dest(path.join(config.srcFolder, 'parts')))
      .on('end', () => {
        // 🔥 После завершения HTML-потока записываем картинки в dist/images/favicons/
        if (imageFiles.length > 0) {
          // Создаём отдельный поток для картинок
          const imageStream = through2.obj();
          
          // Добавляем все накопленные картинки в поток
          imageFiles.forEach((file) => {
            imageStream.write(file);
          });
          imageStream.end();
          
          // Записываем картинки
          imageStream
            .pipe(dest(path.join(config.buildFolder, 'images', 'favicons')))
            .on('end', () => {
              bs.reload();
              resolve();
            })
            .on('error', reject);
        } else {
          bs.reload();
          resolve();
        }
      })
      .on('error', reject);
  });
}

// 6. ОЧИСТКА ГРАФИКИ
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

// 7. КОПИРОВАНИЕ ФАВИКОНОК ДЛЯ РЕЖИМА РАЗРАБОТКИ
// 🔥 ИСПРАВЛЕНО: Теперь функция проверяет существование исходников и создаёт пустую папку при их отсутствии
export function faviconsDev() {
  return new Promise((resolve, reject) => {
    const faviconsDestPath = path.join(config.buildFolder, 'images', 'favicons');
    const faviconSourcePath = path.join(config.srcFolder, 'images', 'favicon.png');
    const faviconLinksPath = path.join(config.srcFolder, 'parts', 'favicon-links.html');

    // 🔥 Проверяем, существует ли исходная иконка
    if (!fs.existsSync(faviconSourcePath)) {
      // 🔥 Если исходника нет, создаём пустую папку и завершаемся
      fs.mkdirSync(faviconsDestPath, { recursive: true });
      console.log('>>> ⚠️ Источник favicon.png не найден. Создана пустая папка dist/images/favicons/');
      resolve();
      return;
    }

    // 🔥 Если исходник есть, проверяем, существуют ли сгенерированные фавиконки
    if (!fs.existsSync(faviconsDestPath) || fs.readdirSync(faviconsDestPath).length === 0) {
      // 🔥 Если фавиконок нет, создаём пустую папку и завершаемся
      fs.mkdirSync(faviconsDestPath, { recursive: true });
      console.log('>>> ⚠️ Фавиконки не сгенерированы. Создана пустая папка dist/images/favicons/');
      resolve();
      return;
    }

    // 🔥 Если фавиконки есть, копируем их для dev-режима
    src(path.join(faviconsDestPath, '**', '*'), { allowEmpty: true, encoding: false })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(dest(faviconsDestPath))
      .on('end', () => {
        bs.reload();
        resolve();
      })
      .on('error', reject);
  });
}
