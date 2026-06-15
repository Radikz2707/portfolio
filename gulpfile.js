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
import { blogIndex } from './gulp/html.js';

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
    configurable: true,
  });

  return gulpTaskWrapper;
};

// =========================================================================
// 🤖 2. ИЗОЛИРОВАННЫЙ РОБОТ-ГЕНЕРАТОР ТАСКОВ ДЛЯ MD/DOCX КОНТЕНТА
// =========================================================================
const createDynamicContentTask = (folderName) => {
  return (done) => {
    const sourcePath = [
      path.join(
        config.srcFolder,
        'content',
        folderName,
        '**',
        '*.{md,txt,rtf,docx}',
      ),
    ];

    if (folderName === 'blog') {
      sourcePath.push(
        '!' +
          path.join(
            config.srcFolder,
            'content',
            folderName,
            'index.{md,txt,rtf,docx}',
          ),
      );
    }

    const tempDestPath = path.join(config.buildFolder, folderName);

    // 🔥 ИСПРАВЛЕНО: Добавляем ключевое слово return, чтобы стрим нативно возвращался в Gulp-поток
    return src(sourcePath, { allowEmpty: true, encoding: false })
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
            done(); // Сигнализируем об успешном асинхронном завершении рендеринга мастер-шаблона
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

  try {
    // 🔥 ИСПРАВЛЕНО: Прямо маппим папки в готовые к исполнению Gulp-функции
    const contentTasks = dynamicContentFolderNames.map((folderName) => {
      return createDynamicContentTask(folderName);
    });

    // Нативно запускаем параллельное выполнение, которое теперь четко знает, когда финиш
    return parallel(...contentTasks)(done);
  } catch (err) {
    console.error(`\x1b[31m[Content Tasks Error]: ${err.message}\x1b[0m`);
    done(err);
  }
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
  parallel(runTask('html'), blogIndex, runAllContentTasks),
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
  // 1. Сначала подготавливаем критические ресурсы: шрифты и фавиконки
  series(runTask('fonts'), runTask('fontsStyle'), runTask('favs')),

  // 2. 🔥 ИСПРАВЛЕНО ПОД МАКСИМАЛЬНЫМ КОНТРОЛЕМ:
  // Запускаем ВСЕ задачи генерации страниц, картинок и копирования в едином параллельном пуле.
  // Это полностью уничтожает блокировку диска (I/O Deadlock) между тасками!
  parallel(
    runTask('styles'),
    runTask('scripts'),
    runTask('imagesDev'),
    runTask('createWebp'),
    runTask('sprite'),
    runTask('faviconsDev'),
    runTask('html'),
    blogIndex,
    runAllContentTasks, // Перенесли внутрь параллельного пула
    buildcopy, // Перенесли внутрь параллельного пула
  ),

  // 3. И только когда вся сборка на 100% завершена — поднимаем сервер и включаем вотчеры
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

// Передаем ленивую обертку наружу для консоли Gulp
export const favs = runTask('favs');
