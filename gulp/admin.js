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
    } else {
      console.warn(
        `⚠️ [CONTROL]: Исходный файл admin.html не найден по пути: ${htmlSrcPath}`,
      );
    }

    // 3. Читаем текущий categories.json (с валидацией структуры)
    let categoriesData = { categories_list: [] };
    if (fs.existsSync(categoriesPath)) {
      try {
        const fileContent = fs.readFileSync(categoriesPath, 'utf-8');
        categoriesData = JSON.parse(fileContent);

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

    if (!categoriesData.categories_list) {
      categoriesData.categories_list = [];
    }

    // 4. ДЕТЕРМИНИРОВАННАЯ СИНХРОНИЗАЦИЯ С ДИСКОМ
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
            console.log(
              `✨ [Синхронизация] Добавлен отсутствующий раздел: "${file}" -> "${autoLabel}"`,
            );
          }
        }
      });

      if (hasChanges) {
        fs.writeFileSync(
          categoriesPath,
          JSON.stringify(categoriesData, null, 2),
          'utf-8',
        );
        console.log(
          `💾 [Синхронизация] Файл categories.json успешно обновлен!`,
        );
      }
    }

    // 5. ГЕНЕРАЦИЯ ДИНАМИЧЕСКИХ КОЛЛЕКЦИЙ YAML
    const configYmlPath = path.join(
      config.srcFolder,
      'components',
      'admin',
      'config.yml',
    );
    let configYmlContent = fs.existsSync(configYmlPath)
      ? fs.readFileSync(configYmlPath, 'utf-8')
      : '';

    let dynamicCollections = '';
    categoriesData.categories_list.forEach((item) => {
      const key = item.id;
      const rawLabel = item.title;

      if (!key || !rawLabel) return;

      const folderPath = path.join(contentSrcDir, key);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(
          `📁 [Синхронизация] Создана новая пустая директория контента: src/content/${key}`,
        );
      }

      const emoji = emojiMap[key] || '📝';
      const label = `${emoji} ${rawLabel}`;

      dynamicCollections += `
  - name: "${key}"
    label: "${label}"
    folder: "${config.srcFolder}/content/${key}"
    create: true
    slug: "{{title | slug}}"
    fields:
      - { label: "Заголовок статьи", name: "title", widget: "string" }
      - { label: "Контент статьи (Markdown)", name: "body", widget: "markdown" }
`;
    });

    // Атомарно пишем сгенерированный конфиг в dist/admin/
    fs.writeFileSync(
      path.join(adminDestDir, 'config.yml'),
      configYmlContent + dynamicCollections,
      'utf-8',
    );

    // 6. Копируем монолитный движок CMS из node_modules
    if (fs.existsSync(pkgDistDir)) {
      const cmsEngineSrc = path.join(pkgDistDir, 'decap-cms.js');
      if (fs.existsSync(cmsEngineSrc)) {
        fs.copyFileSync(cmsEngineSrc, path.join(adminDestDir, 'decap-cms.js'));
      }
    }

    // 🔥 АТОМАРНЫЙ ПЕРЕХВАТ ДЕПЛОЯ ДЛЯ WINDOWS IIS (Устранение Race Condition)
    // Вместо синхронной блокировки диска передаем файлы готового дистрибутива CMS
    // во внутренний потоковый конвейер Gulp 5, гарантирующий закрытие дескрипторов
    const localServerAdminDir = path.join(
      config.localServerFolder || 'C:/inetpub/wwwroot/portfolio',
      'admin',
    );

    return src(path.join(adminDestDir, '**', '*'), {
      allowEmpty: true,
      encoding: false,
    })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(dest(localServerAdminDir)) // Потоковое копирование в IIS wwwroot
      .on('end', () => {
        console.log(
          `✅ [Gulp] Графический интерфейс CMS полностью синхронизирован и развернут в IIS!`,
        );
        done();
      });
  } catch (err) {
    console.error(
      '🔴 [CONTROL ERROR] Фатальный сбой внутри модуля синхронизации админ-панели!',
    );
    onError(err);
    done(err); // Предотвращаем зависание планировщика Gulp при ошибках ввода-вывода
  }
};

copyAdminUI.displayName = 'admin:copy';
