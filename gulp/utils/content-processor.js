import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import readline from 'readline';
import mammoth from 'mammoth';
import gulp from 'gulp';
import markdown from 'gulp-markdown';
import { Transform } from 'stream';

// Получение config для тестов и production
const getConfig = async () => {
  try {
    // Проверяем, что мы не в тестовой среде JSDOM
    if (
      typeof process !== 'undefined' &&
      process.versions &&
      process.versions.node
    ) {
      const configPath = path.resolve(process.cwd(), 'gulp.config.js');
      const configModule = await import(configPath);
      return configModule.config;
    }
  } catch {
    // Fallback для тестов
  }
  return {
    srcFolder: 'src',
    siteName: 'Radik.Dev',
    repoPath: 'Radik/portfolio',
    structure: {
      components: 'src/components',
      modules: 'src/js/modules',
      plugins: 'src/js/plugins',
    },
    aliasPath: 'src/js',
    paths: {
      styles: {
        src: 'src/scss/style.scss',
        dest: 'dist/css/',
        output: 'app.min.css',
      },
      scripts: {
        src: 'src/js/app.ts',
        dest: 'dist/js/',
        output: 'app.min.js',
      },
      images: {
        src: 'src/images/**/*',
        dest: 'dist/images/',
        svg: 'src/images/**/*.svg',
      },
      favicons: {
        src: 'src/images/src/favicon.png',
        dest: 'dist/images/favicons/',
        htmlOutput: 'src/parts/favicon-links.html',
      },
      fonts: {
        src: 'src/fonts/src/**/*.{ttf,otf}',
        dest: 'dist/fonts/',
      },
    },
    settings: {
      webpQuality: 70,
      imagemin: {
        jpeg: 75,
        png: 5,
      },
      autoprefixer: ['> 0.5%', 'last 2 versions', 'not dead'],
    },
  };
};

const config = await getConfig();

const { src } = gulp;

const categoryNames = {
  programming: 'Программирование',
  'project-info': 'О проекте',
  space: 'Космос',
  poems: 'Мои стихи',
  books: 'Книги',
  travel: 'Путешествия',
  games: 'Игры и развлечения',
  psychology: 'Психология',
  blog: 'Общий блог',
};

export const getFirstLineOfFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  // 📁 Сценарий для файлов Microsoft Word
  if (ext === '.docx') {
    try {
      const docBuffer = await fsPromises.readFile(filePath);

      // Шаг 1: Пробуем найти заголовок h1 через конвертацию в HTML
      const resultHtml = await mammoth.convertToHtml({ buffer: docBuffer });
      const html = resultHtml.value || '';
      const h1Match = html.match(/<h1>(.*?)<\/h1>/);

      if (h1Match && h1Match[1]) {
        return h1Match[1].replace(/<[^>]*>/g, '').trim();
      }

      // Шаг 2: Если h1 нет, вытаскиваем сырой текст и берем первую непустую строку
      const resText = await mammoth.extractRawText({ buffer: docBuffer });
      const textValue = resText.value || '';
      const firstLine = textValue
        .split(/\r?\n/)
        .find((line) => line.trim() !== '');

      if (firstLine) return firstLine.trim();
    } catch (err) {
      console.log(
        `⚠️ Ошибка чтения заголовка DOCX через процессор для ${path.basename(filePath)}:`,
        err,
      );
    }
    // Если файл Word пустой или поврежден, возвращаем пустую строку
    return '';
  }

  // 📝 Сценарий для текстовых файлов (ваш оригинальный рабочий код один в один)
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
  return content.replace(/<[^>]*>/g, '').trim();
};

// 🔥 ФУНКЦИЯ СКЛОНЕНИЯ ЧИСЛИТЕЛЬНЫХ (РУССКИЙ ЯЗЫК)
const getPluralArticles = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) return `${count} статей`;
  if (mod10 === 1) return `${count} статья`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} статьи`;
  return `${count} статей`;
};

export const generateSidebarLinks = async (currentFolderName) => {
  const contentRoot = path.join(config.srcFolder, 'content');
  if (!fs.existsSync(contentRoot)) return '';

  const categories = fs
    .readdirSync(contentRoot)
    .filter((f) => fs.statSync(path.join(contentRoot, f)).isDirectory());

  let fullSidebarHtml = '';

  for (const category of categories) {
    const dirPath = path.join(contentRoot, category);
    const files = await fsPromises.readdir(dirPath);

    const hasFiles = files.some(
      (f) =>
        ['.md', '.txt', '.rtf', '.docx'].includes(
          path.extname(f).toLowerCase(),
        ) && !f.toLowerCase().startsWith('index.'),
    );
    if (!hasFiles) continue;

    const categoryTitle =
      categoryNames[category] ||
      category.charAt(0).toUpperCase() + category.slice(1);

    // 🔥 СТАЛО (Автоматический точный счётчик с правильным окончанием):
    const validFilesCount = files.filter(
      (f) =>
        ['.md', '.txt', '.rtf', '.docx'].includes(
          path.extname(f).toLowerCase(),
        ) && !f.toLowerCase().startsWith('index.'),
    ).length;

    const pluralText = getPluralArticles(validFilesCount);

    fullSidebarHtml += `<li class='blog-sidebar__category'>
 <button class='blog-sidebar__category-btn' aria-expanded='false'>
   ${categoryTitle} <span class='blog-sidebar__count'>(${pluralText})</span>
 </button>
 <ul class='blog-sidebar__sublist'>`;

    const walkDirectory = async (currentDir, relativePath = '') => {
      let result = '';
      const entries = await fsPromises.readdir(currentDir, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const entryRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          result += await walkDirectory(fullPath, entryRelativePath);
        } else if (entry.isFile()) {
          if (
            entry.name.toLowerCase().startsWith('index.') ||
            entry.name.startsWith('~$')
          )
            continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (!['.md', '.txt', '.rtf', '.docx'].includes(ext)) continue;

          const slug = path.basename(entry.name, ext).toLowerCase();
          let title = '';

          if (ext === '.md' || ext === '.txt' || ext === '.rtf') {
            title = await getFirstLineOfFile(fullPath);
          } else if (ext === '.docx') {
            try {
              const docBuffer = await fsPromises.readFile(fullPath);
              const res = await mammoth.extractRawText({ buffer: docBuffer });
              const textValue = res.value || '';
              const firstLine = textValue
                .split(/\r?\n/)
                .find((line) => line.trim() !== '');
              if (firstLine) title = firstLine.trim();
            } catch (err) {
              console.log(
                `⚠️ Ошибка чтения заголовка DOCX ${entry.name}:`,
                err,
              );
            }
          }

          if (!title) {
            title = slug.replace(/-/g, ' ');
            title = title.charAt(0).toUpperCase() + title.slice(1);
          }

          const articleUrl = entryRelativePath
            .replace(/\\/g, '/')
            .replace(/\.(md|txt|rtf|docx)$/i, '.html');
          const finalUrl = `./${articleUrl}`;

          result += ` <li class='blog-sidebar__item'><a href='${finalUrl}' class='blog-sidebar__link'>${title}</a></li>\n`;
        }
      }
      return result;
    };

    fullSidebarHtml += await walkDirectory(dirPath);
    fullSidebarHtml += `</ul></li>\n`;
  }

  return fullSidebarHtml;
};

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
  let processedHtml = html;

  // Замена src=".\/images/ на src="pathPrefiximages/
  processedHtml = processedHtml.replace(/src="\.\//g, `src="${pathPrefix}`);

  // Замена src="images/ на src="pathPrefiximages/
  processedHtml = processedHtml.replace(
    /src="images\//g,
    `src="${pathPrefix}images/`,
  );

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

  if (fs.existsSync(tempDestPath)) {
    const files = await fsPromises.readdir(tempDestPath);
    for (const file of files) {
      if (file.toLowerCase() === 'index.html' || file.startsWith('~$'))
        continue;
      const ext = path.extname(file).toLowerCase();
      const cleanFileName = path.basename(file, ext) + '.html';
      let rawHtml = '';

      if (ext === '.docx') {
        try {
          // 🎯 План А: Пробуем найти файл по стандартному переданному пути
          let originalDocxPath = path.join(
            config.srcFolder,
            'content',
            folderName,
            file,
          );

          // 🎯 План Б (Максимальный контроль): Если папка не совпала по регистру,
          // динамически ищем, в какой именно подпапке content лежит этот .docx файл
          if (!fs.existsSync(originalDocxPath)) {
            const contentRoot = path.join(config.srcFolder, 'content');
            const searchSubfolders = fs
              .readdirSync(contentRoot)
              .filter((f) =>
                fs.statSync(path.join(contentRoot, f)).isDirectory(),
              );

            for (const sub of searchSubfolders) {
              const checkPath = path.join(contentRoot, sub, file);
              if (fs.existsSync(checkPath)) {
                originalDocxPath = checkPath;
                break;
              }
            }
          }

          // Если файл успешно локализован на диске — компилируем через Mammoth
          if (fs.existsSync(originalDocxPath)) {
            const docBuffer = await fsPromises.readFile(originalDocxPath);
            const options = { styleMap: ['p:first-child => h1:fresh'] };
            const result = await mammoth.convertToHtml(
              { buffer: docBuffer },
              options,
            );
            rawHtml = result.value || '';
          } else {
            console.error(
              `❌ [Content Processor] Исходный файл Word не найден на диске: ${file}`,
            );
            continue;
          }
        } catch (err) {
          console.error(
            `[Mammoth Error] Не удалось сконвертировать Word файл ${file}:`,
            err,
          );
          continue;
        }
      } else if (ext === '.html') {
        const fileContent = await fsPromises.readFile(
          path.join(tempDestPath, file),
          'utf-8',
        );
        if (
          fileContent.includes('<body') ||
          fileContent.includes('blog-article')
        )
          continue;
        rawHtml = fileContent;
      } else {
        continue;
      }

      // Ниже идёт ваш оригинальный код формирования finalPageHtml и записи файла без изменений...
      const pageTitle = path.basename(file, ext).replace(/-/g, ' ');
      const capitalizedTitle =
        pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);

      let finalPageHtml = articleTemplate
        .replace('@@title', capitalizedTitle)
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

      const rootBuildDir = config.buildFolder || 'dist';
      const relativePath = path.relative(tempDestPath, rootBuildDir);

      let pathPrefix = relativePath
        ? relativePath.replace(/\\/g, '/') + '/'
        : './';

      if (pathPrefix === '/') {
        pathPrefix = './';
      }

      // Дополнительная страховка: если путь пустой или точка, а мы точно знаем,
      // что папка вложенная (содержит /blog/), принудительно ставим два шага назад
      if (
        (pathPrefix === './' || pathPrefix === '') &&
        tempDestPath.replace(/\\/g, '/').includes('/blog/')
      ) {
        pathPrefix = '../../';
      }

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
        // if (fs.existsSync(tempFilePath)) await fsPromises.unlink(tempFilePath);
      }
    }
  }
};

export default wrapInMasterLayout;
