import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import { config } from '../gulp.config.js';

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

  // 1. Создаем целевую папку dist/admin/, если её ещё нет
  if (!fs.existsSync(adminDestDir)) {
    fs.mkdirSync(adminDestDir, { recursive: true });
  }

  // 2. Копируем базовый HTML
  fs.copyFileSync(
    path.join(config.srcFolder, 'components', 'admin', 'admin.html'),
    path.join(adminDestDir, 'admin.html'),
  );

  // 3. Читаем текущий categories.json (поддерживаем структуру списка)
  let categoriesData = { categories_list: [] };
  if (fs.existsSync(categoriesPath)) {
    try {
      const fileContent = fs.readFileSync(categoriesPath, 'utf-8');
      categoriesData = JSON.parse(fileContent);
      // Если файл был плоским объектом, аккуратно мигрируем его в массив
      if (!categoriesData.categories_list && !Array.isArray(categoriesData)) {
        categoriesData = {
          categories_list: Object.keys(categoriesData).map((key) => ({
            id: key,
            title: categoriesData[key],
          })),
        };
      }
    } catch (e) {
      console.error('❌ Ошибка чтения файла categories.json:', e.message);
    }
  }

  if (!categoriesData.categories_list) {
    categoriesData.categories_list = [];
  }

  // 🔥 СИНХРОНИЗАЦИЯ: Сканируем реальные папки на диске
  if (fs.existsSync(contentSrcDir)) {
    const files = fs.readdirSync(contentSrcDir);
    let hasChanges = false;

    files.forEach((file) => {
      const fullPath = path.join(contentSrcDir, file);
      const isDirectory = fs.statSync(fullPath).isDirectory();

      // Проверяем, есть ли папка в текущем массиве категорий
      const existsInList = categoriesData.categories_list.some(
        (item) => item.id === file,
      );

      // Если это папка, и её ЕЩЁ НЕТ в списке категорий
      if (isDirectory && !existsInList) {
        const autoLabel = file.charAt(0).toUpperCase() + file.slice(1);
        categoriesData.categories_list.push({
          id: file,
          title: autoLabel,
        });
        hasChanges = true;
        console.log(
          `✨ [Синхронизация] Найдена новая папка "${file}". Добавляем в список категорий как "${autoLabel}".`,
        );
      }
    });

    // Если список обновился новыми папками, перезаписываем categories.json
    if (hasChanges) {
      fs.writeFileSync(
        categoriesPath,
        JSON.stringify(categoriesData, null, 2),
        'utf-8',
      );
      console.log(`💾 [Синхронизация] Файл categories.json успешно обновлен!`);
    }
  }

  // Читаем основу настроек из config.yml
  let configYmlContent = fs.readFileSync(
    path.join(config.srcFolder, 'components', 'admin', 'config.yml'),
    'utf-8',
  );

  // Генерируем YAML-блоки коллекций на основе элементов массива
  let dynamicCollections = '';
  categoriesData.categories_list.forEach((item) => {
    const key = item.id;
    const rawLabel = item.title;

    if (!key || !rawLabel) return;

    // Проверяем: если категория есть в списке, но папки на диске нет — создаем!
    const folderPath = path.join(contentSrcDir, key);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(
        `📁 [Синхронизация] Создана недостающая папка на диске: src/content/${key}`,
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

  // Записываем финальный расширенный конфиг в dist/admin/
  fs.writeFileSync(
    path.join(adminDestDir, 'config.yml'),
    configYmlContent + dynamicCollections,
  );

  // 4. Копируем монолитный движок CMS
  if (fs.existsSync(pkgDistDir)) {
    fs.copyFileSync(
      path.join(pkgDistDir, 'decap-cms.js'),
      path.join(adminDestDir, 'decap-cms.js'),
    );
  }

  console.log(`✅ [Gulp] Графический интерфейс CMS полностью синхронизирован!`);
  done();
};

copyAdminUI.displayName = 'admin:copy';
