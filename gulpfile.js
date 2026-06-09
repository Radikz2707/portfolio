import { config } from './gulp.config.js';
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import rename from 'gulp-rename';

// 🔥 ИСПРАВЛЕНО: Импортируем только новые чистые хелперы стримов контента.
// Все зависимости (mammoth, through2, markdown) теперь скрыты внутри процессора!
import {
  generateSidebarLinks,
  processHtmlContent,
  parsePlainText,
  compileContentStream,
  wrapInMasterLayout,
} from './gulp/utils/content-processor.js';

// Импорты фиксированной инфраструктуры сервера и утилит
import { browsersync, startwatch, onError, isProd, bs } from './gulp/server.js';
import { lintCss, lintJs } from './gulp/lint.js';
import { cleandist, buildcopy, zipFiles } from './gulp/utils.js';
import { create } from './gulp.create.js';
import { createModule as module } from './gulp.module.js';
import { createPlugin as plugin } from './gulp.plugin.js';
import { remove } from './gulp.remove.js';
import { createStructure as init } from './gulp.init.js';
import { help } from './gulp.help.js';

const { parallel, series, src, dest } = gulp;
const tasks = {};
export const dynamicTaskNames = [];

// =========================================================================
// 🛠 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (HELPERS)
// =========================================================================

// =========================================================================
// 📦 1. АВТО-ИМПОРТ СТАНДАРТНЫХ ТАСКОВ ИЗ ПАПКИ GULP/
// =========================================================================
const gulpDir = path.resolve('./gulp');
if (fs.existsSync(gulpDir)) {
  const files = fs.readdirSync(gulpDir);
  for (const file of files) {
    if (
      file.endsWith('.js') &&
      !['server.js', 'utils.js', 'lint.js'].includes(file)
    ) {
      const taskModule = await import(`./gulp/${file}`);
      const taskName = file.replace('.js', '');
      dynamicTaskNames.push(taskName);
      Object.keys(taskModule).forEach((key) => {
        if (typeof taskModule[key] === 'function') {
          tasks[key] = taskModule[key];
          gulp.task(key, taskModule[key]);
        }
      });
    }
  }
}

// =========================================================================
// 🤖 2. ДИНАМИЧЕСКИЙ РОБОТ-ГЕНЕРАТОР ТАСКОВ ДЛЯ ЛЮБОГО КОНТЕНТА (ВСЕЯДНЫЙ)
// =========================================================================
const contentDir = path.join(config.srcFolder, 'content');
if (fs.existsSync(contentDir)) {
  const contentFolders = fs.readdirSync(contentDir);

  for (const folderName of contentFolders) {
    const dynamicTask = (done) => {
      const sourcePath = path.join(
        config.srcFolder,
        'content',
        folderName,
        '**',
        '*.{md,txt,rtf,docx}',
      );
      const tempDestPath = path.join(config.buildFolder, folderName);

      // ЭТАП 1: Генерируем сырой HTML-контент через изолированный хелпер-конвертер
      src(sourcePath, { allowEmpty: true })
        .pipe(plumber({ errorHandler: onError }))
        .pipe(compileContentStream())
        .pipe(dest(tempDestPath))

        // ЭТАП 2: Передаем управление хелперу оборачивания в шаблоны, фавиконки и сайдбар
        .on('end', () => {
          wrapInMasterLayout(tempDestPath, folderName)
            .then(() => {
              bs.reload();
              done();
            })
            .catch((err) => done(err));
        });
    };

    gulp.task(folderName, dynamicTask);
    tasks[folderName] = dynamicTask;
    dynamicTaskNames.push(folderName);
  }
}

// Селектор зарегистрированных HTML и контентных задач
const runTask = (name) => tasks[name] || ((done) => done());
const getContentTasks = () =>
  Object.keys(tasks)
    .filter((name) => name.includes('html') || dynamicTaskNames.includes(name))
    .map(runTask);

// =========================================================================
// 🚀 ОПРЕДЕЛЕНИЕ СЦЕНАРИЕВ ВЫПОЛНЕНИЯ (CLI TASKS)
// =========================================================================

// 1. Вспомогательный сценарий сборки ресурсов (Assets Pipeline)
// 🔥 ИСПРАВЛЕНО: runTask('favs') убран из compileAssets, так как он уже запускается в начале build
const compileAssets = parallel(
  runTask('styles'),
  runTask('scripts'),
  runTask('images'),
  runTask('createWebp'),
  runTask('sprite'),
);

// 2. ПОЛНЫЙ ЦИКЛ СБОРКИ ДЛЯ ПРОДАKШЕНА (npm run build / npm run deploy)
export const build = series(
  cleandist, // 1. Чистим dist
  runTask('favs'), // 🔥 1.1. Генерируем фавиконки сразу после очистки
  parallel(lintCss, lintJs, runTask('fonts'), runTask('fontsStyle')), // 2. Запускаем линтеры и шрифты
  compileAssets, // 3. Компилируем все стили, скрипты и картинки
  parallel(...getContentTasks()), // 4. Генерируем HTML-страницы из Markdown блога
  buildcopy, // 5. Переносим все финальные файлы в dist
  zipFiles, // 6. Архивируем проект
  (done) => {
    console.log('>>> 🚀 Project successfully assembled and archived! <<<');
    done();
  },
);

// 3. СТАРТОВЫЙ ТАСК ДЛЯ РАЗРАБОТКИ (npm run dev)
export default series(
  help,
  series(runTask('fonts'), runTask('fontsStyle')),
  parallel(
    runTask('styles'),
    runTask('scripts'),
    runTask('imagesDev'),
    runTask('createWebp'),
    runTask('sprite'),
    runTask('favs'), // 🔥 Генерируем фавиконки в режиме разработки
    runTask('faviconsDev'), // 🔥 Копируем фавиконки для сервера (запускается ПОСЛЕ favs)
  ),
  parallel(...getContentTasks()),
  buildcopy,
  // 🔥 ИСПРАВЛЕНО НАВСЕГДА: Передаем функции напрямую как переменные в обход реестра Gulp!
  parallel(browsersync, startwatch),
);

// Экспорт системных утилит
export { create, remove, module, plugin, init, help, cleandist, lintJs, lintCss };
