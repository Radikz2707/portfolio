// gulp/admin.js — Безопасная синхронизация и сборка коллекций Decap CMS через безопасный компилятор YAML
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import YAML from 'yaml'; // Импортируем официальный и безопасный парсер
import { config } from '../gulp.config.js';
import { onError, isProd } from './server.js';

const { src, dest } = gulp;

const emojiMap = {
  programming: '💻',
  'project-info': 'ℹ️',
  space: '🚀',
  poems: '✍️',
  books: '📚',
  travel: '✈️',
  games: '🎮',
  psychology: '🧠',
  blog: '📰',
  work: '💼',
};

export const copyAdminUI = (done) => {
  const adminDestDir = path.join(config.buildFolder, 'admin');
  const pkgDistDir = path.join('node_modules', 'decap-cms', 'dist');
  const contentSrcDir = path.join(config.srcFolder, 'content');
  const categoriesPath = path.join(contentSrcDir, 'categories.json');

  try {
    // 1. ЗАЩИТНЫЙ БЛОК ДИРЕКТОРИЙ
    if (!fs.existsSync(adminDestDir)) {
      fs.mkdirSync(adminDestDir, { recursive: true });
    }

    // 2. Копируем базовый HTML
    const htmlSrcPath = path.join(
      config.srcFolder,
      'components',
      'admin',
      'admin.html',
    );
    if (fs.existsSync(htmlSrcPath)) {
      fs.copyFileSync(htmlSrcPath, path.join(adminDestDir, 'admin.html'));
    }

    // 3. Читаем категории (categories.json)
    let categoriesData = { categories_list: [] };
    if (fs.existsSync(categoriesPath)) {
      try {
        categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
        if (!categoriesData.categories_list && !Array.isArray(categoriesData)) {
          categoriesData = {
            categories_list: Object.keys(categoriesData).map((key) => ({
              id: key,
              title: categoriesData[key],
            })),
          };
        }
      } catch (e) {
        console.error('❌ Ошибка парсинга файла categories.json:', e.message);
      }
    }

    if (!categoriesData.categories_list) categoriesData.categories_list = [];

    // 4. СИНХРОНИЗАЦИЯ С ДИСКОМ
    if (fs.existsSync(contentSrcDir)) {
      const files = fs.readdirSync(contentSrcDir);
      let hasChanges = false;

      files.forEach((file) => {
        const fullPath = path.join(contentSrcDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          const existsInList = categoriesData.categories_list.some(
            (item) => item.id === file,
          );
          if (!existsInList) {
            const autoLabel = file.charAt(0).toUpperCase() + file.slice(1);
            categoriesData.categories_list.push({ id: file, title: autoLabel });
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        fs.writeFileSync(
          categoriesPath,
          JSON.stringify(categoriesData, null, 2),
          'utf-8',
        );
      }
    }

    // 5. ДЕТЕРМИНИРОВАННАЯ СБОРКА ОБЪЕКТА CONFIG.YML ЧЕРЕЗ PARSER
    const configYmlPath = path.join(
      config.srcFolder,
      'components',
      'admin',
      'config.yml',
    );
    let cmsConfig = { collections: [] };

    if (fs.existsSync(configYmlPath)) {
      try {
        const fileContent = fs.readFileSync(configYmlPath, 'utf-8');
        cmsConfig = YAML.parse(fileContent) || { collections: [] };
      } catch (e) {
        console.error('❌ Ошибка парсинга базового config.yml:', e.message);
      }
    }

    if (!cmsConfig.collections) cmsConfig.collections = [];

    // Автоматический расчет путей стилей для iframe превью
    const repoName =
      config.repoPath && config.repoPath.includes('/')
        ? config.repoPath.split('/')
        : 'portfolio';
    const cssPreviewPath = isProd
      ? `/${repoName}/css/app.min.css`
      : '/css/app.min.css';

    cmsConfig.preview_styles = [cssPreviewPath];

    // Динамически пушим папки контента в массив коллекций
    categoriesData.categories_list.forEach((item) => {
      const key = item.id;
      const rawLabel = item.title;

      if (!key || !rawLabel) return;

      const folderPath = path.join(contentSrcDir, key);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const emoji = emojiMap[key] || '📝';
      const label = `${emoji} ${rawLabel}`;

      const isAlreadyAdded = cmsConfig.collections.some(
        (col) => col.name === key,
      );

      if (!isAlreadyAdded) {
        cmsConfig.collections.push({
          name: key,
          label: label,
          folder: `src/content/${key}`,
          create: true,
          slug: '{{title | slug}}',
          identifier_field: 'title',
          fields: [
            { label: 'Заголовок статьи', name: 'title', widget: 'string' },
            {
              label: 'Контент статьи (Markdown)',
              name: 'body',
              widget: 'markdown',
            },
          ],
        });
      }
    });

    // 🔥 СБОРКА С ТОТАЛЬНЫМ УПРАВЛЕНИЕМ СТРОКАМИ:
    // Опция defaultStringType: 'PLAIN' принудительно удаляет ВСЕ лишние кавычки из файла
    //config.yml, приводя его к идеальному нативному синтаксису, понятному Decap CMS.
    const finalYamlContent = YAML.stringify(cmsConfig, {
      defaultStringType: 'PLAIN',
    });

    // Записываем чистый готовый config.yml в dist
    fs.writeFileSync(
      path.join(adminDestDir, 'config.yml'),
      finalYamlContent,
      'utf-8',
    );

    // 6. Копируем движок CMS
    if (fs.existsSync(pkgDistDir)) {
      const cmsEngineSrc = path.join(pkgDistDir, 'decap-cms.js');
      if (fs.existsSync(cmsEngineSrc)) {
        fs.copyFileSync(cmsEngineSrc, path.join(adminDestDir, 'decap-cms.js'));
      }
    }

    // 7. АТОМАРНЫЙ ДЕПЛОЙ В WINDOWS IIS
    const localServerAdminDir = path.join(
      config.localServerFolder || 'C:/inetpub/wwwroot/portfolio',
      'admin',
    );

    return src(path.join(adminDestDir, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(dest(localServerAdminDir))
      .on('end', () => {
        console.log(
          '✅ [Gulp] Графический интерфейс CMS полностью синхронизирован и скомпилирован в YAML!',
        );
        done();
      });
  } catch (err) {
    console.error(
      '🔴 [CONTROL ERROR] Фатальный сбой внутри модуля синхронизации админ-панели!',
    );
    onError(err);
    done(err);
  }
};

copyAdminUI.displayName = 'admin:copy';
