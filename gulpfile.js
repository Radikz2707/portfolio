import { config } from './gulp.config.js';
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import rename from 'gulp-rename';

// Импорты процессоров контента
import {
  generateSidebarLinks,
  processHtmlContent,
  parsePlainText,
  compileContentStream,
  wrapInMasterLayout,
} from './gulp/utils/content-processor.js';

// Импорты инфраструктуры сервера
import { browsersync, startwatch, onError, isProd, bs } from './gulp/server.js';
import { lintCss, lintJs } from './gulp/lint.js';
import { cleandist, buildcopy, zipFiles } from './gulp/utils.js';

// Импорты системных утилит
import { create } from './gulp.create.js';
import { createModule as module } from './gulp.module.js';
import { createPlugin as plugin } from './gulp.plugin.js';
import { remove } from './gulp.remove.js';
import { createStructure as init } from './gulp.init.js';
import { help } from './gulp.help.js';

const { parallel, series, src, dest } = gulp;

const loadedModules = {};

// =========================================================================
// 📦 1. УМНЫЙ ДИСПЕТЧЕР ЛЕНИВОГО ИМПОРТА С ПОЛНОЙ МАРШРУТИЗАЦИЕЙ ФАЙЛОВ
// =========================================================================
const runTask = (taskName) => {
  // Создаем именованную функцию-обертку вместо анонимной стрелочной
  const gulpTaskWrapper = async (done) => {
    try {
      let fileName = taskName;
      if (taskName === 'fontsStyle') {
        fileName = 'fonts';
      } else if (
        ['imagesDev', 'createWebp', 'sprite', 'favs', 'faviconsDev'].includes(
          taskName,
        )
      ) {
        fileName = 'images';
      }

      if (!loadedModules[fileName]) {
        loadedModules[fileName] = await import(`./gulp/${fileName}.js`);
      }

      const taskModule = loadedModules[fileName];

      if (typeof taskModule[taskName] === 'function') {
        return taskModule[taskName](done);
      }
      if (typeof taskModule.default === 'function') {
        return taskModule.default(done);
      }
      done();
    } catch (err) {
      console.error(`\x1b[31m[Task Error] ${taskName}: ${err.message}\x1b[0m`);
      done(err);
    }
  };

  // КРИТИЧЕСКИЙ ШАГ ДЛЯ ЛОГОВ GULP: Явно переопределяем имя функции для терминала
  Object.defineProperty(gulpTaskWrapper, 'name', {
    value: taskName,
    writable: false,
  });

  return gulpTaskWrapper;
};

// =========================================================================
// 🤖 2. ИЗОЛИРОВАННЫЙ РОБОТ-ГЕНЕРАТОР ТАСКОВ ДЛЯ MD/DOCX КОНТЕНТА
// =========================================================================
const createDynamicContentTask = (folderName) => {
  return (done) => {
    const sourcePath = path.join(
      config.srcFolder,
      'content',
      folderName,
      '**',
      '*.{md,txt,rtf,docx}',
    );
    const tempDestPath = path.join(config.buildFolder, folderName);

    src(sourcePath, { allowEmpty: true, encoding: false })
      .pipe(
        plumber({
          errorHandler: (err) => {
            console.error(err);
            done(err);
          },
        }),
      )
      .pipe(compileContentStream())
      .pipe(dest(tempDestPath))
      .on('end', () => {
        wrapInMasterLayout(tempDestPath, folderName)
          .then(() => {
            bs.reload();
            done();
          })
          .catch((err) => done(err));
      });
  };
};

const contentDir = path.join(config.srcFolder, 'content');
const dynamicContentFolderNames = fs.existsSync(contentDir)
  ? fs
      .readdirSync(contentDir)
      .filter((f) => fs.statSync(path.join(contentDir, f)).isDirectory())
  : [];

const runAllContentTasks = (done) => {
  if (dynamicContentFolderNames.length === 0) return done();

  const contentTasks = dynamicContentFolderNames.map((folderName) => {
    return (taskDone) => createDynamicContentTask(folderName)(taskDone);
  });

  return parallel(...contentTasks)(done);
};

// =========================================================================
// 🚀 ОПРЕДЕЛЕНИЕ СЦЕНАРИЕВ ВЫПОЛНЕНИЯ (CLI TASKS)
// =========================================================================

const compileAssets = parallel(
  runTask('styles'),
  runTask('scripts'),
  runTask('images'),
  runTask('createWebp'),
  runTask('sprite'),
);

export const build = series(
  cleandist,
  runTask('favs'),
  parallel(lintCss, lintJs, runTask('fonts'), runTask('fontsStyle')),
  runAllContentTasks,
  compileAssets,
  buildcopy,
  zipFiles,
  (done) => {
    console.log(
      '>>> 🚀 [Gulp 5] Project successfully assembled line-by-line! <<<',
    );
    done();
  },
);

export default series(
  help,
  series(runTask('fonts'), runTask('fontsStyle')),
  parallel(
    runTask('styles'),
    runTask('scripts'),
    runTask('imagesDev'),
    runTask('createWebp'),
    runTask('sprite'),
    runTask('favs'),
    runTask('faviconsDev'),
    runTask('html'), // <--- ИСПРАВЛЕНО: Генерируем index.html при старте сервера!
  ),
  runAllContentTasks,
  buildcopy,
  parallel(browsersync, startwatch),
);

export {
  create,
  remove,
  module,
  plugin,
  init,
  help,
  cleandist,
  lintJs,
  lintCss,
};
