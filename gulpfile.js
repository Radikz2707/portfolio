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
import dotenv from 'dotenv';

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
import { create } from './gulp/system/gulp.create.js';
import { createModule as module } from './gulp/system/gulp.module.js';
import { createPlugin as plugin } from './gulp/system/gulp.plugin.js';
import { remove } from './gulp/system/gulp.remove.js';
import { createStructure as init } from './gulp/system/gulp.init.js';
import { help } from './gulp/system/gulp.help.js';
import { deploy } from './gulp/deploy.js';

// Глобальная метка сборки для пробития кэша
global.buildSig = Date.now();

const { parallel, series, src, dest } = gulp;

// ГЕНЕРАЦИЯ КОНФИГА ИЗ .ENV
export const createEnvConfig = (done) => {
  const envPath = path.resolve('.env');
  let token = '';
  let chatId = '';

  if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, 'utf8');
    const tokenMatch = envFileContent.match(/TELEGRAM_TOKEN\s*=\s*(.*)/);
    const chatIdMatch = envFileContent.match(/TELEGRAM_CHAT_ID\s*=\s*(.*)/);

    if (tokenMatch) token = tokenMatch[1].trim();
    if (chatIdMatch) chatId = chatIdMatch[1].trim();
  }

  const envContent = `export const env = {
  TELEGRAM_TOKEN: '${token}',
  TELEGRAM_CHAT_ID: '${chatId}'
};`;
  const jsDir = path.join(config.srcFolder, 'js');
  if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });
  fs.writeFileSync(path.join(jsDir, 'env-config.js'), envContent);
  console.log('✅ env-config.js успешно сгенерирован напрямую из .env');
  done();
};

const loadedModules = {};

const runTask = (taskName) => {
  const gulpTaskWrapper = async (done) => {
    try {
      let fileName = taskName;
      if (taskName === 'fontsStyle') fileName = 'fonts';
      else if (taskName === 'blogIndex') fileName = 'html';
      else if (taskName === 'server') fileName = 'server';
      else if (
        ['imagesDev', 'createWebp', 'sprite', 'favs', 'faviconsDev'].includes(
          taskName,
        )
      )
        fileName = 'images';

      if (!loadedModules[fileName]) {
        loadedModules[fileName] = await import(`./gulp/${fileName}.js`);
      }

      const taskModule = loadedModules[fileName];
      const task = taskModule[taskName] || taskModule.default;
      if (typeof task === 'function') return task(done);
      done();
    } catch (err) {
      console.error(`\x1b[31m[Task Error] ${taskName}: ${err.message}\x1b[0m`);
      done(err);
    }
  };
  Object.defineProperty(gulpTaskWrapper, 'name', { value: taskName });
  return gulpTaskWrapper;
};

const createDynamicContentTask = (folderName) => {
  const task = (done) => {
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

    const isMainBlogFolder = folderName === 'blog';
    const tempDestPath = isMainBlogFolder
      ? path.join(config.buildFolder, folderName)
      : path.join(config.buildFolder, 'blog', folderName);

    return src(sourcePath, { allowEmpty: true, encoding: false })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(newer(tempDestPath))
      .pipe(compileContentStream())
      .pipe(dest(tempDestPath))
      .on('end', () => {
        // 🔥 ИСПРАВЛЕНО: Передаем folderName без изменений, чтобы пути к src/content/ читал без ошибок,
        // но добавляем флаг вложенности третьим аргументом, если это необходимо
        wrapInMasterLayout(tempDestPath, folderName)
          .then(() => done())
          .catch((err) => done(err));
      });
  };
  Object.defineProperty(task, 'name', { value: `content:${folderName}` });
  return task;
};

const contentDir = path.resolve(config.srcFolder || 'src', 'content');

const dynamicContentFolderNames = fs.existsSync(contentDir)
  ? fs.readdirSync(contentDir).filter((f) => {
      // Игнорируем скрытые папки (например, .git или системные кэши)
      if (f.startsWith('.')) return false;
      return fs.statSync(path.join(contentDir, f)).isDirectory();
    })
  : [
      'programming',
      'project-info',
      'travel',
      'books',
      'games',
      'poems',
      'psychology',
      'space',
    ];
const compileAssets = parallel(
  runTask('styles'),
  runTask('scripts'),
  runTask('images'),
  runTask('createWebp'),
  runTask('sprite'),
);
const blogContent = createDynamicContentTask('blog');

export const build = series(
  createEnvConfig,
  cleandist,
  parallel(runTask('fonts'), runTask('fontsStyle'), runTask('favs')),
  parallel(...(isProd ? [lintCss, lintJs] : []), compileAssets),
  parallel(
    ...dynamicContentFolderNames.map((folder) =>
      createDynamicContentTask(folder),
    ),
  ),
  parallel(runTask('html')),
  runTask('blogIndex'),
  zipFiles,
  (done) => {
    console.log('>>> 🚀 [Gulp 5] Project successfully assembled! <<<');
    done();
  },
);

export default series(
  createEnvConfig,
  parallel(runTask('fonts'), runTask('fontsStyle'), runTask('favs')),
  runTask('scripts'),
  runTask('html'),
  parallel(
    runTask('blogIndex'),
    runTask('styles'),
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
  deploy,
};
export const favs = runTask('favs');
