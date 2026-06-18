import { config } from '../gulp.config.js';
import gulp from 'gulp';
import fs from 'fs';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import replace from 'gulp-replace';
import path from 'path';
import { onError, isProd, bs } from './server.js';
import { Transform } from 'stream';

const { src, dest } = gulp;

// =======================================================================
// 🌐 1. УМНЫЙ ОПТИМИЗАТОР ССЫЛОК И АДАПТЕР ОТНОСИТЕЛЬНЫХ ПУТЕЙ ФАВИКОНОВ
// =======================================================================
function fixHtmlPaths() {
  return new Transform({
    objectMode: true,
    transform(file, enc, cb) {
      if (file.isNull() || !file.isBuffer()) {
        return cb(null, file);
      }

      // Вычисляем относительный префикс от текущего файла к корню src
      const srcRoot = config.srcFolder || 'src';
      const relativePath = path.relative(
        path.dirname(file.path),
        path.resolve(srcRoot),
      );
      const pathPrefix = relativePath
        ? relativePath.replace(/\\/g, '/') + '/'
        : '';

      let content = file.contents.toString();

      // Функция добавления префикса, если путь ещё не содержит его
      const addPrefix = (match, p1, p2) => {
        // Для шаблонов статей (components/blog-article) всегда использовать ../
        if (file.path.includes('components/blog-article')) {
          const articlePrefix = '../';
          return p2.startsWith(articlePrefix)
            ? match
            : `${p1}${articlePrefix}${p2}`;
        }
        return p2.startsWith(pathPrefix) ? match : `${p1}${pathPrefix}${p2}`;
      };

      // Обрабатываем ссылки на CSS, JS и изображения
      content = content.replace(
        /(href=["']\s*)(css\/[^"']+\.css(?:\?[^"']*)?)/gi,
        addPrefix,
      );
      content = content.replace(
        /(src=["']\s*)(js\/[^"']+\.js(?:\?[^"']*)?)/gi,
        addPrefix,
      );
      content = content.replace(
        /((?:src|srcset)=["']\s*)(images\/[^"']+\.(?:png|jpg|jpeg|webp|svg|gif|ico))/gi,
        addPrefix,
      );

      // Корректируем пути к фавиконам, делая их относительными
      content = content.replace(
        /(href=["']\s*)\/?images\/favicons\//gi,
        (match, p1) => `${p1}${pathPrefix}images/favicons/`,
      );

      file.contents = Buffer.from(content);
      cb(null, file);
    },
  });
}

// =======================================================================
// 🖼️ 2. АВТОГЕНЕРАТОР ТЕГОВ С ПОДДЕРЖКОЙ WEBP
// =======================================================================
const fixPictureTags = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let htmlContent = file.contents.toString('utf-8');
        htmlContent = htmlContent.replace(
          /<img\s+([^>]*?)src=["']([^"']+?\.(?:png|jpg|jpeg))["']([^>]*?)>/gi,
          (match, before, srcPath, after) => {
            const allAttributes = `${before} ${after}`;
            if (
              allAttributes.includes('data-ignore') ||
              allAttributes.includes('img-ignore')
            ) {
              return match;
            }
            const webpPath = srcPath.replace(/\.(?:png|jpg|jpeg)$/i, '.webp');

            // 🔥 ИСПРАВЛЕНО: Объявляем переменную cleanAttributes, чтобы Gulp не падал
            const cleanAttributes = `${before.trim()} ${after.trim()}`.trim();

            return `<picture>\n <source srcset="${webpPath}" type="image/webp">\n <img src="${srcPath}"${cleanAttributes ? ' ' + cleanAttributes : ''}>\n</picture>`;
          },
        );
        file.contents = Buffer.from(htmlContent, 'utf-8');
      }
      callback(null, file);
    },
  });
};

// =======================================================================
// 🚀 3. ОСНОВНАЯ ТАСКА СБОРКИ HTML КОД КОРНЯ САЙТА
// =======================================================================
export function html() {
  const pipeline = [
    src([
      `${config.srcFolder}/*.html`,
      `!${config.srcFolder}/components/**/*.html`,
      `!${config.srcFolder}/parts/**/*.html`,
      `!${config.srcFolder}/blog/**/*.html`,
    ]),
    plumber({ errorHandler: onError }),
    fileInclude({ prefix: '@@', basepath: 'src', filters: {}, indent: true }),

    // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Новые всеядные регулярные выражения (символ слэша сделан необязательным)
    replace(/href=["']\s*\/?\s*GO_HOME\s*["']/gi, 'href="index.html"'),
    replace(
      /href=["']\s*\/?\s*GO_PROJECTS\s*["']/gi,
      'href="index.html#projects"',
    ),
    replace(/href=["']\s*\/?\s*GO_ABOUT\s*["']/gi, 'href="index.html#about"'),

    // Идеальный относительный путь, ловит и "/GO_BLOG", и "GO_BLOG"
    replace(/href=["']\s*\/?\s*GO_BLOG\s*["']/gi, 'href="blog/index.html"'),

    replace(
      /href=["']\s*\/?\s*GO_CONTACTS?\s*["']/gi,
      'href="index.html#contacts"',
    ),

    replace(/SITE_NAME/gi, config.siteName),
    replace(/SITE_AUTHOR/gi, config.repoPath),
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

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .pipe(dest(config.buildFolder))
    .on('end', bs.reload);
}

// =======================================================================
// 📑 4. СБОРКА ВСЕХ СТРАНИЦ БЛОГА С КОРРЕКТНЫМИ ОТНОСИТЕЛЬНЫМИ ПУТЯМИ
// =======================================================================
export function blogIndex() {
  const srcPath = path.join(config.srcFolder, 'blog', '**', '*.html');
  const blogContentDir = path.join(config.srcFolder, 'content', 'blog');
  let sidebarLinks = '';

  if (fs.existsSync(blogContentDir)) {
    const files = fs.readdirSync(blogContentDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (file.toLowerCase().startsWith('index.')) continue;
      if (!['.md', '.txt', '.rtf', '.docx'].includes(ext)) continue;

      const slug = path.basename(file, ext).toLowerCase();
      // Попытка взять заголовок из первого заголовка Markdown‑файла
      let title = (() => {
        try {
          const mdPath = path.join(blogContentDir, `${slug}${ext}`);
          const mdContent = fs.readFileSync(mdPath, 'utf-8');
          const firstLine = mdContent.split('\n')[0];
          const match = firstLine.match(/^#\s+(.*)/);
          if (match) {
            return match[1].trim();
          }
        } catch (e) {
          // Если чтение не удалось, будем использовать fallback
        }
        // fallback: генерировать из slug
        const fallback = slug.replace(/-/g, ' ');
        return fallback.charAt(0).toUpperCase() + fallback.slice(1);
      })();
      sidebarLinks += ` <li class="blog-sidebar__item"><a href="${slug}.html" class="blog-sidebar__link">${title}</a></li>\n`;
    }
  }

  return (
    src([path.join(config.srcFolder, 'blog', '**', '*.html')], {
      allowEmpty: true,
    })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(
        fileInclude({
          prefix: '@@',
          basepath: 'src',
          filters: {},
          indent: true,
        }),
      )
      .pipe(replace(/SITE_NAME/gi, config.siteName))
      .pipe(replace(/SITE_AUTHOR/gi, config.repoPath))
      .pipe(replace(/href=["']\s*\/?GO_HOME\s*["']/gi, 'href="../index.html"'))
      .pipe(
        replace(
          /href=["']\s*\/?GO_PROJECTS\s*["']/gi,
          'href="../index.html#projects"',
        ),
      )
      .pipe(
        replace(
          /href=["']\s*\/?GO_ABOUT\s*["']/gi,
          'href="../index.html#about"',
        ),
      )
      .pipe(
        replace(
          /href=["']\s*\/?GO_CONTACTS\s*["']/gi,
          'href="../index.html#contacts"',
        ),
      )

      // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Удалены все ручные костыли путей.
      // За всю адаптацию ресурсов (css, js, images, favicons) теперь отвечает ТОЛЬКО fixHtmlPaths()
      .pipe(fixHtmlPaths())
      .pipe(replace(/@@sidebar/g, sidebarLinks))
      .pipe(dest(path.join(config.buildFolder, 'blog')))
      .on('end', () => {
        bs.reload();
      })
  );
}
