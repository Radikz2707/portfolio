import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import plumber from 'gulp-plumber';
import zip from 'gulp-zip';
import { onError } from './server.js';

const { src, dest } = gulp;

// =========================================================================
// 🧹 1. ПОЛНАЯ АСИНХРОННАЯ ОЧИСТКА ПЕРЕД СБОРКОЙ (БЕЗ БЛОКИРОВКИ EVENT LOOP)
// =========================================================================
export async function cleandist(done) {
  try {
    // Асинхронное физическое удаление папки готовой сборки (dist/)
    if (fs.existsSync(config.buildFolder)) {
      await fsPromises.rm(config.buildFolder, { recursive: true, force: true });
    }

    // Асинхронная очистка скрытого кэша Webpack, Babel и линтеров в node_modules
    const cacheFolder = path.join('node_modules', '.cache');
    if (fs.existsSync(cacheFolder)) {
      await fsPromises.rm(cacheFolder, { recursive: true, force: true });
    }

    // Авто-удаление скрытых временных файлов Microsoft Word (~...) в блоге
    const blogDir = path.join(config.srcFolder, 'content', 'blog');
    if (fs.existsSync(blogDir)) {
      const files = await fsPromises.readdir(blogDir);
      for (const file of files) {
        if (file.startsWith('~')) {
          const trashFilePath = path.join(blogDir, file);
          await fsPromises.unlink(trashFilePath);
        }
      }
    }

    done();
  } catch (err) {
    onError(err);
    done(err);
  }
}

// =========================================================================
// 🔤 2. БЕЗОПАСНОЕ КОПИРОВАНИЕ ШРИФТОВ (ЗАЩИТА БИНАРНЫХ ДАННЫХ В GULP 5)
// =========================================================================
export function buildcopy(done) {
  // 1. Гарантируем наличие папки dist и создаем пустой .nojekyll для GitHub Pages
  if (!fs.existsSync(config.buildFolder)) {
    fs.mkdirSync(config.buildFolder, { recursive: true });
  }
  fs.writeFileSync(path.join(config.buildFolder, '.nojekyll'), '');

  // 2. Проверяем исходную папку шрифтов в src/fonts
  const srcFontsFolder = path.join(config.srcFolder, 'fonts');
  if (!fs.existsSync(srcFontsFolder)) return done();

  // 3. Формируем массив безопасных источников для копирования
  const srcList = [path.join(srcFontsFolder, '**', '*')];

  // Проверяем, где лежат ваши исходные фавиконки, чтобы Gulp не падал с ошибкой ENOENT
  const rootFavs = path.join(config.srcFolder, 'favicons');
  const imagesFavs = path.join(config.srcFolder, 'images', 'favicons');

  if (fs.existsSync(rootFavs)) {
    srcList.push(path.join(rootFavs, '**', '*'));
  }
  if (fs.existsSync(imagesFavs)) {
    srcList.push(path.join(imagesFavs, '**', '*'));
  }

  // 🔥 ДОБАВЛЕНО: Копируем уже сгенерированные фавиконки из dist/images/favicons/
  // const distFavs = path.join(config.buildFolder, 'images', 'favicons');
  // if (fs.existsSync(distFavs)) {
  //   srcList.push(path.join(distFavs, '**', '*'));
  // }

  // 4. Запускаем безопасный потоковый конвейер
  const pipeline = [
    src(srcList, {
      allowEmpty: true,
      encoding: false,
      base: config.srcFolder,
    }),
    plumber({ errorHandler: onError }),
    dest(config.buildFolder),
  ];

  return pipeline.reduce((stream, plugin) => stream.pipe(plugin));
}

// =========================================================================
// 📦 3. АРХИВИРОВАНИЕ СБОРКИ (PIPELINE + REDUCE PATTERN + GULP 5 ENCODING)
// =========================================================================
export function zipFiles() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const fileName = `dist_${year}-${month}-${day}_${hours}-${minutes}.zip`;

  // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ ДЛЯ GULP 5: Для создания корректного ZIP-архива
  // все упаковываемые файлы и картинки должны быть прочитаны в бинарном режиме ({ encoding: false })
  const pipeline = [
    src(path.join(config.buildFolder, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    }),
    plumber({ errorHandler: onError }),
    zip(fileName),
    dest('archives/'),
  ];

  // Ваш фирменный нативный метод связки стримов через reduce
  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', () => {
      console.log(`\n📦 [Gulp 5] Архив успешно создан: archives/${fileName}\n`);
    });
}
