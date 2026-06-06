import { config } from "./gulp.config.js";
import gulp from "gulp";
import fs from "fs";
import path from "path";
import plumber from "gulp-plumber";
import fileInclude from "gulp-file-include";
import htmlhint from "gulp-htmlhint";
import htmlBeautify from "gulp-html-beautify";
import markdown from "gulp-markdown";
import rename from "gulp-rename";

// Импорты фиксированной инфраструктуры
import { browsersync, startwatch, onError, isProd, bs } from "./gulp/server.js";
import { lintCss, lintJs } from "./gulp/lint.js";
import { cleandist, buildcopy, zipFiles } from "./gulp/utils.js";
import { create } from "./gulp.create.js";
import { createModule as module } from "./gulp.module.js";
import { remove } from "./gulp.remove.js";
import { createStructure as init } from "./gulp.init.js";
import { help } from "./gulp.help.js";

const { parallel, series, src, dest } = gulp;

// 1. АВТО-ИМПОРТ СТАНДАРТНЫХ ТАСКОВ ИЗ ПАПКИ GULP/ (ИСПРАВЛЕНО НА СИНТАКСИС FOR...OF)
const tasks = {};
export const dynamicTaskNames = [];
const gulpDir = path.resolve("./gulp");

const files = fs.readdirSync(gulpDir);
for (const file of files) {
  if (
    file.endsWith(".js") &&
    !["server.js", "utils.js", "lint.js"].includes(file)
  ) {
    const taskModule = await import(`./gulp/${file}`);
    const taskName = file.replace(".js", "");
    dynamicTaskNames.push(taskName);
    Object.keys(taskModule).forEach((key) => {
      tasks[key] = taskModule[key];
      gulp.task(key, taskModule[key]);
    });
  }
}

// 2. РОБОТ-ГЕНЕРАТОР ТАСКОВ ДЛЯ ЛЮБОГО КОНТЕНТА (ПОЛНОСТЬЮ ДИНАМИЧЕСКИЙ ВАРИАНТ)
import through2 from 'through2';

const contentDir = path.join(config.srcFolder, "content");

if (fs.existsSync(contentDir)) {
  const contentFolders = fs.readdirSync(contentDir);
  for (const folderName of contentFolders) {
    const dynamicTask = () => {
      const layoutPath = path.resolve(config.srcFolder, "components", "blog-article", "blog-article.html");
      
      return src(path.join(config.srcFolder, "content", folderName, "**", "*.md"))
        .pipe(plumber({ errorHandler: onError }))
        .pipe(markdown())
        .pipe(
          rename((filePath) => {
            filePath.extname = ".html";
          }),
        )
        // Сначала генерируем чистый HTML статьи во временный буфер dist
        .pipe(dest(path.join(config.buildFolder, folderName)))
        
        // 🔥 УМНЫЙ ПОТОК: берем имя текущего файла контента и оборачиваем ЕГО в шаблон
        .pipe(through2.obj(function(file, enc, cb) {
          const currentFileName = path.basename(file.path); // Находит 'why-gulp-ts.html'
          
          src(layoutPath)
            .pipe(fileInclude({
              prefix: "@@",
              basepath: "@file",
              context: {
                // Передаем точное имя файла в fileInclude для правильной склейки
                articleFile: `../../../dist/${folderName}/${currentFileName}`
              }
            }))
            .pipe(rename(currentFileName))
            .pipe(htmlBeautify({ indent_size: 2, indent_char: " ", eol: "\n" }))
            .pipe(dest(path.join(config.buildFolder, folderName)))
            .on('end', () => {
              cb(null, file);
            });
        }))
        .on("end", bs.reload);
    };

    gulp.task(folderName, dynamicTask);
    tasks[folderName] = dynamicTask;
    dynamicTaskNames.push(folderName);
  }
}

const runTask = (name) => tasks[name] || ((done) => done());
const getContentTasks = () =>
  Object.keys(tasks)
    .filter((name) => name.includes("html") || dynamicTaskNames.includes(name))
    .map(runTask);

// ПОЛНЫЙ ЦИКЛ СБОРКИ ДЛЯ ПРОДАКШЕНА
export const build = gulp.series(
  cleandist,
  gulp.parallel(lintCss, lintJs, runTask("fonts"), runTask("fontsStyle")),
  gulp.parallel(
    runTask("styles"),
    runTask("scripts"),
    runTask("images"),
    runTask("createWebp"),
    runTask("sprite"),
    runTask("favs"),
  ),
  gulp.parallel(...getContentTasks()),
  buildcopy,
  runTask("cssPurge"),
  zipFiles,
  (done) => {
    console.log(">>> 🚀 Project successfully assembled and archived! <<<");
    done();
  },
);

// СТАРТОВЫЙ ТАСК ДЛЯ РАЗРАБОТКИ (ИСПРАВЛЕНО: СТРОГАЯ ОЧЕРЕДНОСТЬ ДЛЯ СИНХРОНИЗАЦИИ CSS)
export default series(
  help,
  series(runTask("fonts"), runTask("fontsStyle")),
  // ШАГ 1: Сначала намертво собираем стили, скрипты и графику
  parallel(
    runTask("styles"),
    runTask("scripts"),
    runTask("imagesDev"),
    runTask("createWebp"),
    runTask("sprite")
  ),
  // ШАГ 2: Только КОГДА стили app.min.css физически записаны на диск, собираем HTML и Блог
  parallel(...getContentTasks()),
  buildcopy,
  parallel(browsersync, startwatch)
);


export { create, remove, module, init, help, cleandist, lintJs, lintCss };
