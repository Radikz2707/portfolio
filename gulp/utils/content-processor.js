import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { config } from '../../gulp.config.js';
import mammoth from 'mammoth';
import gulp from 'gulp';
import markdown from 'gulp-markdown';
import { Transform } from 'stream';

const { src } = gulp;

const getFirstLineOfFile = async (filePath) => {
  try {
    const fileStream = fs.createReadStream(filePath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    let firstLine = '';
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        firstLine = trimmed.replace(/^#\s+/, '');
        rl.close();
        break;
      }
    }
    return firstLine;
  } catch {
    return '';
  }
};

export const parsePlainText = (content) => {
  if (!content) return '';
  return content.replace(/<?[^>]+(>|$)/g, '').trim();
};

export const generateSidebarLinks = async (folderName) => {
  const dirPath = path.join(config.srcFolder, 'content', folderName);
  if (!fs.existsSync(dirPath)) return '';

  const files = await fsPromises.readdir(dirPath);
  let linksHtml = '';

  for (const file of files) {
    if (file.toLowerCase().startsWith('index.')) continue;

    const ext = path.extname(file).toLowerCase();
    if (!['.md', '.txt', '.rtf', '.docx'].includes(ext)) continue;

    const slug = path.basename(file, ext).toLowerCase();
    let title = '';
    const filePath = path.join(dirPath, file);

    if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
      title = await getFirstLineOfFile(filePath);
    }
    // 🔥 ИСПРАВЛЕНО: Парсим первую строчку из Word для генерации ссылки в сайдбаре
    else if (ext === '.docx') {
      try {
        const docBuffer = await fsPromises.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: docBuffer });
        const textValue = result.value || '';

        // 🔥 Строки отладки [DEBUG] удалены, чтобы не засорять терминал
        const firstLine = textValue
          .split(/\r?\n/)
          .find((line) => line.trim() !== '');

        if (firstLine) title = firstLine.trim();
      } catch (err) {
        console.log(`⚠️ Ошибка чтения заголовка DOCX ${file}:`, err);
      }
    }

    if (!title) {
      title = slug.replace(/-/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // 🔥 Оставляем ваш оригинальный HTML-шаблон ссылки со Страницы 2 без изменений
    linksHtml += `  <li class="blog-sidebar__item"><a href="${slug}.html" class="blog-sidebar__link">${title}</a></li>\n`;
  }
  return linksHtml;
};

// 🔥 Исправлено: Корректное регулярное выражение [\s\S]*? и замена на HTML-мнемоники &lt; и &gt;
const escapeCodeBlocks = (html) => {
  if (!html) return '';
  return html
    .replace(
      /(<pre[^>]*>)([\s\S]*?)(<\/pre>)/gi,
      (match, preOpen, codeContent, preClose) => {
        const escaped = codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `${preOpen}${escaped}${preClose}`;
      },
    )
    .replace(
      /(<code[^>]*>)([\s\S]*?)(<\/code>)/gi,
      (match, codeOpen, codeContent, codeClose) => {
        const escaped = codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `${codeOpen}${escaped}${codeClose}`;
      },
    );
};

export const processHtmlContent = (html, pathPrefix) => {
  if (!html) return '';
  let processedHtml = html
    .replace(/src="\.\//gi, `src="${pathPrefix}images/`)
    .replace(/src="images\//gi, `src="${pathPrefix}images/`);
  processedHtml = escapeCodeBlocks(processedHtml);
  return processedHtml;
};

export const compileContentStream = () => {
  return new Transform({
    objectMode: true,
    async transform(file, encoding, callback) {
      if (file.isBuffer()) {
        const ext = path.extname(file.path).toLowerCase();
        if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
          try {
            const stream = markdown();

            // 🔥 Исправлено: Перехватываем ошибки самого компилятора, чтобы не вешать watcher Gulp
            stream.on('error', (err) => {
              console.error(
                `[Markdown Сritical Error] ${file.relative}:`,
                err.message,
              );
              callback(null, file);
            });

            stream.on('data', (updatedFile) => {
              file.contents = updatedFile.contents;
              file.path = file.path.replace(/\.(md|txt|rtf)/i, '.html');
            });
            stream.on('end', () => {
              callback(null, file);
            });
            stream.write(file);
            stream.end();
          } catch (err) {
            console.error(
              `Ошибка обработки Markdown для ${file.relative}:`,
              err,
            );
            callback(null, file);
          }
        } else {
          callback(null, file);
        }
      } else {
        callback(null, file);
      }
    },
  });
};

export const wrapInMasterLayout = async (tempDestPath, rawFolderName) => {
  const folderName = rawFolderName.toLowerCase();

  // 🔥 ОПТИМИЗАЦИЯ №1: Генерируем сайдбар и ссылки строго ОДИН РАЗ до начала цикла по файлам
  const sidebarLinks = await generateSidebarLinks(folderName);

  const sidebarComponentPath = path.join(
    config.srcFolder,
    'components',
    'blog-sidebar',
    'blog-sidebar.html',
  );
  let sidebarHtml = '';
  if (fs.existsSync(sidebarComponentPath)) {
    const rawSidebar = await fsPromises.readFile(sidebarComponentPath, 'utf-8');
    sidebarHtml = rawSidebar.replace('@@links', sidebarLinks);
  }

  const articleComponentPath = path.join(
    config.srcFolder,
    'components',
    'blog-article',
    'blog-article.html',
  );
  if (!fs.existsSync(articleComponentPath)) return;
  const articleTemplate = await fsPromises.readFile(
    articleComponentPath,
    'utf-8',
  );

  const faviconLinksPath = path.join(
    config.srcFolder,
    'parts',
    'favicon-links.html',
  );
  let faviconLinksHtml = '';
  if (fs.existsSync(faviconLinksPath)) {
    faviconLinksHtml = await fsPromises.readFile(faviconLinksPath, 'utf-8');
  }

  const headerPath = path.join(
    config.srcFolder,
    'components',
    'header',
    'header.html',
  );
  let headerHtml = '';
  if (fs.existsSync(headerPath)) {
    headerHtml = await fsPromises.readFile(headerPath, 'utf-8');
  }

  const footerPath = path.join(
    config.srcFolder,
    'components',
    'footer',
    'footer.html',
  );
  let footerHtml = '';
  if (fs.existsSync(footerPath)) {
    footerHtml = await fsPromises.readFile(footerPath, 'utf-8');
  }

  const menuPath = path.join(
    config.srcFolder,
    'components',
    'menu',
    'menu.html',
  );
  let menuHtml = '';
  if (fs.existsSync(menuPath)) {
    menuHtml = await fsPromises.readFile(menuPath, 'utf-8');
  }

  // 🔥 ОПТИМИЗАЦИЯ №2: Теперь цикл работает исключительно в памяти с готовыми шаблонами
  if (fs.existsSync(tempDestPath)) {
    const files = await fsPromises.readdir(tempDestPath);
    for (const file of files) {
      if (file.toLowerCase() === 'index.html') continue;

      const ext = path.extname(file).toLowerCase();
      const cleanFileName = path.basename(file, ext) + '.html';
      let rawHtml = '';

      // 🔥 ИСПРАВЛЕНО: Обрабатываем строго оригинальные .docx файлы контента
      if (ext === '.docx') {
        try {
          const originalDocxPath = path.join(
            config.srcFolder,
            'content',
            folderName,
            file,
          );
          if (fs.existsSync(originalDocxPath)) {
            const docBuffer = await fsPromises.readFile(originalDocxPath);

            const options = {
              styleMap: ['p:first-child => h1:fresh'],
            };

            const result = await mammoth.convertToHtml(
              { buffer: docBuffer },
              options,
            );
            rawHtml = result.value || '';
          }
        } catch (err) {
          console.error(
            `[Mammoth Error] Не удалось сконвертировать Word файл ${file}:`,
            err,
          );
          continue;
        }
      } else if (ext === '.html') {
        // 🔥 Читаем HTML-код статьи, скомпилированный из Markdown
        const fileContent = await fsPromises.readFile(
          path.join(tempDestPath, file),
          'utf-8',
        );

        // КРИТИЧЕСКАЯ ЗАЩИТА: Если файл уже содержит каркас (например, тег <body),
        // значит он был собран ранее. Пропускаем его, чтобы избежать дублирования ссылок!
        if (
          fileContent.includes('<body') ||
          fileContent.includes('blog-article')
        ) {
          continue;
        }

        rawHtml = fileContent;
      } else {
        // Любые другие файлы (.gitkeep, картинки) просто пропускаем
        continue;
      }

      const pageTitle = path.basename(file, ext).replace(/-/g, ' ');
      const capitalizedTitle =
        pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);

      let finalPageHtml = articleTemplate
        .replace('@@title', capitalizedTitle)
        // 🔥 ИСПРАВЛЕНО: Колбэк-функция защищает разметку от ложных срабатываний спецсимволов ($&) в тексте
        .replace('@@content', () => rawHtml)
        .replace('@@sidebar', sidebarHtml)
        .replace(
          /@@include\s*\(\s*["']\s*parts\/favicon-links\.html\s*["']\s*\)/gi,
          faviconLinksHtml,
        )
        .replace(
          /@@include\s*\(\s*["']\s*components\/header\/header\.html\s*["']\s*\)/gi,
          headerHtml,
        )
        .replace(
          /@@include\s*\(\s*["']\s*components\/footer\/footer\.html\s*["']\s*\)/gi,
          footerHtml,
        )
        .replace(
          /@@include\s*\(\s*["']\s*components\/menu\/menu\.html\s*["']\s*\)/gi,
          menuHtml,
        )
        .replace(/SITE_NAME/gi, config.siteName || 'Radik.Dev');

      const pathPrefix = '../';
      finalPageHtml = finalPageHtml
        .replace(
          /href=["']\s*\/?GO_HOME\s*["']/gis,
          `href="${pathPrefix}index.html"`,
        )
        .replace(
          /href=["']\s*\/?GO_PROJECTS\s*["']/gis,
          `href="${pathPrefix}index.html#projects"`,
        )
        .replace(
          /href=["']\s*\/?GO_ABOUT\s*["']/gis,
          `href="${pathPrefix}index.html#about"`,
        )
        .replace(
          /href=["']\s*\/?GO_BLOG\s*["']/gis,
          `href="${pathPrefix}blog/index.html"`,
        )
        .replace(
          /href=["']\s*\/?GO_CONTACTS?\s*["']/gis,
          `href="${pathPrefix}index.html#contacts"`,
        );

      finalPageHtml = finalPageHtml.replace(
        /(href=["']\s*)images\/favicons\//gi,
        `$1${pathPrefix}images/favicons/`,
      );

      finalPageHtml = processHtmlContent(finalPageHtml, pathPrefix);
      const finalArticlePath = path.join(tempDestPath, cleanFileName);
      await fsPromises.writeFile(finalArticlePath, finalPageHtml, 'utf-8');

      if (ext === '.docx') {
        const tempFilePath = path.join(tempDestPath, file);
        if (fs.existsSync(tempFilePath)) {
          await fsPromises.unlink(tempFilePath);
        }
      }
    }
  }
};

export default wrapInMasterLayout;
