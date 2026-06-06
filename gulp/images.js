import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import fs from "fs";
import plumber from "gulp-plumber";
import flatten from "gulp-flatten";
import filter from "gulp-filter";
import imagemin from "gulp-imagemin";
import mozjpeg from "imagemin-mozjpeg";
import optipng from "imagemin-optipng";
import svgo from "imagemin-svgo";
import webp from "gulp-webp";
import svgSprite from "gulp-svg-sprite";
import favicons from "gulp-favicons";
import newer from "gulp-newer";
import replace from "gulp-replace";
import gulpIf from "gulp-if";
import { execSync } from "child_process";
import glob from "glob";

import { onError, bs } from "./server.js";

const { src, dest } = gulp;

// Общий массив путей к исходным картинкам
const imageSources = [
  `${config.srcFolder}/images/src/**/*`,
  `!${config.srcFolder}/images/src/favicon.png`,
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
        svgo({ plugins: [{ name: "preset-default" }] }),
      ]),
    )
    .pipe(flatten())
    .pipe(dest(config.paths.images.dest))
    .on("end", bs.reload);
}

// 2. ДЕВ СБОРКА КАРТИНОК
export function imagesDev() {
  return src(imageSources, { encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      newer({
        dest: config.paths.images.dest,
        map: (relative) => path.basename(relative),
      }),
    )
    .pipe(flatten())
    .pipe(dest(config.paths.images.dest))
    .on("end", bs.reload);
}

// 3. СТАБИЛЬНАЯ КОНВЕРТАЦИЯ В WEBP С АВТОПОВОРОТОМ
export function createWebp() {
  return src(
    [
      `${config.srcFolder}/images/src/**/*.{png,jpg,jpeg}`,
      `!${config.srcFolder}/images/src/favicon.png`,
      `${config.srcFolder}/components/**/img/**/*.{png,jpg,jpeg}`,
    ],
    { encoding: false },
  )
    .pipe(plumber({ errorHandler: onError }))
    // Шаг 1: Сбрасываем кэш конкретно для этого шага
    .pipe(
      newer({
        dest: config.paths.images.dest,
        map: (relative) =>
          path.basename(relative, path.extname(relative)) + ".webp",
      }),
    )
    // Шаг 2: Вызываем ваш рабочий imagemin для физического разворота пикселей
    .pipe(
      imagemin([
        mozjpeg({ progressive: true }), 
      ]),
    )
    // Шаг 3: Теперь конвертируем уже ровную картинку в WebP
    .pipe(webp({ quality: config.settings.webpQuality }))
    .pipe(flatten())
    .pipe(dest(config.paths.images.dest))
    .on("end", bs.reload);
}

// 4. СБОРКА SVG-СПРАЙТОВ
export function sprite() {
  return src(config.paths.images.svg, { encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(newer(path.join(config.paths.images.dest, "sprite.svg")))
    .pipe(
      svgSprite({
        mode: { symbol: { dest: ".", sprite: "sprite.svg" } },
        shape: {
          id: { generator: (name) => name.split(".").shift() },
          transform: [
            {
              svgo: {
                plugins: [
                  {
                    name: "removeAttrs",
                    params: { attrs: "(fill|stroke|style|class|id)" },
                  },
                ],
              },
            },
          ],
        },
      }),
    )
    .pipe(dest(config.paths.images.dest))
    .on("end", bs.reload);
}

// 5. ГЕНЕРАЦИЯ ФАВИКОНОК
export function favs() {
  const faviconPath = path.join(
    config.srcFolder,
    "images",
    "src",
    "favicon.png",
  );
  const hasFavicon =
    fs.existsSync(faviconPath) && fs.statSync(faviconPath).size > 0;
  const targetPath = hasFavicon
    ? faviconPath
    : path.join(config.srcFolder, "images", "src", "noop.png");

  return src(targetPath, { allowEmpty: true, encoding: false })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      gulpIf(
        hasFavicon,
        favicons({
          appName: "My Project",
          path: "images/favicons/",
          html: "favicon-links.html",
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
    )
    // Заменяем абсолютные пути на относительные для GitHub Pages
    .pipe(replace(/href="\/images/g, 'href="./images'))
    .pipe(dest(path.join(config.buildFolder, "images", "favicons")))
    .pipe(filter("favicon-links.html"))
    .pipe(dest(path.join(config.srcFolder, "parts")));
}

// 6. ОЧИСТКА ГРАФИКИ
export function cleanimg(done) {
  if (fs.existsSync(config.paths.images.dest)) {
    const files = fs.readdirSync(config.paths.images.dest);
    files.forEach((file) => {
      if (file !== "favicons") {
        fs.rmSync(path.join(config.paths.images.dest, file), {
          recursive: true,
          force: true,
        });
      }
    });
  }
  done();
}
