import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import plumber from 'gulp-plumber';
import zip from 'gulp-zip';
import sharp from 'sharp';
import through2 from 'through2';
import { onError } from './server.js';
import { Transform } from 'stream';

const { src, dest } = gulp;

// 🧹 1. ПОЛНАЯ АСИНХРОННАЯ ОЧИСТКА ПЕРЕД СБОРКОЙ
export async function cleandist(done) {
  try {
    if (fs.existsSync(config.buildFolder)) {
      await fsPromises.rm(config.buildFolder, { recursive: true, force: true });
    }
    const cacheFolder = path.join('node_modules', '.cache');
    if (fs.existsSync(cacheFolder)) {
      await fsPromises.rm(cacheFolder, { recursive: true, force: true });
    }
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

// 🔤 2. БЕЗОПАСНОЕ КОПИРОВАНИЕ ШРИФТОВ В DIST С ПОЛНЫМ КОНТРОЛЕМ PROMISE
export function buildcopy(done) {
  const srcFontsFolder = path.join(config.srcFolder, 'fonts');
  const srcList = [];

  if (fs.existsSync(srcFontsFolder)) {
    srcList.push(path.join(srcFontsFolder, '**', '*'));
  }

  // 🔥 ОПТИМИЗАЦИЯ ПОД МАКСИМАЛЬНЫМ КОНТРОЛЕМ:
  // Сначала асинхронно создаем служебный файл .nojekyll через встроенные промисы Node.js
  return fs.promises
    .mkdir(config.buildFolder, { recursive: true })
    .then(() =>
      fs.promises.writeFile(path.join(config.buildFolder, '.nojekyll'), ''),
    )
    .then(() => {
      // Только после того, как файл успешно записался на диск, запускаем Gulp-стрим копирования
      if (srcList.length === 0) {
        // Если шрифтов нет — просто сигнализируем Gulp о завершении
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const pipeline = [
          src(srcList, {
            allowEmpty: true,
            encoding: false,
            base: config.srcFolder,
          }),
          plumber({ errorHandler: onError }),
          dest(config.buildFolder),
        ];

        pipeline
          .reduce((stream, plugin) => stream.pipe(plugin))
          .on('end', resolve) // Нативно разрешаем Promise при завершении стрима
          .on('error', reject); // Перехватываем ошибки
      });
    })
    .catch((err) => {
      console.error('Ошибка в таске buildcopy:', err);
      done();
    });
}

// 📦 3. АРХИВИРОВАНИЕ СБОРКИ (ZIP)
export function zipFiles() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const fileName = `dist_${year}-${month}-${day}_${hours}-${minutes}.zip`;
  const pipeline = [
    src(path.join(config.buildFolder, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    }),
    plumber({ errorHandler: onError }),
    zip(fileName),
    dest('archives/'),
  ];
  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', () => {
      console.log(`\n📦 [Gulp 5] Архив успешно создан: archives/${fileName}\n`);
    });
}

// 🛠️ 4. ПЛАГИН НА БАЗЕ SHARP ДЛЯ СЖАТИЯ И ОПТИМИЗАЦИИ
export const sharpCompressor = (options = {}) => {
  sharp.cache(false);
  const webpQuality = options.webpQuality || 70;
  const jpegQuality = options.jpegQuality || 75;

  return new Transform({
    objectMode: true,
    async transform(file, enc, callback) {
      if (file.isNull()) return callback(null, file);
      if (file.isStream())
        return callback(new Error('Стримы не поддерживаются!'));

      const ext = path.extname(file.path).toLowerCase();
      if (ext === '.svg' || ext === '.gif') return callback(null, file);

      try {
        let pipeline = sharp(file.contents);
        if (ext === '.jpg' || ext === '.jpeg') {
          pipeline = pipeline.jpeg({
            quality: jpegQuality,
            progressive: true,
            mozjpeg: true,
          });
        } else if (ext === '.png') {
          pipeline = pipeline.png({ compressionLevel: 9, palette: true });
        } else if (ext === '.webp') {
          pipeline = pipeline.webp({ quality: webpQuality });
        }
        file.contents = await pipeline.toBuffer();
        callback(null, file);
      } catch (err) {
        // 🔥 Проверяем, запущен ли финальный билд (production)
        const isProd =
          process.env.NODE_ENV === 'production' ||
          process.argv.includes('--prod') ||
          process.argv.includes('build');

        console.error(
          `\x1b[31m[Sharp Critical Error] Ошибка файла ${file.relative}:\x1b[0m`,
          err.message,
        );

        if (isProd) {
          // Жестко останавливаем билд продакшена, чтобы битая картинка не улетела на хостинг
          callback(
            new Error(
              `[Sharp] Сборка остановлена из-за поврежденного изображения: ${file.relative}`,
            ),
          );
        } else {
          // В режиме разработки (dev) просто пропускаем файл, чтобы сервер не падал
          callback(null, file);
        }
      }
    },
  });
};

// 🛠️ 5. ПЛАГИН ДЛЯ КОНВЕРТАЦИИ В WEBP (БЕЗУПРЕЧНЫЙ NATIVE TRANSFORM)
export const sharpToWebp = (options = {}) => {
  sharp.cache(false);
  const quality = options.quality || 70;

  return new Transform({
    objectMode: true,
    async transform(file, enc, callback) {
      if (file.isNull()) return callback(null, file);
      if (file.isStream())
        return callback(new Error('Стримы не поддерживаются!'));

      const ext = path.extname(file.path).toLowerCase();
      // Если файл уже имеет расширение .webp, пропускаем его дальше по цепочке
      if (ext === '.webp') return callback(null, file);
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) return callback(null, file);

      try {
        file.contents = await sharp(file.contents).webp({ quality }).toBuffer();

        file.path = file.path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        callback(null, file);
      } catch (err) {
        console.error(
          `[Sharp WebP Error] Ошибка файла ${file.relative}:`,
          err.message,
        );
        callback(null, file);
      }
    },
  });
};
