import { config } from '../gulp.config.js';
import gulp from 'gulp';
import fs from 'fs';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import replace from 'gulp-replace';
import path from 'path';
import gulpIf from 'gulp-if';
import rename from 'gulp-rename';
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

      const repoName = config.repoPath
        ? config.repoPath.split('/')
        : 'portfolio';
      const pathPrefix = isProd ? `/${repoName}` : './';
      let content = file.contents.toString('utf-8');

      const addPrefix = (match, p1, p2) => {
        const normalizedPath = file.path.replace(/\\/g, '/');
        const fileName = path.basename(normalizedPath);

        const isInBlogFolder =
          normalizedPath.includes('/src/blog/') ||
          normalizedPath.includes('/dist/blog/');
        const isBlogIndex = isInBlogFolder && fileName === 'index.html';
        const isArticle = isInBlogFolder && !isBlogIndex;

        // Очищаем пришедший путь от лишних ведущих точек и слэшей, чтобы не плодить пути вида ../../
        const cleanP2 = p2.replace(/^[.\\/]+/, '');

        if (isArticle) {
          return `${p1}../../${cleanP2}`;
        }
        if (isBlogIndex) {
          return `${p1}../${cleanP2}`;
        }
        if (
          cleanP2.startsWith(pathPrefix) ||
          (pathPrefix === './' && cleanP2.startsWith('/'))
        ) {
          return match;
        }
        return `${p1}${pathPrefix}${cleanP2}`;
      };

      // 1. Ссылки на стили
      content = content.replace(
        /(href=["']\s*)(\.?\/?css\/[^"']+\.(?:css))/gi,
        addPrefix,
      );
      // 2. Скрипты
      content = content.replace(
        /(src=["']\s*)(\.?\/?js\/[^"']+\.(?:js)(?:\?[^"']*)?)/gi,
        (match, p1, p2) => {
          const hasVersion = p2.includes('?v=');
          const version =
            isProd && !hasVersion ? `?v=${global.buildSig || Date.now()}` : '';
          return addPrefix(match, p1, p2 + version);
        },
      );
      // 3. Изображения
      content = content.replace(
        /((?:src|srcset)=["']\s*)(\.?\/?images\/[^"']+\.(?:png|jpg|jpeg|webp|svg|gif|ico))/gi,
        addPrefix,
      );
      // 4. Шрифты
      content = content.replace(
        /(href=["']\s*)(\.?\/?fonts\/[^"']+\.(?:woff2|woff|ttf|otf|eot))/gi,
        addPrefix,
      );
      // 5. 🔥 ОБНОВЛЕНО: Тотальный перехват любых путей к фавиконкам (с точками, без, со слэшами)
      content = content.replace(
        /(href=["']\s*)(\.?\/?images\/favicons\/[^"']+\.(?:png|ico|svg|xml|json|webmanifest))/gi,
        addPrefix,
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

            // 🔥 ИСПРАВЛЕНО: Объявляем пе��еменную cleanAttributes, чтобы Gulp не падал
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

    replace(
      /href=["']\s*\/?\s*(GO_HOME|GO_PROJECTS|GO_ABOUT|GO_BLOG|GO_CONTACTS?)\s*["']/gi,
      function (match, marker) {
        // 🌍 Абсолютно безопасный расчет путей без вмешательства в объекты Gulp-потока
        // Метод использует относительное позиционирование страниц блога
        const m = marker.toUpperCase();

        if (m === 'GO_HOME') {
          return `href="./index.html"`;
        }

        if (m === 'GO_BLOG') {
          return `href="./blog/index.html"`;
        }

        const anchorMap = {
          GO_PROJECTS: 'projects',
          GO_ABOUT: 'about',
          GO_CONTACTS: 'contacts',
          GO_CONTACT: 'contacts',
        };

        const anchor = anchorMap[m];
        return `href="./index.html#${anchor}"`;
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

  // 🔥 ДОБАВЛЕН ВЫЗОВ fixHtmlPaths() ДЛЯ ИСПРАВЛЕНИЯ ПУТЕЙ К ФАВИКОНКАМ И ДРУГИМ РЕСУРСАМ
  // Вызываем до htmlhint, чтобы не потерять контекст file.path
  pipeline.push(fixHtmlPaths());

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
// 📑 4. Генератор карточек категорий для главной страницы блога
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

  // Полный словарь переводов со всеми вашими категориями
  const categoryNames = {
    programming: 'Программирование',
    'project-info': 'О проекте',
    space: 'Космос',
    poems: 'Мои стихи',
    books: 'Книги',
    travel: 'Путешествия',
    games: 'Игры и развлечения',
    psychology: 'Психология',
    finance: 'Финансы и Инвестиции',
    work: 'Работа и Карьера',
  };

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

    // Берем русский перевод из словаря по cleanKey (в нижнем регистре)
    const cleanKey = category.toLowerCase().trim();
    const categoryTitle =
      categoryNames[cleanKey] ||
      category.charAt(0).toUpperCase() + category.slice(1);

    const pluralText = getPluralArticles(articleCount);

    categoryCardsHtml += `
    <div class='blog-category-card'>
      <div class='blog-category-card__header' role='button' aria-expanded='false'>
        <h3 class='blog-category-card__title'>${categoryTitle}</h3>
        <p class='blog-category-card__count'>${pluralText}</p>
      </div>
      <ul class='blog-category-card__list' style='overflow: hidden; height: 0px;'>
    `;

    // 🔥 ИСПРАВЛЕНО: Цикл последовательно дожидается выполнения getFirstLineOfFile для каждого файла
    for (const file of articleFiles) {
      const fileName = path.basename(file, path.extname(file));
      const articleUrl = `./${category}/${fileName}.html`;
      const fullFilePath = path.join(categoryDir, file);

      // Вызываем всеядный импортированный метод из контент-процессора
      let articleTitle = '';
      try {
        articleTitle = await getFirstLineOfFile(fullFilePath);
      } catch (err) {
        console.error(
          `❌ Ошибка чтения заголовка для карточки ${file}:`,
          err.message,
        );
      }

      // Резервный вариант (если файл пустой или вернул ошибку)
      if (!articleTitle) {
        const slugTitle = fileName.replace(/-/g, ' ');
        articleTitle = slugTitle.charAt(0).toUpperCase() + slugTitle.slice(1);
      }

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
// 📑 5. Сборка всех страниц блога с корректными относительными путями
// =======================================================================
export async function blogIndex(done) {
  const folderName = 'blog';

  // Генерируем динамические блоки ссылок и карточек
  const sidebarLinks = await generateSidebarLinks(folderName);
  const categoryCardsHtml = await generateCategoryCards();

  // Массив источников: считываем и корень src/blog/, и все подпапки категорий
  const sources = [
    path.join(config.srcFolder, 'blog', '*.html'), // Главный index.html блога
    path.join(config.srcFolder, 'blog', '**', '*.html'), // Все статьи во вложенных папках
  ];

  return (
    src(sources, { allowEmpty: true })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(
        fileInclude({
          prefix: '@@',
          basepath: 'src',
          resolvePaths: false,
          filters: {},
          indent: true,
        }),
      )
      .pipe(replace(/SITE_NAME/gi, config.siteName))
      .pipe(replace(/SITE_AUTHOR/gi, config.repoPath))

      // 🔗 Безопасная относительная ЧПУ-навигация по сайту
      .pipe(replace(/href=["']\s*\/?GO_HOME\s*["']/gi, 'href="../index.html"'))
      .pipe(replace(/href=["']\s*\/?GO_BLOG\s*["']/gi, 'href="./index.html"'))
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

      // 🛡️ АВТОМАТИЧЕСКИЙ ФИЛЬТР ПУТЕЙ СТАТЕЙ:
      // Запускаем исправление внутренних путей для всех страниц блога
      // Убрана проверка isRootBlogFile, чтобы обрабатывать blog/index.html тоже
      .pipe(fixHtmlPaths())

      .pipe(replace(/@@sidebar/g, sidebarLinks))
      .pipe(replace(/@@categories/g, categoryCardsHtml))

      // 🌍 АВТОМАТИЧЕСКИЙ КРОСС-ПЛАТФОРМЕННЫЙ ФИКС ДИЗАЙНА (CSS / JS):
      // Анализирует среду и на лету собирает пути для локалки, IIS и GitHub!
      .pipe(
        replace(
          /(href|src)=["']\s*\/?(css\/app\.min\.css|js\/app\.min\.js)["']/gi,
          function (match, attr, resource) {
            // Извлекаем имя репозитория/папки из config.repoPath (например, 'portfolio')
            const repoName =
              config.repoPath && config.repoPath.includes('/')
                ? config.repoPath.split('/')[1]
                : 'portfolio';

            // Определяем режим на основе флага или переменных (Gulp dev-сервер против Production билда)
            // Если у вас в gulp/html.js используется глобальный флаг isProd, используйте его: !isProd
            const isGulpDevServer =
              typeof global.isProd === 'boolean' ? !global.isProd : true;

            if (isGulpDevServer) {
              // 1. Для npm run dev (http://localhost:8080) — чистый относительный подъем
              return `${attr}="../../${resource}"`;
            } else {
              // 2. Для локального IIS (http://localhost/portfolio) и GitHub Pages — абсолютный путь от корня сервера
              return `${attr}="/${repoName}/${resource}"`;
            }
          },
        ),
      )

      // 🛡️ ПРИНУДИТЕЛЬНОЕ ИМЯ: Гарантируем расширение index.html для корня блога
      .pipe(
        rename((file) => {
          const isRoot = file.dirname === '.' || file.dirname === '';
          if (isRoot) {
            file.basename = 'index';
          }
        }),
      )

      // 📦 ШАГ 1: Записываем готовый результат в локальный dist/blog/
      .pipe(dest(path.join(config.buildFolder, 'blog')))

      // 🚚 ШАГ 2: Принудительный деплой копии напрямую в веб-сервер Windows IIS wwwroot,
      // чтобы файлы обновлялись в реальном времени при сохранении в редакторе
      .pipe(
        dest(
          path.join(
            config.localServerFolder || 'C:/inetpub/wwwroot/portfolio',
            'blog',
          ),
        ),
      )

      .on('end', () => {
        if (typeof bs !== 'undefined' && bs.reload) {
          bs.reload();
        }
        if (typeof done === 'function') done();
      })
  );
}
