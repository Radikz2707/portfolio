import { config } from './gulp.config.js';
import crypto from 'crypto';
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import fileInclude from 'gulp-file-include';
import htmlhint from 'gulp-htmlhint';
import htmlBeautify from 'gulp-html-beautify';
import rename from 'gulp-rename';
import newer from 'gulp-newer';

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
import { cleandist, zipFiles } from './gulp/utils.js';

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
  const gulpTaskWrapper = async (done) => {
    try {
      let fileName = taskName;

      if (taskName === 'fontsStyle') {
        fileName = 'fonts';
      } else if (taskName === 'blogIndex') {
        fileName = 'html';
      }
      // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: если кто-то вызовет runTask('server'), перенаправляем в server.js
      else if (taskName === 'server') {
        fileName = 'server';
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
  try {
    return taskModule[taskName](done);
  } catch (err) {
    console.error(`\x1b[31m[Task Error] ${taskName}: ${err.message}\x1b[0m`);
    return done(err);
  }
}
if (typeof taskModule.default === 'function') {
  try {
    return taskModule.default(done);
  } catch (err) {
    console.error(`\x1b[31m[Task Error] ${taskName}: ${err.message}\x1b[0m`);
    return done(err);
  }
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

    return (
      src(sourcePath, { allowEmpty: true, encoding: false })
        .pipe(plumber({ errorHandler: onError }))

        // 🔥 УМНАЯ ОПТИМИЗАЦИЯ: Пропускаем файлы, которые не редактировались в src/content/
        .pipe(newer(tempDestPath))

        .pipe(compileContentStream())
        .pipe(dest(tempDestPath))
        .on('end', () => {
          wrapInMasterLayout(tempDestPath, folderName)
            .then(() => {
              bs.reload();
              done();
            })
            .catch((err) => done(err));
        })
    );
  };
};

const contentDir = path.join(config.srcFolder, 'content');
const dynamicContentFolderNames = fs.existsSync(contentDir)
  ? fs
      .readdirSync(contentDir)
      .filter((f) => fs.statSync(path.join(contentDir, f)).isDirectory())
  : [];

// 🔥 ОКОНЧАТЕЛЬНЫЙ СВЕРХБЫСТРЫЙ КЭШ (ИГНОРИРУЕТ МУСОРНЫЕ ФАЙЛЫ WORD)
const runAllContentTasks = async (done) => {
  const { wrapInMasterLayout } =
    await import('./gulp/utils/content-processor.js');

  const blogSrcDir = path.join(config.srcFolder, 'content', 'blog');
  const cacheMarkerPath = path.join(
    config.srcFolder,
    'content',
    '.blog-cache-marker',
  );
  const blogDestDir = path.join(config.buildFolder, 'blog');

  if (!fs.existsSync(blogSrcDir)) return done();

  try {
    // 🔥 ХИРУРГИЧЕСКИЙ КОНТРОЛЬ: Хэшируем ТОЛЬКО стабильные .md файлы, игнорируя .docx и временные файлы ~$
    const files = fs.readdirSync(blogSrcDir).filter((f) => f.endsWith('.md'));
    let currentDirStateString = '';

    files.forEach((file) => {
      const filePath = path.join(blogSrcDir, file);
      const stat = fs.statSync(filePath);
      currentDirStateString += `${file}:${stat.size};`;
    });

    const currentHash = crypto
      .createHash('md5')
      .update(currentDirStateString)
      .digest('hex');

    let isCacheValid = false;
    if (fs.existsSync(cacheMarkerPath)) {
      const savedHash = fs.readFileSync(cacheMarkerPath, 'utf8').trim();
      if (currentHash === savedHash) {
        isCacheValid = true;
      }
    }

    // Если папки dist нет ИЛИ изменились текстовые .md файлы — запускаем сборку
    if (!isCacheValid || !fs.existsSync(blogDestDir)) {
      console.log('📝 [Mammoth] Изменения зафиксированы. Сборка статей...');
      await wrapInMasterLayout(blogDestDir, 'blog');

      fs.writeFileSync(cacheMarkerPath, currentHash, 'utf8');
      done();
    } else {
      // 🔥 ПОЛНЫЙ ПРОПУСК ТОРМОЗОВ ЗА 1 МИЛЛИСЕКУНДУ!
      console.log(
        'ℹ️ [Content-Cache] Статьи не изменялись. Тяжелый парсинг Word пропущен.',
      );
      done();
    }
  } catch (err) {
    console.error('Ошибка в таске контента:', err);
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
  parallel(
    // Запускаем линтеры только в продакшн‑режиме
    ...(isProd ? [lintCss, lintJs] : []),
    runTask('fonts'),
    runTask('fontsStyle'),
    runTask('favs'),
    compileAssets,
  ),
  // Сначала собираем ассеты, затем генерируем блог‑контент
  blogIndex,
  // После готового контента собираем HTML
  parallel(runTask('html')),
  zipFiles,
  (done) => {
    console.log(
      '>>> 🚀 [Gulp 5] Project successfully assembled line-by-line! <<<',
    );
    done();
  },
);

const blogContent = createDynamicContentTask('blog');

export default series(
  parallel(runTask('fonts'), runTask('fontsStyle')),
  parallel(
    runTask('html'),
    blogIndex,
    runTask('styles'),
    runTask('scripts'),
    runTask('imagesDev'),
    runTask('createWebp'),
    runTask('sprite'),
    ...dynamicContentFolderNames.map((folder) =>
      createDynamicContentTask(folder),
    ),
  ),
  browsersync,
  startwatch,
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
