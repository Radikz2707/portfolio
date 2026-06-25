// gulp/admin.js
import gulp from 'gulp';
import fs from 'fs';
import path from 'path';
import { config } from '../gulp.config.js';

// Каркас дефолтных эмодзи-иконок для красивого отображения в админке
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
};

export const copyAdminUI = (done) => {
  const adminDestDir = path.join(config.buildFolder, 'admin');
  const pkgDistDir = path.join('node_modules', 'decap-cms', 'dist');
  const categoriesPath = path.join(
    config.srcFolder,
    'content',
    'categories.json',
  );

  // 1. Создаем целевую папку dist/admin/, если её ещё нет
  if (!fs.existsSync(adminDestDir)) {
    fs.mkdirSync(adminDestDir, { recursive: true });
  }

  // 2. Копируем базовый HTML
  fs.copyFileSync(
    path.join(config.srcFolder, 'components', 'admin', 'admin.html'),
    path.join(adminDestDir, 'admin.html'),
  );

  // 3. Динамически считываем ваш файл categories.json
  let categories = {};
  if (fs.existsSync(categoriesPath)) {
    try {
      categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
    } catch (e) {
      console.error('❌ Ошибка чтения файла categories.json:', e.message);
    }
  }

  // Считываем основу настроек из config.yml
  let configYmlContent = fs.readFileSync(
    path.join(config.srcFolder, 'components', 'admin', 'config.yml'),
    'utf-8',
  );

  // Генерируем YAML-блоки коллекций прямо на основе ключей вашего JSON-файла
  let dynamicCollections = '';
  Object.keys(categories).forEach((key) => {
    const rawLabel = categories[key];
    const emoji = emojiMap[key] || '📝'; // Ставим эмодзи из карты или дефолтный листок
    const label = `${emoji} ${rawLabel}`;

    dynamicCollections += `
  - name: "${key}"
    label: "${label}"
    folder: "${config.srcFolder}/content/${key}"
    create: true
    slug: "{{slug}}"
    fields:
      - { label: "Заголовок статьи", name: "title", widget: "string" }
      - { label: "Контент статьи (Markdown)", name: "body", widget: "markdown" }
`;
  });

  // Записываем финальный расширенный конфиг вdist/admin/
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

  console.log(
    `✅ [Gulp 5] Графический интерфейс CMS успешно синхронизирован с файлом categories.json!`,
  );
  done();
};

copyAdminUI.displayName = 'admin:copy';
