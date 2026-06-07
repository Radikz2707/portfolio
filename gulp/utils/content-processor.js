import fs from "fs";
import path from "path";
import { config } from "../../gulp.config.js";
import mammoth from "mammoth";

// Импортируем зависимости для обработки файловых стримов Gulp
import gulp from "gulp";
import through2 from "through2";
import markdown from "gulp-markdown";

const { src } = gulp;

/**
 * 1. АВТО-ГЕНЕРАТОР ССЫЛОК ДЛЯ САЙДБАРА
 * Сканирует файлы контента и собирает чистый HTML без дубликатов.
 */
export const generateSidebarLinks = async (folderName) => {
  const dirPath = path.join(config.srcFolder, "content", folderName);
  if (!fs.existsSync(dirPath)) return "";

  const files = fs.readdirSync(dirPath);
  let linksHtml = "";
  const repo = config.repoName ? `/${config.repoName}` : "";

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".md", ".txt", ".rtf", ".docx"].includes(ext)) continue;

    const slug = path.basename(file, ext);
    let title = slug;
    const filePath = path.join(dirPath, file);

    // Сценарий А: Вытаскиваем заголовок из текстовых файлов (.md, .txt, .rtf)
    if (ext === ".md" || ext === ".txt" || ext === ".rtf") {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/^#\s+(.+)$/m);
      if (match && match[1]) title = match[1].trim();
    }

    // Сценарий Б: Вытаскиваем красивый заголовок прямо из файла Word (.docx)
    if (ext === ".docx") {
      try {
        const docBuffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer: docBuffer });
        const textValue = result.value || "";
        const firstLine = textValue
          .split(/\r?\n/)
          .find((line) => line.trim() !== "");
        if (firstLine) {
          title = firstLine.trim();
        }
      } catch (err) {
        console.log(
          `⚠️ Не удалось прочитать заголовок из Word файла ${file}:`,
          err,
        );
      }
    }

    // Если красивый заголовок не нашли, форматируем имя файла (slug)
    if (title === slug) {
      title = title.replace(/-/g, " ");
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    linksHtml += `    <li class="blog-sidebar__item"><a href="${repo}/${folderName}/${slug}.html" class="blog-sidebar__link">${title}</a></li>\n`;
  }
  return linksHtml;
};

/**
 * 2. ХЕЛПЕР КОРРЕКЦИИ ПУТЕЙ НАВИГАЦИИ И АВТО-ЗАГОЛОВКОВ
 * Исправляет ссылки возврата на главную страницу для GitHub Pages и
 * принудительно превращает жирные строки из Word в теги H1/H2, игнорируя мусорные атрибуты.
 */
export const processHtmlContent = (html, folderName) => {
  const repo = config.repoName ? `/${config.repoName}` : "";

  // Бронебойно вырезаем ЛЮБЫЕ застрявшие @@include из тела статьи
  html = html.replace(/@@include\(['"][\s\S]*?['"]\)/g, "");

  // Абсолютные пути навигации для корректной работы скролла из любой папки
  html = html.replace(/href="(?:\.\/)?#projects"/g, `href="${repo}/#projects"`);
  html = html.replace(/href="(?:\.\/)?#about"/g, `href="${repo}/#about"`);
  html = html.replace(/href="(?:\.\/)?#?"/g, `href="${repo}/"`);

  const blogLinkRegex = new RegExp(
    `href="(?:\\.\\/)?${folderName}\\/([^"]+)\\.html"`,
    "g",
  );
  html = html.replace(blogLinkRegex, 'href="$1.html"');

  // БРОНЕБОЙНОЕ РЕШЕНИЕ ДЛЯ WORD С ИГНОРИРОВАНИЕМ МУСОРА:
  html = html.replace(
    /<p[^>]*?>\s*<strong[^>]*?>([\s\S]*?)<\/strong>\s*<\/p>/i,
    '<h1 class="blog-article__title">$1</h1>',
  );
  html = html.replace(
    /<p[^>]*?>\s*<strong[^>]*?>([\s\S]*?)<\/strong>\s*<\/p>/gi,
    '<h2 class="blog-article__subtitle">$1</h2>',
  );

  return html;
};

/**
 * 3. ПАРСЕР ПЛОСКОГО ТЕКСТА (.TXT / .RTF)
 * Превращает обычные переносы строк Блокнота в валидные HTML-абзацы <p>.
 */
export const parsePlainText = (text, ext) => {
  if (ext === ".rtf" && text.startsWith("{\\rtf")) {
    text = text
      .replace(/\{\\[^}]+\}/g, "")
      .replace(/\\[a-z0-9]+/g, "")
      .trim();
  }

  return text
    .split(/\r?\n\r?\n/)
    .map((paragraph) =>
      paragraph.trim()
        ? `<p>${paragraph.trim().replace(/\r?\n/g, "<br>")}</p>`
        : "",
    )
    .join("\n");
};

/**
 * 4. ХЕЛПЕР ЭТАПА 1
 * Конвертирует Markdown, Word, TXT и RTF в сырой стрим HTML-буферов
 */
export const compileContentStream = () => {
  return through2.obj(function (file, enc, cb) {
    if (file.isBuffer()) {
      const ext = file.extname.toLowerCase();

      if (ext === ".docx") {
        mammoth
          .convertToHtml({ path: file.path })
          .then((result) => {
            file.contents = Buffer.from(result.value);
            file.extname = ".html";
            cb(null, file);
          })
          .catch((err) => cb(err));
      } else if (ext === ".txt" || ext === ".rtf") {
        const text = file.contents.toString("utf-8");
        file.contents = Buffer.from(parsePlainText(text, ext));
        file.extname = ".html";
        cb(null, file);
      } else {
        const mdStream = markdown();
        mdStream.on("data", (patchedFile) => {
          patchedFile.extname = ".html";
          cb(null, patchedFile);
        });
        mdStream.write(file);
      }
    } else {
      cb(null, file);
    }
  });
};

/**
 * 5. ХЕЛПЕР ЭТАПА 2
 * Оборачивает готовый HTML в мастер-шаблон, вставляет сайдбар и фавиконки
 */
export const wrapInMasterLayout = async (tempDestPath, folderName) => {
  const layoutPath = path.resolve(
    config.srcFolder,
    "components",
    "blog-article",
    "blog-article.html",
  );
  const sidebarPath = path.resolve(
    config.srcFolder,
    "components",
    "blog-sidebar",
    "blog-sidebar.html",
  );
  const faviconPath = path.resolve(
    config.srcFolder,
    "parts",
    "favicon-links.html",
  );

  if (!fs.existsSync(tempDestPath)) return;
  const compiledFiles = fs
    .readdirSync(tempDestPath)
    .filter((f) => f.endsWith(".html"));
  if (compiledFiles.length === 0) return;

  const dynamicLinks = await generateSidebarLinks(folderName);
  const masterLayoutHtml = fs.readFileSync(layoutPath, "utf-8");
  const masterSidebarHtml = fs.existsSync(sidebarPath)
    ? fs.readFileSync(sidebarPath, "utf-8")
    : "@@links";
  const faviconHtml = fs.existsSync(faviconPath)
    ? fs.readFileSync(faviconPath, "utf-8")
    : "";

  for (const htmlFile of compiledFiles) {
    const fullArticlePath = path.join(tempDestPath, htmlFile);
    const articleContent = fs.readFileSync(fullArticlePath, "utf-8");

    let finalHtml = masterLayoutHtml
      .replace("@@include('@@articleFile')", articleContent)
      .replace("@@include('../../parts/favicon-links.html')", faviconHtml)
      .replace(
        "@@include('../../components/blog-sidebar/blog-sidebar.html')",
        masterSidebarHtml.replace("@@links", dynamicLinks),
      );

    finalHtml = processHtmlContent(finalHtml, folderName);
    fs.writeFileSync(fullArticlePath, finalHtml, "utf-8");
  }
};
