// gulp/seo.js — Абсолютный контроль поисковой оптимизации и карт контента
import { config } from '../gulp.config.js';
import gulp from 'gulp';
import sitemap from 'gulp-sitemap';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import through2 from 'through2';
import plumber from 'gulp-plumber';
import { getFirstLineOfFile } from './utils/content-processor.js';
import { onError } from './server.js'; // Наш безопасный обработчик ошибок

dotenv.config();
const { src, dest } = gulp;

/**
 * 🌐 1. Автоматический генератор sitemap.xml на основе собранного HTML
 */
export const generateSitemap = (done) => {
  const siteUrl = process.env.SITE_URL || 'https://radik.dev';

  // Сканируем только готовые HTML-файлы в dist/ паблике
  return src(`${config.buildFolder}/**/*.html`, {
    read: false,
    allowEmpty: true,
  })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      sitemap({
        siteUrl: siteUrl,
        changefreq: 'weekly',
        priority: 0.7,
        mappings: [
          {
            pages: ['index.html'],
            priority: 1.0,
            changefreq: 'daily',
          },
          {
            pages: ['blog/index.html'],
            priority: 0.9,
            changefreq: 'daily',
          },
        ],
      }),
    )
    .pipe(dest(config.buildFolder));
};
generateSitemap.displayName = 'seo:sitemap';

/**
 * 📑 2. Кастомный генератор карт контента (content-map.json) из исходных MD-файлов
 */
export const generateContentMap = (done) => {
  const contentMap = [];
  const contentRoot = path.join(config.srcFolder, 'content');
  const destDir = config.buildFolder;

  return src(`${contentRoot}/**/*.md`, { allowEmpty: true })
    .pipe(plumber({ errorHandler: onError }))
    .pipe(
      through2.obj(async function (file, enc, cb) {
        if (file.isNull()) return cb(null, file);

        try {
          const relativePath = path.relative(contentRoot, file.path);
          const fileName = path.basename(file.path, '.md');

          if (fileName.toLowerCase() === 'index' || fileName.startsWith('.')) {
            return cb(null, file);
          }

          const category = path.dirname(relativePath).replace(/\\/g, '/');

          let articleTitle = await getFirstLineOfFile(file.path);
          if (!articleTitle) {
            articleTitle = fileName.replace(/-/g, ' ');
            articleTitle =
              articleTitle.charAt(0).toUpperCase() + articleTitle.slice(1);
          }

          const articleUrl = `/blog/${category}/${fileName}.html`;

          contentMap.push({
            title: articleTitle,
            url: articleUrl,
            category: category,
            modified: file.stat?.mtime || new Date().toISOString(),
          });

          cb(null, file); // При успешном выполнении коллбэк работает штатно
        } catch (err) {
          console.error(
            `❌ [CONTROL SEO ERROR] Ошибка обработки файла ${file.relative}:`,
            err.message,
          );
          // 🔥 ИСПРАВЛЕНО: Безопасно транслируем ошибку в поток plumber через контекст функции
          this.emit('error', err);
        }
      }),
    )
    .on('end', () => {
      try {
        // Гарантируем существование целевой папки перед записью JSON
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const destPath = path.join(destDir, 'content-map.json');
        fs.writeFileSync(
          destPath,
          JSON.stringify(contentMap, null, 2),
          'utf-8',
        );

        console.log(
          '✅ Карта контента content-map.json успешно обновлена в dist/',
        );

        // 🔥 КРИТИЧЕСКИЙ СИГНАЛ: Явно уведомляем Gulp о том, что таска завершена на 100%
        if (typeof done === 'function') done();
      } catch (err) {
        console.error(
          '🔴 [CONTROL SEO ERROR] Не удалось записать content-map.json на диск!',
        );
        if (typeof done === 'function') done(err);
      }
    });
};
generateContentMap.displayName = 'seo:content-map';
