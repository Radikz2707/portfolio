import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { config } from '../../gulp.config.js';
import mammoth from 'mammoth';

import gulp from 'gulp';
import markdown from 'gulp-markdown';
import through2 from 'through2'; // Используем уже имеющийся в проекте through2

const { src } = gulp;

const getFirstLineOfFile = (filePath) => {
  return new Promise((resolve) => {
    const fileStream = fs.createReadStream(filePath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let firstLine = '';
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        firstLine = trimmed.replace(/^#\s+/, '');
        rl.close();
      }
    });

    rl.on('close', () => {
      resolve(firstLine);
    });
  });
};

export const parsePlainText = (content) => {
  if (!content) return '';
  return content.replace(/<\/?[^>]+(>|$)/g, '').trim();
};

export const generateSidebarLinks = async (folderName) => {
  const dirPath = path.join(config.srcFolder, 'content', folderName);
  if (!fs.existsSync(dirPath)) return '';

  const files = fs.readdirSync(dirPath);
  let linksHtml = '';
  const isProdBuild = process.argv.includes('build');
  const repo =
    isProdBuild && config.repoName
      ? `/${config.repoName.replace(/^\/|\/$/g, '')}`
      : '';

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.md', '.txt', '.rtf', '.docx'].includes(ext)) continue;

    const slug = path.basename(file, ext).toLowerCase();
    let title = '';
    const filePath = path.join(dirPath, file);

    if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
      title = await getFirstLineOfFile(filePath);
    }

    if (ext === '.docx') {
      try {
        const docBuffer = fs.readFileSync(filePath);
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

    linksHtml += `  <li class="blog-sidebar__item"><a href="${slug}.html" class="blog-sidebar__link">${title}</a></li>
`;
  }
  return linksHtml;
};

export const processHtmlContent = (html, pathPrefix) => {
  let updatedHtml = html;
  updatedHtml = updatedHtml.replace(
    /src="\.?\/images\//gi,
    `src="${pathPrefix}images/`,
  );
  updatedHtml = updatedHtml.replace(
    /src="images\//gi,
    `src="${pathPrefix}images/`,
  );
  return updatedHtml;
};

/**
 * 3. 🔥 ИСПРАВЛЕННЫЙ КОМПИЛЯТОР: Защищает файлы Word от повреждения плагином gulp-markdown!
 */
export const compileContentStream = () => {
  return through2.obj(function (file, encoding, callback) {
    if (file.isBuffer()) {
      const ext = path.extname(file.path).toLowerCase();

      // Через markdown() пускаем ТОЛЬКО текстовые файлы статей
      if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
        const stream = markdown();
        stream.on('data', (updatedFile) => {
          file.contents = updatedFile.contents;
          file.path = file.path.replace(/\.(md|txt|rtf)$/i, '.html');
        });
        stream.write(file);
        stream.end();
      }
      // Если это файл .docx — through2 оставляет его бинарник нетронутым и передает дальше!
    }
    callback(null, file);
  });
};

/**
 * 4. ОБЕРТКА СЫРЫХ HTML В ВАШ КОМПОНЕНТ СТАТЬИ
 */
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
    sidebarHtml = fs
      .readFileSync(sidebarComponentPath, 'utf-8')
      .replace('@@links', sidebarLinks);
  }

  const articleComponentPath = path.join(
    config.srcFolder,
    'components',
    'blog-article',
    'blog-article.html',
  );
  if (!fs.existsSync(articleComponentPath)) return;
  const articleTemplate = fs.readFileSync(articleComponentPath, 'utf-8');

  // 🔥 ИСПРАВЛЕНО: Читаем содержимое favicon-links.html и вставляем его в статьи блога
  const faviconLinksPath = path.join(
    config.srcFolder,
    'parts',
    'favicon-links.html',
  );
  let faviconLinksHtml = '';
  if (fs.existsSync(faviconLinksPath)) {
    faviconLinksHtml = fs.readFileSync(faviconLinksPath, 'utf-8');
  }

  if (fs.existsSync(tempDestPath)) {
    const files = fs.readdirSync(tempDestPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (file.toLowerCase() === 'index.html') continue;

      const filePath = path.join(tempDestPath, file);
      const cleanFileName = file.toLowerCase().replace('.docx', '.html');

      let rawHtml = '';

      // Если это Word файл, mammoth нативно считывает его чистый буфер без иероглифов!
      if (ext === '.docx') {
        try {
          const originalDocxPath = path.join(
            config.srcFolder,
            'content',
            folderName,
            file,
          );
          if (fs.existsSync(originalDocxPath)) {
            const docBuffer = fs.readFileSync(originalDocxPath);
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
        rawHtml = fs.readFileSync(filePath, 'utf-8');
      } else {
        continue;
      }

      const pageTitle = cleanFileName.replace('.html', '').replace(/-/g, ' ');
      const capitalizedTitle =
        pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);

      let finalPageHtml = articleTemplate
        .replace('@@title', capitalizedTitle)
        .replace('@@content', rawHtml)
        .replace('@@sidebar', sidebarHtml);

      // 🔥 ИСПРАВЛЕНО: Вставляем favicon-links.html вместо @@include
      finalPageHtml = finalPageHtml.replace(
        '@@include("../../parts/favicon-links.html")',
        faviconLinksHtml,
      );

      finalPageHtml = processHtmlContent(finalPageHtml, '../');

      const finalArticlePath = path.join(tempDestPath, cleanFileName);
      fs.writeFileSync(finalArticlePath, finalPageHtml, 'utf-8');

      if (ext === '.docx' || file !== cleanFileName) {
        fs.unlinkSync(filePath);
      }
    }
  }
};
