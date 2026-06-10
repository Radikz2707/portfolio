import { config } from '../gulp.config.js';
import gulp from 'gulp';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import { Transform } from 'stream'; // Нативный потоковый класс Node.js
import path from 'path';
import { onError, isProd, bs } from './server.js';

const { src, dest } = gulp;

// =========================================================================
// 🌐 1. УМНЫЙ ОПТИМИЗАТОР ССЫЛОК И АДАПТЕР ОТНОСИТЕЛЬНЫХ ПУТЕЙ ФАВИКОНОК
// =========================================================================
const fixHtmlPaths = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let html = file.contents.toString('utf-8');

        // Вычисляем относительный путь до корня сборки
        const relativeToRoot = path.relative(
          path.dirname(path.join(config.buildFolder, file.relative)),
          config.buildFolder,
        );

        let pathPrefix = relativeToRoot.replace(/\\/g, '/');
        if (pathPrefix && !pathPrefix.endsWith('/')) {
          pathPrefix += '/';
        }

        // 1. Заменяем маркерные заглушки меню на валидные относительные ссылки
        html = html
          .replace('href="GO_HOME"', `href="${pathPrefix}index.html"`)
          .replace(
            'href="GO_PROJECTS"',
            `href="${pathPrefix}index.html#projects"`,
          )
          .replace('href="GO_ABOUT"', `href="${pathPrefix}index.html#about"`)
          .replace(
            'href="GO_BLOG"',
            `href="${pathPrefix}blog/why-gulp-ts.html"`,
          );

        // 2. 🔥 ИСПРАВЛЕННЫЙ АДАПТЕР ФАВИКОНОК ДЛЯ ЛЮБОГО СИНТАКСИСА:
        // Находит теги link/meta, содержащие "images/favicons/" (с ведущим слэшем или без него),
        // очищает их от старого префикса и подставляет идеальный pathPrefix текущей страницы
        html = html.replace(
          /(<(?:link|meta)\s+[^>]*?)(href|content)=["'](?:\/?images\/favicons\/)([^"']+?\.(?:png|ico|json|xml|svg))["']([^>]*?>)/gi,
          (match, tagStart, attrName, fileName, tagEnd) => {
            return `${tagStart}${attrName}="${pathPrefix}images/favicons/${fileName}"${tagEnd}`;
          },
        );

        file.contents = Buffer.from(html, 'utf-8');
      }
      callback(null, file);
    },
  });
};

// =========================================================================
// 🖼️ 2. АВТОГЕНЕРАТОР ТЕГОВ <picture> С ПОДДЕРЖКОЙ WEBP
// =========================================================================
const fixPictureTags = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let html = file.contents.toString('utf-8');

        html = html.replace(
          /<img\s+([^>]*?)src=["']([^"']+\.(?:png|jpg|jpeg))["']([^>]*?)>/gi,
          (match, before, srcPath, after) => {
            const allAttributes = `${before} ${after}`;

            if (
              allAttributes.includes('data-ignore') ||
              allAttributes.includes('img-ignore')
            ) {
              return match;
            }

            const webpPath = srcPath.replace(/\.(?:png|jpg|jpeg)$/i, '.webp');
            const cleanAttributes = `${before.trim()} ${after.trim()}`.trim();
            const imgAttributes = cleanAttributes ? ` ${cleanAttributes}` : '';

            return `<picture>\n  <source srcset="${webpPath}" type="image/webp">\n  <img src="${srcPath}"${imgAttributes}>\n</picture>`;
          },
        );

        file.contents = Buffer.from(html, 'utf-8');
      }
      callback(null, file);
    },
  });
};

// =========================================================================
// 🚀 3. ОСНОВНАЯ ТАСКА СБОРКИ HTML (PIPELINE + REDUCE PATTERN)
// =========================================================================
export function html() {
  const pipeline = [
    src([
      `${config.srcFolder}/*.html`,
      `!${config.srcFolder}/components/**/*.html`,
      `!${config.srcFolder}/parts/**/*.html`,
    ]),
    plumber({ errorHandler: onError }),
    fileInclude({ prefix: '@@', basepath: '@file' }),
    fixHtmlPaths(), // Применяем наш обновленный комплексный транслятор путей
  ];

  if (isProd) {
    pipeline.push(fixPictureTags());
  }

  pipeline.push(
    htmlBeautify({
      indent_size: 2,
      indent_char: ' ',
      eol: '\n',
      preserve_newlines: true,
      max_preserve_newlines: 1,
      indent_inner_html: true,
      extra_liners: [],
    }),
  );

  pipeline.push(
    htmlhint({
      'doctype-first': false,
      'tagname-lowercase': true,
      'attr-lowercase': true,
      'attr-value-double-quotes': true,
      'attr-no-duplication': true,
      'id-unique': true,
      'src-not-empty': true,
      'alt-require': true,
      'img-alt-require': true,
      'tag-pair': true,
      'spec-char-escape': true,
    }),
  );

  pipeline.push(htmlhint.reporter('htmlhint-stylish', { failReporter: false }));
  pipeline.push(dest(config.buildFolder));

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}
