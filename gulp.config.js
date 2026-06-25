import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs'; // 🔥 Добавили нативный модуль файловой системы

// ==========================================
// ДИНАМИЧЕСКИЕ НАСТРОЙКИ ИЗ ГРАФИЧЕСКОЙ АДМИНКИ
// ==========================================
const settingsPath = path.join(
  process.cwd(),
  'src',
  'content',
  'system-settings.json',
);

// Дефолтные значения на случай первого запуска или отсутствия файла
let srcFolder = 'src';
let buildFolder = 'dist';
let siteUrl = 'https://radik.dev';

// Если админка сохранила изменения в JSON — подтягиваем новые пути на лету
if (fs.existsSync(settingsPath)) {
  try {
    const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (settingsData.srcFolder) srcFolder = settingsData.srcFolder;
    if (settingsData.buildFolder) buildFolder = settingsData.buildFolder;
    if (settingsData.siteUrl) siteUrl = settingsData.siteUrl;
  } catch (e) {
    // Мягкий предохранитель: если файл в момент сохранения занят другим процессом, используем дефолты
  }
}

// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ НАПРАВЛЕНИЙ
// ==========================================
const scssExtension = 'scss';

// ==========================================
// АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ РЕПОЗИТОРИЯ
// ==========================================
const detectRepoPath = () => {
  try {
    const remoteUrl = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    const match = remoteUrl.match(/github[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  } catch {
    // Игнорируем ошибку выполнения команды git
  }
  return null;
};

const repoPath =
  process.env.GITHUB_REPO_PATH || detectRepoPath() || 'Radik/portfolio';

export const config = {
  repoPath: repoPath,
  siteName: 'Radik.Dev',
  siteUrl: siteUrl, // 🔥 Добавили динамический URL для генератора Sitemap

  scssExtension,
  srcFolder,
  buildFolder,

  localServerFolder: 'C:/inetpub/wwwroot/portfolio',

  // ==========================================
  // СТРУКТУРА ПРОЕКТА ДЛЯ АВТОМАТИЗАЦИИ
  // ==========================================
  structure: {
    components: path.join(srcFolder, 'components'),
    modules: path.join(srcFolder, 'js', 'modules'),
    plugins: path.join(srcFolder, 'js', 'plugins'),
  },

  aliasPath: path.join(srcFolder, 'js'),

  // ==========================================
  // ПУТИ К ФАЙЛАМ ДЛЯ СБОРЩИКА GULP
  // ==========================================
  deploy: {
    src: `${buildFolder}/**/*`,
  },

  paths: {
    styles: {
      src: `${srcFolder}/scss/style.scss`,
      dest: `${buildFolder}/css/`,
      output: 'app.min.css',
    },
    scripts: {
      src: `${srcFolder}/js/app.ts`,
      dest: `${buildFolder}/js/`,
      output: 'app.min.js',
    },
    images: {
      src: `${srcFolder}/images/**/*`,
      dest: `${buildFolder}/images/`,
      svg: `${srcFolder}/images/**/*.svg`,
    },
    favicons: {
      src: `${srcFolder}/images/src/favicon.png`,
      dest: `${buildFolder}/images/favicons/`,
      htmlOutput: path.join(srcFolder, 'parts', 'favicon-links.html'),
    },
    fonts: {
      src: `${srcFolder}/fonts/src/**/*.{ttf,otf}`,
      dest: `${buildFolder}/fonts/`,
    },
  },

  // ==========================================
  // НАСТРОЙКИ ПЛАГИНОВ И ОПТИМИЗАЦИИ
  // ==========================================
  settings: {
    webpQuality: 70,
    imagemin: {
      jpeg: 75,
      png: 5,
    },
    autoprefixer: ['> 0.5%', 'last 2 versions', 'not dead'],
  },
};
