// gulp/seo.js
import { config } from '../gulp.config.js';
import gulp from 'gulp';
import sitemap from 'gulp-sitemap';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import through2 from 'through2';
import { getFirstLineOfFile } from './utils/content-processor.js';

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
export const generateContentMap = () => {
  const contentMap = [];
  const contentRoot = path.join(config.srcFolder, 'content');

  return src(`${contentRoot}/**/*.md`, { allowEmpty: true })
    .pipe(
      through2.obj(async function (file, enc, cb) {
        if (file.isNull()) return cb(null, file);

        const relativePath = path.relative(contentRoot, file.path);
        const fileName = path.basename(file.path, '.md');

        // Пропускаем индексные и служебные файлы кэша
        if (fileName.toLowerCase() === 'index' || fileName.startsWith('.')) {
          return cb(null, file);
        }

        const category = path.dirname(relativePath).replace(/\\/g, '/');
        // Извлекаем заголовок статьи с помощью вашего родного хелпера
        let articleTitle = await getFirstLineOfFile(file.path);
        if (!articleTitle) {
          articleTitle = fileName.replace(/-/g, ' ');
          articleTitle =
            articleTitle.charAt(0).toUpperCase() + articleTitle.slice(1);
        }

        // Формируем ЧПУ ссылку в соответствии с логикой blogIndex
        const articleUrl = `/blog/${category}/${fileName}.html`;

        contentMap.push({
          title: articleTitle,
          url: articleUrl,
          category: category,
          modified: file.stat?.mtime || new Date().toISOString(),
        });

        cb(null, file);
      }),
    )
    .on('end', () => {
      const destPath = path.join(config.buildFolder, 'content-map.json');
      fs.writeFileSync(destPath, JSON.stringify(contentMap, null, 2), 'utf-8');
      console.log(
        '✅ Карта контента content-map.json успешно обновлена в dist/',
      );
    });
};
generateContentMap.displayName = 'seo:content-map';
