import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import fs from "fs";
import plumber from "gulp-plumber";
import zip from "gulp-zip";

import { onError } from "./server.js";

const { src, dest } = gulp;

// Полная очистка папки сборки перед новым билдом
export function cleandist(done) {
  if (fs.existsSync(config.buildFolder)) {
    fs.rmSync(config.buildFolder, { recursive: true, force: true });
  }
  done();
}

// Копирование статических ресурсов (например, уже готовых шрифтов)
export function buildcopy(done) {
  // 1. Проверяем исходную папку шрифтов в src
  const srcFontsFolder = path.join(config.srcFolder, "fonts");
  if (!fs.existsSync(srcFontsFolder)) return done();

  // 2. ИСПРАВЛЕНО: Добавлена проверка папки назначения dist/fonts
  // Если папка в dist еще не создана компилятором, просто выходим без ошибки
  if (!fs.existsSync(config.paths.fonts.dest)) return done();

  // 3. Если папка есть и в ней есть файлы — копируем их
  return src(path.join(config.paths.fonts.dest, "**", "*"), {
    base: config.buildFolder,
    allowEmpty: true,
    encoding: false,
  })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(dest(config.buildFolder));
}

// Архивирование готовой сборки проекта
export function zipFiles() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const fileName = `dist_${year}-${month}-${day}_${hours}-${minutes}.zip`;

  return src(path.join(config.buildFolder, "**", "*"), { allowEmpty: true })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(zip(fileName))
    .pipe(dest("archives/"))
    .on("end", () => {
      console.log(`\n📦 Архив успешно создан: archives/${fileName}\n`);
    });
}
