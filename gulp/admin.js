// gulp/admin.js — Безопасная синхронизация и сборка коллекций Decap CMS через безопасный компилятор YAML
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import plumber from 'gulp-plumber';
import { config } from '../gulp.config.js';
import { onError } from './server.js';

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

    // 5. НАДЕЖНЫЙ СТРОКОВЫЙ ДВИЖОК СБОРКИ CONFIG.YML
    // Считываем базовый конфиг как чистый текст, полностью сохраняя backend, media_folder и кавычки
    const baseConfigYmlPath = path.join(
      config.srcFolder,
      'components',
      'admin',
      'config.yml',
    );
    let finalYamlContent = '';

    if (fs.existsSync(baseConfigYmlPath)) {
      finalYamlContent =
        fs.readFileSync(baseConfigYmlPath, 'utf-8').trim() + '\n\n';
    } else {
      // Автономный фолбэк, если исходный файл в компонентах был случайно удален
      finalYamlContent =
        "backend:\n  name: proxy\n  proxy_url: http://localhost:8082/api/v1\n  repo: 'Radik/portfolio'\n  branch: 'main'\n\nlocal_backend: true\n\nmedia_folder: 'src/images/blog'\npublic_folder: '/images/blog'\n\ncollections:\n";
    }

    // Проверяем, объявлен ли уже блок collections: в базовом файле
    if (!finalYamlContent.includes('collections:')) {
      finalYamlContent += 'collections:\n';
    }

    // Динамически дописываем папки контента в конец текстового файла в виде валидных YAML-строк
    categoriesData.categories_list.forEach((item) => {
      const key = item.id;
      const rawLabel = item.title;

      if (!key || !rawLabel) return;

      const folderPath = path.join(contentSrcDir, key);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const emoji = emojiMap[key] || '📝';
      const label = emoji + ' ' + rawLabel;

      finalYamlContent += '  - name: "' + key + '"\n';
      finalYamlContent += '    label: "' + label + '"\n';
      finalYamlContent += '    folder: "src/content/' + key + '"\n';
      finalYamlContent += '    create: true\n';
      finalYamlContent += '    slug: "{{title}}"\n'; // 🟢 Железно передаем тег генерации ЧПУ из заголовка прямо в коллекцию
      finalYamlContent += '    identifier_field: "title"\n';
      finalYamlContent += '    fields:\n';
      finalYamlContent +=
        '      - { label: "Заголовок статьи", name: "title", widget: "string" }\n';
      finalYamlContent +=
        '      - { label: "Контент статьи (Markdown)", name: "body", widget: "markdown" }\n\n';
    });

    // Записываем чистый готовый config.yml в dist/admin
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

    // 7. АТОМАРНЫЙ ДЕПЛОЙ В WINDOWS IIS с Guard Clause защитой среды
    if (!config.localServerFolder) {
      console.log(
        '✅ [Gulp] Графический интерфейс CMS успешно скомпилирован в dist/admin!',
      );
      console.log(
        'ℹ️ Локальный сервер IIS не настроен в .env, копирование в wwwroot пропущено.',
      );
      return done();
    }

    const localServerAdminDir = path.join(config.localServerFolder, 'admin');

    return src(path.join(adminDestDir, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(dest(localServerAdminDir))
      .on('end', () => {
        console.log(
          '✅ [Gulp] Графический интерфейс CMS полностью синхронизирован и скомпилирован в локальный IIS!',
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
