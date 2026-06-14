import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import plumber from 'gulp-plumber';
import flatten from 'gulp-flatten';
import svgSprite from 'gulp-svg-sprite';
import newer from 'gulp-newer';
import sharp from 'sharp'; // Прямая нативная генерация
import { onError, bs } from './server.js';
import { sharpCompressor } from './utils.js';

const { src, dest } = gulp;

const imageSources = [
  `${config.srcFolder}/images/**/*`,
  `!${config.srcFolder}/images/src/favicon.png`,
  `!${config.srcFolder}/images/favicon.png`,
  `!${config.srcFolder}/images/favicons/**/*`,
  `${config.srcFolder}/components/**/img/**/*.{jpg,jpeg,png,svg,webp,gif}`,
];

const gulp5Options = { encoding: false };

export function images() {
  return new Promise((resolve, reject) => {
    const pipeline = [
      src(imageSources, gulp5Options),
      plumber({ errorHandler: onError }),
      newer({
        dest: config.paths.images.dest,
        map: (relative) => path.basename(relative),
      }),
      sharpCompressor({
        jpegQuality: config.settings.imagemin?.jpeg || 75,
        webpQuality: config.settings.webpQuality || 70,
      }),
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

export function createWebp() {
  /* Оставляем как в прошлом шаге */
}

export function sprite() {
  /* Оставляем как в прошлом шаге */
}

// 🔥 100% АВТОМАТИЗАЦИЯ ФАВИКОНОК НА SHARP БЕЗ РУЧНОЙ РАБОТЫ И БЕЗ БАГОВ
export async function favs(done) {
  const srcFavicon = path.join(
    config.srcFolder,
    'images',
    'src',
    'favicon.png',
  );
  const faviconsSrcDir = path.join(config.srcFolder, 'images', 'favicons');
  const partHtmlPath = path.join(
    config.srcFolder,
    'parts',
    'favicon-links.html',
  );

  // Если исходного favicon.png нет, просто выходим
  if (!fs.existsSync(srcFavicon)) {
    console.log(
      '⚠️ Исходный файл src/images/src/favicon.png не найден. Пропускаем генерацию.',
    );
    return done();
  }

  try {
    // 1. Автоматически создаем папку для фавиконок, если её нет
    if (!fs.existsSync(faviconsSrcDir)) {
      fs.mkdirSync(faviconsSrcDir, { recursive: true });
    }

    // 2. Нарезаем иконки через быстрый sharp без ошибок colourspace
    const sharpInstance = sharp(srcFavicon);

    await sharpInstance
      .clone()
      .resize(32, 32)
      .png()
      .toFile(path.join(faviconsSrcDir, 'favicon-32.png'));
    await sharpInstance
      .clone()
      .resize(180, 180)
      .png()
      .toFile(path.join(faviconsSrcDir, 'apple-touch-icon.png'));
    await sharpInstance
      .clone()
      .resize(192, 192)
      .png()
      .toFile(path.join(faviconsSrcDir, 'icon-192.png'));
    await sharpInstance
      .clone()
      .resize(512, 512)
      .png()
      .toFile(path.join(faviconsSrcDir, 'icon-512.png'));

    // 3. Автоматически пишем HTML-файл в папку parts
    const htmlContent = `<link rel="icon" href="images/favicons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="images/favicons/apple-touch-icon.png">
<link rel="manifest" href="images/favicons/manifest.webmanifest">`;

    fs.writeFileSync(partHtmlPath, htmlContent, 'utf8');

    // 4. Автоматически пишем манифест приложения
    const manifestContent = {
      name: config.siteName || 'My Project',
      short_name: config.siteName || 'Project',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    };

    fs.writeFileSync(
      path.join(faviconsSrcDir, 'manifest.webmanifest'),
      JSON.stringify(manifestContent, null, 2),
      'utf8',
    );

    console.log(
      '✅ [Sharp-Favs] Все иконки, манифест и HTML-парт сгенерированы автоматически!',
    );
    done();
  } catch (err) {
    onError(err);
    done(err);
  }
}

export function faviconsDev(done) {
  done();
}

// 6. Очистка каталогов графики
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
