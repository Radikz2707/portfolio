import { config } from "../gulp.config.js";
import gulp from "gulp";
import plumber from "gulp-plumber";
import fileInclude from "gulp-file-include";
import htmlhint from "gulp-htmlhint";
import htmlBeautify from "gulp-html-beautify";
import { Transform } from "stream";

import { onError, isProd, bs } from "./server.js";

const { src, dest } = gulp;

// Очистка путей для ресурсов и динамическая автоматизация навигации для GitHub Pages
const fixRelativePaths = () => {
  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      if (file.isBuffer()) {
        let html = file.contents.toString();

        // 1. Чистая автозамена путей для подключаемых файлов ресурсов (БЕЗ меток версий)
        html = html.replace(/(href|src)="\.?\/css\//g, '$1="css/');
        html = html.replace(/(href|src)="\.?\/js\//g, '$1="js/');
        html = html.replace(/(href|src)="\.?\/images\//g, '$1="images/');

        // 2. ДИНАМИЧЕСКАЯ АВТОМАТИЗАЦИЯ НАВИГАЦИИ (Имя репозитория подставляется автоматически)
        const repo = config.repoName ? `/${config.repoName}` : "";
        html = html.replace('href="./#projects"', `href="${repo}/#projects"`);
        html = html.replace('href="./#about"', `href="${repo}/#about"`);
        html = html.replace('href="./"', `href="${repo}/"`);

        // УНИВЕРСАЛЬНОЕ ИСПРАВЛЕНИЕ ДЛЯ БЛОГА:
        // Гарантированно превращает любые ссылки на блог в правильный путь /portfolio/blog/...
        html = html.replace(
          /href="(?:\.\/)?blog\/([^"]+)\.html"/g,
          `href="${repo}/blog/$1.html"`,
        );

        file.contents = Buffer.from(html);
      }
      callback(null, file);
    },
  });
};

// Generator of tags strictly with WebP
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
              allAttributes.includes("data-ignore") ||
              allAttributes.includes("img-ignore")
            ) {
              return match;
            }

            const webpPath = srcPath.replace(/\.(?:png|jpg|jpeg)$/i, ".webp");
            const cleanAttributes = `${before.trim()} ${after.trim()}`.trim();
            const imgAttributes = cleanAttributes ? ` ${cleanAttributes}` : "";

            return `<picture>
  <source srcset="${webpPath}" type="image/webp">
  <img src="${srcPath}"${imgAttributes}>
</picture>`;
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
      `${config.srcFolder}/**/*.html`,
      `!${config.srcFolder}/components/**/*.html`,
      `!${config.srcFolder}/parts/**/*.html`,
    ]),
    plumber({ errorHandler: onError }),
    // 🔥 ИСПРАВЛЕНО: Возвращаем родной относительный поиск для вашей текущей верстки
    fileInclude({ prefix: "@@", basepath: "@file" }),
  ];

  if (isProd) {
    pipeline.push(fixPictureTags());
    pipeline.push(fixRelativePaths()); // Исправляет пути и ссылки навигации при продакшн сборке
  }

  pipeline.push(
    htmlBeautify({
      indent_size: 2,
      indent_char: " ",
      eol: "\n",
      preserve_newlines: true,
      max_preserve_newlines: 1,
      indent_inner_html: true,
      extra_liners: [],
    }),
  );

  pipeline.push(
    htmlhint({
      "doctype-first": false,
      "tagname-lowercase": true,
      "attr-lowercase": true,
      "attr-value-double-quotes": true,
      "attr-no-duplication": true,
      "id-unique": true,
      "src-not-empty": true,
      "alt-require": true,
      "img-alt-require": true,
      "tag-pair": true,
      "spec-char-escape": true,
    }),
    htmlhint.reporter("htmlhint-stylish", { failReporter: false }),
  );

  pipeline.push(dest(config.buildFolder));

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on("end", bs.reload);
}
