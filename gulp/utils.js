import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import plumber from 'gulp-plumber';
import zip from 'gulp-zip';

import { onError } from './server.js';

const { src, dest } = gulp;

// 1. ПОЛНАЯ ОЧИСТКА ПЕРЕД СБОРКОЙ (Выполняется строго ОДИН раз в самом начале)
export function cleandist(done) {
  // Физическое удаление папки готовой сборки (dist/)
  if (fs.existsSync(config.buildFolder)) {
    fs.rmSync(config.buildFolder, { recursive: true, force: true });
  }

  // Очистка скрытого кэша Webpack, Babel и линтеров в node_modules
  const cacheFolder = path.join('node_modules', '.cache');
  if (fs.existsSync(cacheFolder)) {
    fs.rmSync(cacheFolder, { recursive: true, force: true });
  }

  // Авто-удаление скрытых временных файлов Microsoft Word (~$...)
  const blogDir = path.join(config.srcFolder, 'content', 'blog');
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir);
    for (const file of files) {
      if (file.startsWith('~$')) {
        const trashFilePath = path.join(blogDir, file);
        fs.unlinkSync(trashFilePath);
      }
    }
  }

  done();
}

// 2. БЕЗОПАСНОЕ КОПИРОВАНИЕ ШРИФТОВ (Ничего не удаляет, только дописывает ресурсы!)
export function buildcopy(done) {
  // Гарантируем наличие папки dist и создаем пустой .nojekyll для GitHub Pages
  if (!fs.existsSync(config.buildFolder)) {
    fs.mkdirSync(config.buildFolder, { recursive: true });
  }
  fs.writeFileSync(path.join(config.buildFolder, '.nojekyll'), '');

  // Проверяем исходную папку шрифтов в src/fonts
  const srcFontsFolder = path.join(config.srcFolder, 'fonts');
  if (!fs.existsSync(srcFontsFolder)) return done();

  // Линейно копируем шрифты в dist/fonts, не затрагивая сгенерированную папку /blog/
  return src(path.join(srcFontsFolder, '**', '*'), {
    allowEmpty: true,
    encoding: false,
  })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(dest(path.join(config.buildFolder, 'fonts')));
}

// 3. АРХИВИРОВАНИЕ СБОРКИ
export function zipFiles() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const fileName = `dist_${year}-${month}-${day}_${hours}-${minutes}.zip`;

  return src(path.join(config.buildFolder, '**', '*'), { allowEmpty: true })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(zip(fileName))
    .pipe(dest('archives/'))
    .on('end', () => {
      console.log(`\n📦 Архив успешно создан: archives/${fileName}\n`);
    });
}
