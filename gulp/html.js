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
import {
  generateSidebarLinks,
  getFirstLineOfFile,
} from './utils/content-processor.js';

const { src, dest } = gulp;

// =======================================================================
// 🌐 1. Умный оптимизатор ссылок и адаптер относительных путей фавиконов
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
        /(href=["']\s*)(css\/[^"']+\.(?:css))/gi,
        addPrefix,
      );
      content = content.replace(
        /(src=["']\s*)(js\/[^"']+\.(?:js))/gi,
        (match, p1, p2) => {
          // Добавляем версию только для основных скриптов и только в продакшене или если это app.min.js
          const version = isProd ? `?v=${global.buildSig || Date.now()}` : '';
          return addPrefix(match, p1, p2 + version);
        },
      );
      content = content.replace(
        /(src=["']\s*)(js\/[^"']+\.(?:js)(?:\?[^"']*)?)/gi,
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
// 🖼️ 2. Автогенератор тегов с поддержкой WebP
// =======================================================================
const fixPictureTags = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let htmlContent = file.contents.toString('utf-8');
        htmlContent = htmlContent.replace(
          /<img\s+([^>]*?)src=["']([^"']+\.(?:png|jpg|jpeg))[="']([^>]*?)>/gi,
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
// 🚀 3. Основная задача сборки HTML кода корня сайта
// =======================================================================
export function html() {
  const repoName = config.repoPath
    ? config.repoPath.split('/')[1]
    : 'portfolio';
  const rootPrefix = isProd ? `/${repoName}` : '';

  const pipeline = [
    src([
      `${config.srcFolder}/*.html`,
      `!${config.srcFolder}/components/**/*.html`,
      `!${config.srcFolder}/parts/**/*.html`,
      `!${config.srcFolder}/blog/**/*.html`,
    ]),
    plumber({ errorHandler: onError }),
    fileInclude({ prefix: '@@', basepath: 'src', filters: {}, indent: true }),

    // 🔥 ИНТЕЛЛЕКТУАЛЬНАЯ ЗАМЕНА МАРКЕРОВ В ЗАВИСИМОСТИ ОТ СТРАНИЦЫ
    // Функция проверяет имя файла. На главной ставит чистый якорь #about, в блоге — полный путь /index.html#about
    replace(
      /href=["']\s*\/?\s*(GO_HOME|GO_PROJECTS|GO_ABOUT|GO_BLOG|GO_CONTACTS?)\s*["']/gi,
      function (match, marker) {
        const currentFile = this.file.path.replace(/\\/g, '/');
        const isIndexPage =
          currentFile.endsWith('/index.html') &&
          !currentFile.includes('/blog/');
        const m = marker.toUpperCase();

        if (m === 'GO_HOME') {
          return `href="${rootPrefix}/index.html"`;
        }
        if (m === 'GO_BLOG') {
          return `href="${rootPrefix}/blog/index.html"`;
        }

        const anchorMap = {
          GO_PROJECTS: 'projects',
          GO_ABOUT: 'about',
          GO_CONTACTS: 'contacts',
          GO_CONTACT: 'contacts',
        };
        const anchor = anchorMap[m];

        // 🔥 Если мы на главной странице — отдаем СТРОГО ЧИСТЫЙ ХЭШ, чтобы не злить ваш JS-скрипт скролла
        if (isIndexPage) {
          return `href="#${anchor}"`;
        } else {
          // Если мы в блоге — отдаем полный путь для возврата на главную
          return `href="${rootPrefix}/index.html#${anchor}"`;
        }
      },
    ),

    replace(/SITE_NAME/gi, config.siteName),
    replace(/SITE_AUTHOR/gi, config.repoPath),
    replace(
      /js\/app\.min\.js/gi,
      `js/app.min.js?v=${global.buildSig || Date.now()}`,
    ),
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
// 📑 5. Генератор карточек категорий для главной страницы блога
// =======================================================================
const generateCategoryCards = async () => {
  const contentRoot = path.join(config.srcFolder, 'content');
  if (!fs.existsSync(contentRoot)) return '';

  // 🔥 ХЕЛПЕР СКЛОНЕНИЯ ЧИСЛИТЕЛЬНЫХ (Грамматика "1 статья", "5 статей")
  const getPluralArticles = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 14) return `${count} статей`;
    if (mod10 === 1) return `${count} статья`;
    if (mod10 >= 2 && mod10 <= 4) return `${count} статьи`;
    return `${count} статей`;
  };

  const categories = fs.readdirSync(contentRoot).filter((f) => {
    const fullPath = path.join(contentRoot, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'blog';
  });

  let categoryCardsHtml = '';

  for (const category of categories) {
    const categoryDir = path.join(contentRoot, category);
    const files = fs.readdirSync(categoryDir);

    const articleFiles = files.filter((f) => {
      if (f.toLowerCase().startsWith('index.') || f.startsWith('~$'))
        return false;
      const ext = path.extname(f).toLowerCase();
      return ['.md', '.txt', '.rtf', '.docx'].includes(ext);
    });

    const articleCount = articleFiles.length;
    if (articleCount === 0) continue;

    const categoryNames = {
      programming: 'Программирование',
      'project-info': 'О проекте',
      space: 'Космос',
      poems: 'Мои стихи',
      books: 'Книги',
      travel: 'Путешествия',
      games: 'Игры и развлечения',
      psychology: 'Психология',
    };

    const categoryTitle =
      categoryNames[category] ||
      category.charAt(0).toUpperCase() + category.slice(1);

    // 🔥 ИСПРАВЛЕНО: Строго одинарные кавычки для БЭМ-классов HTML + умный счетчик pluralText
    const pluralText = getPluralArticles(articleCount);

    categoryCardsHtml += `
    <div class='blog-category-card'>
      <div class='blog-category-card__header' role='button' aria-expanded='false'>
        <h3 class='blog-category-card__title'>${categoryTitle}</h3>
        <p class='blog-category-card__count'>${pluralText}</p>
      </div>
      <ul class='blog-category-card__list' style='overflow: hidden; height: 0px;'>
    `;

    for (const file of articleFiles) {
      const fullFilePath = path.join(categoryDir, file);
      const fileName = path.basename(file, path.extname(file));
      const articleUrl = `/blog/${category}/${fileName}.html`;

      let articleTitle = await getFirstLineOfFile(fullFilePath);

      if (!articleTitle) {
        const slugTitle = fileName.replace(/-/g, ' ');
        articleTitle = slugTitle.charAt(0).toUpperCase() + slugTitle.slice(1);
      }

      // 🔥 ИСПРАВЛЕНО: Одинарные кавычки внутри элементов списка статей
      categoryCardsHtml += `
        <li class='blog-category-card__item'>
          <a class='blog-category-card__link' href='${articleUrl}'>${articleTitle}</a>
        </li>
      `;
    }

    categoryCardsHtml += `
      </ul>
    </div>`;
  }
  return categoryCardsHtml;
};

// =======================================================================
// 📑 4. Сборка всех страниц блога с корректными относительными путями
// =======================================================================
export async function blogIndex() {
  const srcPath = path.join(config.srcFolder, 'blog', '**', '*.html');
  const folderName = 'blog';

  const sidebarLinks = await generateSidebarLinks(folderName);
  const categoryCardsHtml = await generateCategoryCards();

  return src([path.join(config.srcFolder, 'blog', '**', '*.html')], {
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
    .pipe(replace(/href=["']\s*\/?GO_BLOG\s*["']/gi, 'href="index.html"'))
    .pipe(
      replace(
        /href=["']\s*\/?GO_PROJECTS\s*["']/gi,
        'href="../index.html#projects"',
      ),
    )
    .pipe(
      replace(/href=["']\s*\/?GO_ABOUT\s*["']/gi, 'href="../index.html#about"'),
    )
    .pipe(
      replace(
        /href=["']\s*\/?GO_CONTACTS\s*["']/gi,
        'href="../index.html#contacts"',
      ),
    )
    .pipe(fixHtmlPaths())
    .pipe(replace(/@@sidebar/g, sidebarLinks))
    .pipe(replace(/@@categories/g, categoryCardsHtml))
    .pipe(dest(path.join(config.buildFolder, 'blog')))
    .on('end', () => {
      bs.reload();
    });
}
