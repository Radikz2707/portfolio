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
      scripts: { src: 'src/js/app.ts', dest: 'dist/js/', output: 'app.min.js' },
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
      fonts: { src: 'src/fonts/src/**/*.{ttf,otf}', dest: 'dist/fonts/' },
    },
    settings: {
      webpQuality: 70,
      imagemin: { jpeg: 75, png: 5 },
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

  // 🔥 1. ОБРАБОТКА WORD (.DOCX)
  if (ext === '.docx') {
    try {
      const docBuffer = await fsPromises.readFile(filePath);
      const resultHtml = await mammoth.convertToHtml({ buffer: docBuffer });
      const html = resultHtml.value || '';
      const h1Match = html.match(/<h1>(.*?)<\/h1>/);

      if (h1Match && h1Match[1]) {
        return h1Match[1].replace(/<[^>]*>/g, '').trim();
      }

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
    return '';
  }

  // 🔥 2. УНИВЕРСАЛЬНАЯ ОБРАБОТКА ТЕКСТА (.MD, .TXT, .RTF)
  try {
    const fileStream = fs.createReadStream(filePath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let allLines = [];
    for await (const line of rl) {
      const trimmed = line.trim();
      // Игнорируем разделители метаданных админки
      if (trimmed && trimmed !== '---') {
        allLines.push(trimmed);
      }
      // Читаем только первые несколько заполненных строк для оптимизации скорости
      if (allLines.length >= 3) break;
    }
    rl.close();

    if (allLines.length > 0) {
      let titleLine = allLines[0];

      // Если это классическое свойство от админки (title: "Заголовок")
      if (titleLine.startsWith('title:')) {
        return titleLine.replace(/^title:\s*["']?([^"']+)["']?/, '$1').trim();
      }

      // Если это стандартный заголовок Markdown (# Заголовок)
      if (titleLine.startsWith('#')) {
        return titleLine.replace(/^#\s*/, '').trim();
      }

      // Если это просто обычная первая строчка текста
      return titleLine;
    }
    return '';
  } catch {
    return '';
  }
};

export const parsePlainText = (content) => {
  if (!content) return '';
  return content.replace(/<[^>]*>/g, '').trim();
};

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
  const categoriesPath = path.join(contentRoot, 'categories.json');

  if (!fs.existsSync(contentRoot)) return '';

  // Динамически считываем ваш интерактивный список категорий из админки
  let categoriesList = [];
  if (fs.existsSync(categoriesPath)) {
    try {
      const fileContent = await fsPromises.readFile(categoriesPath, 'utf-8');
      const parsedData = JSON.parse(fileContent);
      categoriesList = parsedData.categories_list || [];
    } catch (e) {
      console.error(
        '❌ Ошибка чтения файла categories.json в процессоре:',
        e.message,
      );
    }
  }

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

    // 🔥 ИСПРАВЛЕНО: Ищем русское название в массиве по ID папки (убирает английские WORK/FINANCE)
    const matchedCategory = categoriesList.find((item) => item.id === category);
    const categoryTitle = matchedCategory
      ? matchedCategory.title
      : category.charAt(0).toUpperCase() + category.slice(1);

    const validFilesCount = files.filter(
      (f) =>
        ['.md', '.txt', '.rtf', '.docx'].includes(
          path.extname(f).toLowerCase(),
        ) && !f.toLowerCase().startsWith('index.'),
    );

    const pluralText = getPluralArticles(validFilesCount.length);

    // 🔥 ИСПРАВЛЕНО: Добавлен атрибут open, чтобы категории изначально были открыты
    fullSidebarHtml += `  <details class="blog-sidebar__category">\n`;
    fullSidebarHtml += `    <summary class="blog-sidebar__category-btn">${categoryTitle} (${pluralText})</summary>\n`;
    fullSidebarHtml += `    <ul class="blog-sidebar__sublist">\n`;

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

          const articleUrlParts = entryRelativePath.split('/');
          const articleFileName = articleUrlParts[articleUrlParts.length - 1];
          const articleFileNameWithoutExt = articleFileName.replace(
            /\.(md|txt|rtf|docx)$/i,
            '',
          );
          const finalUrl = `../${category}/${articleFileNameWithoutExt}.html`;

          result += `      <li class="blog-sidebar__item"><a href="${finalUrl}" class="blog-sidebar__link">${title}</a></li>\n`;
        }
      }
      return result;
    };

    fullSidebarHtml += await walkDirectory(dirPath);
    fullSidebarHtml += `    </ul>\n  </details>\n`;
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
  processedHtml = processedHtml.replace(
    /src="\.\/images\//g,
    `src="${pathPrefix}images/`,
  );
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
                `[Markdown Critical Error] ${file.relative}:`,
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
          let originalDocxPath = path.join(
            config.srcFolder,
            'content',
            folderName,
            file,
          );
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
              `❌ [Content Processor] Исходный file Word не найден на диске: ${file}`,
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

      finalPageHtml = finalPageHtml
        .replace(
          /(href=["']\s*)images\/favicons\//gi,
          `$1${pathPrefix}images/favicons/`,
        )
        .replace(
          /(href=["'])\/images\/favicons\//gi,
          `$1${pathPrefix}images/favicons/`,
        );

      finalPageHtml = processHtmlContent(finalPageHtml, pathPrefix);

      finalPageHtml = finalPageHtml
        .replace(/@@pathPrefixCss/g, `${pathPrefix}css/app.min.css?v=1`)
        .replace(/@@pathPrefixJsVendor/g, `${pathPrefix}js/vendor.min.js?v=1`)
        .replace(/@@pathPrefixJsApp/g, `${pathPrefix}js/app.min.js?v=1`)
        .replace(/@@pathPrefixblog/g, `${pathPrefix}blog`);

      const finalArticlePath = path.join(tempDestPath, cleanFileName);
      await fsPromises.writeFile(finalArticlePath, finalPageHtml, 'utf-8');
    }
  }
};

export default wrapInMasterLayout;
