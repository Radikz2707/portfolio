import { config } from '../gulp.config.js';
import gulp from 'gulp';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import { Transform } from 'stream';
import path from 'path';

import { onError, isProd, bs } from './server.js';

const { src, dest } = gulp;

// Умный оптимизатор ссылок навигации для деплоя и локалки
const fixMenuLinks = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let html = file.contents.toString();

        const relativeToRoot = path.relative(
          path.dirname(path.join(config.buildFolder, file.relative)),
          config.buildFolder,
        );

        let pathPrefix = relativeToRoot.replace(/\\/g, '/');
        if (pathPrefix && !pathPrefix.endsWith('/')) {
          pathPrefix += '/';
        }

        html = html.replace('href="GO_HOME"', `href="${pathPrefix}index.html"`);
        html = html.replace(
          'href="GO_PROJECTS"',
          `href="${pathPrefix}index.html#projects"`,
        );
        html = html.replace(
          'href="GO_ABOUT"',
          `href="${pathPrefix}index.html#about"`,
        );
        html = html.replace(
          'href="GO_BLOG"',
          `href="${pathPrefix}blog/why-gulp-ts.html"`,
        );

        file.contents = Buffer.from(html);
      }
      callback(null, file);
    },
  });
};

// Твой оригинальный генератор тега строго с WebP со скриншота шаблона
const fixPictureTags = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let html = file.contents.toString();

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

        file.contents = Buffer.from(html);
      }
      callback(null, file);
    },
  });
};

export function html() {
  const pipeline = [
    src([
      /* 🔥 ИСПРАВЛЕНО: Читаем HTML-файлы строго из корня папки src, 
         убрав несуществующий путь src/blog/, который намертво вешал Gulp! */
      `${config.srcFolder}/*.html`,
      `!${config.srcFolder}/components/**/*.html`,
      `!${config.srcFolder}/parts/**/*.html`,
    ]),
    plumber({ errorHandler: onError }),
    fileInclude({ prefix: '@@', basepath: '@file' }),
    fixMenuLinks(),
  ];

  // Твой оригинальный условный пуш WebP из шаблона
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

  /* 🔥 ВОССТАНОВЛЕНО ИЗ ШАБЛОНА: Нативный метод связки стримов через reduce */
  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', bs.reload);
}
