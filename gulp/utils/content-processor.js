import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { config } from '../../gulp.config.js';
import mammoth from 'mammoth';
import gulp from 'gulp';
import markdown from 'gulp-markdown';
import { Transform } from 'stream'; // Нативная замена through2 для Gulp 5

const { src } = gulp;

// Асинхронное чтение первой строчки файла (без блокировки потока)
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
  return content.replace(/<\/?[^>]+(>|$)/g, '').trim();
};

// =========================================================================
// 📑 1. АСИНХРОННАЯ ГЕНЕРАЦИЯ ССЫЛОК САЙДБАРА (БЕЗ БЛОКИРОВКИ EVENT LOOP)
// =========================================================================
export const generateSidebarLinks = async (folderName) => {
  const dirPath = path.join(config.srcFolder, 'content', folderName);
  if (!fs.existsSync(dirPath)) return '';

  // Переходим на полностью асинхронное чтение директории
  const files = await fsPromises.readdir(dirPath);
  let linksHtml = '';

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.md', '.txt', '.rtf', '.docx'].includes(ext)) continue;

    const slug = path.basename(file, ext).toLowerCase();
    let title = '';
    const filePath = path.join(dirPath, file);

    if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
      title = await getFirstLineOfFile(filePath);
    } else if (ext === '.docx') {
      try {
        const docBuffer = await fsPromises.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: docBuffer });
        const textValue = result.value || '';
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

    linksHtml += `  <li class="blog-sidebar__item"><a href="${slug}.html" class="blog-sidebar__link">${title}</a></li>\n`;
  }
  return linksHtml;
};

export const processHtmlContent = (html, pathPrefix) => {
  return html
    .replace(/src="\.?\/images\//gi, `src="${pathPrefix}images/`)
    .replace(/src="images\//gi, `src="${pathPrefix}images/`);
};

// =========================================================================
// 🗜️ 2. ИСПРАВЛЕННЫЙ КОМПИЛЯТОР КОНТЕНТА (NATIVE GULP 5 TRANSFORM)
// =========================================================================
export const compileContentStream = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        const ext = path.extname(file.path).toLowerCase();

        // Через маркдаун пускаем ТОЛЬКО текстовые исходники
        if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
          const stream = markdown();
          stream.on('data', (updatedFile) => {
            file.contents = updatedFile.contents;
            file.path = file.path.replace(/\.(md|txt|rtf)$/i, '.html');
          });
          stream.write(file);
          stream.end();
        }
        // Если .docx — оставляем бинарник нетронутым, его обработает следующий этап
      }
      callback(null, file);
    },
  });
};

// =========================================================================
// 🎨 3. ОБЕРТКА СТАТЕЙ В ШАБЛОН (БЕЗОПАСНАЯ АСИНХРОННАЯ ЗАПИСЬ НА ДИСК)
// =========================================================================
export const wrapInMasterLayout = async (tempDestPath, rawFolderName) => {
  const folderName = rawFolderName.toLowerCase();
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

  if (fs.existsSync(tempDestPath)) {
    const files = await fsPromises.readdir(tempDestPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (file.toLowerCase() === 'index.html') continue;

      const filePath = path.join(tempDestPath, file);
      const cleanFileName = file.toLowerCase().replace('.docx', '.html');
      let rawHtml = '';

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
            const result = await mammoth.convertToHtml({ buffer: docBuffer });
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
        rawHtml = await fsPromises.readFile(filePath, 'utf-8');
      } else {
        continue;
      }

      const pageTitle = cleanFileName.replace('.html', '').replace(/-/g, ' ');
      const capitalizedTitle =
        pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);

      let finalPageHtml = articleTemplate
        .replace('@@title', capitalizedTitle)
        .replace('@@content', rawHtml)
        .replace('@@sidebar', sidebarHtml)
        .replace(
          '@@include("../../parts/favicon-links.html")',
          faviconLinksHtml,
        );

      finalPageHtml = processHtmlContent(finalPageHtml, '../');

      const finalArticlePath = path.join(tempDestPath, cleanFileName);

      // Асинхронная запись гарантирует, что Node.js не заблокирует другие таски Gulp 5
      await fsPromises.writeFile(finalArticlePath, finalPageHtml, 'utf-8');

      if (ext === '.docx' || file !== cleanFileName) {
        await fsPromises.unlink(filePath);
      }
    }
  }
};
