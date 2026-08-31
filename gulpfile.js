import { config } from './gulp.config.js';
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import newer from 'gulp-newer';
import through2 from 'through2';
import matter from 'gray-matter';
import mammoth from 'mammoth'; // Автоматическая поддержка DOCX файлов

// =========================================================================
// ДИРЕКТИВНЫЕ ИМПОРТЫ СИСТЕМНЫХ МОДУЛЕЙ И ИНФРАСТРУКТУРЫ
// =========================================================================
import {
  compileContentStream,
  wrapInMasterLayout,
} from './gulp/utils/content-processor.js';
import { onError, isProd } from './gulp/server.js';
import { lintCss, lintJs } from './gulp/lint.js';
import { cleandist, zipFiles, deployLocal } from './gulp/utils.js';
import { getBuildSignature } from './gulp/system/gulp.cache.js';

// Инструменты автоматизации CLI (БЭМ CRUD & Инициализация)
import { create } from './gulp/system/gulp.create.js';
import { createModule as module } from './gulp/system/gulp.module.js';
import { createPlugin as plugin } from './gulp/system/gulp.plugin.js';
import { remove } from './gulp/system/gulp.remove.js';
import { createStructure as init } from './gulp/system/gulp.init.js';
import { help } from './gulp/system/gulp.help.js';
import { deploy } from './gulp/deploy.js';
import { generateSitemap, generateContentMap } from './gulp/seo.js';
import { copyAdminUI } from './gulp/admin.js';

// Глобальный отпечаток сборки для инвалидации кэша ресурсов (Cache Busting)
const version = getBuildSignature();
console.log(`📦 [CONTROL]: Сборка выполняется под сигнатурой: ${version}`);

const { parallel, series, src, dest } = gulp;
const loadedModules = {};

// Карта декларативного маппинга задач для Lazy Loading
const TASK_FILE_MAP = {
  styles: 'styles',
  scripts: 'scripts',
  html: 'html',
  blogIndex: 'html',
  fonts: 'fonts',
  fontsStyle: 'fonts',
  images: 'images',
  imagesDev: 'images',
  createWebp: 'images',
  sprite: 'images',
  favs: 'images',
  browsersync: 'server',
  startwatch: 'server',
};

// =========================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ДИНАМИЧЕСКИЕ СТРИМЫ (CORE UTILS)
// =========================================================================

/**
 * Автоматически генерирует файл конфигурации среды env-config.js из .env
 */
export const createEnvConfig = (done) => {
  const envPath = path.resolve('.env');
  let token = '';
  let chatId = '';

  if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, 'utf8');

    const tokenMatch = envFileContent.match(/TELEGRAM_TOKEN\s*=\s*(.*)/);
    const chatIdMatch = envFileContent.match(/TELEGRAM_CHAT_ID\s*=\s*(.*)/);

    // 🎯 Берем именно первую группу [1] из массива совпадений, а не сам массив
    if (tokenMatch && tokenMatch[1]) token = tokenMatch[1].trim();
    if (chatIdMatch && chatIdMatch[1]) chatId = chatIdMatch[1].trim();
  }

  token = token.replace(/["']/g, '');
  chatId = chatId.replace(/["']/g, '');

  const envContent = `export const env = { TELEGRAM_TOKEN: '${token}', TELEGRAM_CHAT_ID: '${chatId}' };`;
  const jsDir = path.join(config.srcFolder, 'js');

  if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(jsDir, 'env-config.js'), envContent);
  console.log('✅ env-config.js успешно сгенерирован напрямую из .env');
  done();
};

/**
 * Динамический загрузчик изолированных Gulp-модулей (Lazy Loading)
 */
const runTask = (taskName) => {
  const gulpTaskWrapper = async (done) => {
    try {
      const fileName = TASK_FILE_MAP[taskName] || taskName;

      if (!loadedModules[fileName]) {
        loadedModules[fileName] = await import(`./gulp/${fileName}.js`);
      }

      const taskModule = loadedModules[fileName];
      const task = taskModule[taskName] || taskModule.default;

      if (typeof task === 'function') return task(done);

      throw new Error(
        `Экспортируемая функция "${taskName}" не найдена в файле "./gulp/${fileName}.js"`,
      );
    } catch (err) {
      console.error(`\x1b[31m[Task Error] ${taskName}: ${err.message}\x1b[0m`);
      done(err);
    }
  };

  Object.defineProperty(gulpTaskWrapper, 'name', { value: taskName });
  return gulpTaskWrapper;
};

/**
 * Фабрика динамических задач для генерации контента блога из Markdown и Word DOCX
 * 🎯 ИСПРАВЛЕНО ДЛЯ GULP 5: Убрано дублирование асинхронных сигналов
 */
const createDynamicContentTask = (folderName) => {
  // Убрано 'async' перед (done) — теперь функция возвращает только чистый Node-стрим
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

    let hasChanges = false;

    return (
      src(sourcePath, { allowEmpty: true, encoding: false })
        .pipe(plumber({ errorHandler: onError }))
        .pipe(newer({ dest: tempDestPath, ext: '.html' }))
        .pipe(
          through2.obj(function (file, enc, cb) {
            hasChanges = true;
            this.push(file);
            cb();
          }),
        )
        // Конвертация .docx -> Markdown/HTML текст через классические Promise-цепочки
        .pipe(
          through2.obj(function (file, enc, cb) {
            if (file.isBuffer() && file.extname === '.docx') {
              mammoth
                .extractRawText({ buffer: file.contents })
                .then((result) => {
                  file.contents = Buffer.from(result.value);
                  file.extname = '.md';
                  this.push(file);
                  cb();
                })
                .catch((err) => {
                  console.error(
                    `❌ [DOCX CONTROL ERROR] Сбой конвертации Word в ${file.relative}:`,
                    err.message,
                  );
                  this.push(file);
                  cb();
                });
            } else {
              this.push(file);
              cb();
            }
          }),
        )
        // Разбор Frontmatter метаданных
        .pipe(
          through2.obj(function (file, enc, cb) {
            if (
              file.isBuffer() &&
              (file.extname === '.md' || file.extname === '.txt')
            ) {
              try {
                const fileContent = file.contents.toString('utf8');
                const parsed = matter(fileContent);
                file.contents = Buffer.from(parsed.content);
                file.frontMatter = parsed.data;
              } catch (err) {
                console.error(
                  `❌ [CONTROL ERROR] Ошибка разбора Frontmatter в ${file.relative}:`,
                  err.message,
                );
              }
            }
            this.push(file);
            cb();
          }),
        )
        .pipe(compileContentStream())
        .pipe(dest(tempDestPath))
        .on('end', () => {
          if (hasChanges) {
            try {
              wrapInMasterLayout(tempDestPath, folderName);
            } catch (err) {
              console.error(
                `❌ [CONTROL ERROR] Сбой wrapInMasterLayout для папки ${folderName}:`,
                err.message,
              );
              return done(err);
            }
          }
          done();
        })
    );
  };

  Object.defineProperty(task, 'name', { value: `content:${folderName}` });
  return task;
};

// Динамическое сканирование директорий контента
const contentDir = path.resolve(config.srcFolder || 'src', 'content');
const dynamicContentFolderNames = fs.existsSync(contentDir)
  ? fs.readdirSync(contentDir).filter((f) => {
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

// Комплексные агрегаторы ресурсов
const compileAssets = parallel(
  runTask('styles'),
  runTask('scripts'),
  runTask('images'),
  runTask('createWebp'),
  runTask('sprite'),
  copyAdminUI,
);

const blogContent = createDynamicContentTask('blog');

// =========================================================================
// ПОЛНЫЕ РЕЖИМЫ СБОРКИ ПРОЕКТА (BUILD & DEVELOPMENT PRODUCTION)
// =========================================================================

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
  parallel(generateSitemap, generateContentMap),
  zipFiles,
  (done) => {
    console.log('>>> 🚀 [Gulp 5] Project successfully assembled! <<<');
    done();
  },
  deployLocal,
);

export default series(
  createEnvConfig,
  parallel(runTask('fonts'), runTask('fontsStyle'), runTask('favs')),
  runTask('scripts'),
  runTask('html'),
  series(
    parallel(
      runTask('styles'),
      runTask('imagesDev'),
      runTask('createWebp'),
      runTask('sprite'),
      copyAdminUI,
      ...dynamicContentFolderNames.map((folder) =>
        createDynamicContentTask(folder),
      ),
    ),
    runTask('blogIndex'),
  ),
  runTask('browsersync'),
  runTask('startwatch'),
);

// ЕДИНЫЙ ИЗОЛИРОВАННЫЙ БЛОК СИСТЕМНОГО ЭКСПОРТА (GULP CLI REGISTRATION)
export {
  create,
  remove,
  module,
  plugin,
  init,
  help,
  deploy,
  cleandist,
  lintJs,
  lintCss,
  generateSitemap,
  generateContentMap,
  blogContent,
};

export const favs = runTask('favs');
export const styles = runTask('styles');
export const scripts = runTask('scripts');
export const html = runTask('html');
export const images = runTask('images');
export const createWebp = runTask('createWebp');
export const sprite = runTask('sprite');
export const fonts = runTask('fonts');
export const fontsStyle = runTask('fontsStyle');
export const browsersync = runTask('browsersync');
export const startwatch = runTask('startwatch');
