import path from 'path';
import { execSync } from 'child_process';

// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ НАПРАВЛЕНИЙ
// ==========================================
const scssExtension = 'scss';
const srcFolder = 'src'; // Папка с исходными файлами
const buildFolder = 'dist'; // Папка готовой сборки проекта

// ==========================================
// АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ РЕПОЗИТОРИЯ
// ==========================================
// Получаем полный путь к репозиторию (username/repo) для ссылок на GitHub
const detectRepoPath = () => {
  try {
    const remoteUrl = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    // Формат: https://github.com/username/repo.git или git@github.com:username/repo.git
    const match = remoteUrl.match(/github[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
    if (match) {
      // match[1] — имя пользователя, match[2] — имя репозитория
      return `${match[1]}/${match[2]}`;
    }
  } catch {
    // Если git не найден или ошибка — используем значение из конфига
  }
  return null;
};

// Получаем полный путь к репозиторию для ссылок на GitHub
// Приоритет: переменная окружения GITHUB_REPO_PATH, затем автоматическое определение, затем 'username/repo'
const repoPath =
  process.env.GITHUB_REPO_PATH || detectRepoPath() || 'Radik/portfolio';

export const config = {
  // Полный путь к репозиторию (username/repo) для ссылок на GitHub
  repoPath: repoPath,

  // Единая глобальная переменная названия вашего бренда
  siteName: 'Radik.Dev',

  scssExtension,
  srcFolder,
  buildFolder,

  // 💡 Добавляем путь к локальному серверу IIS для Windows (проект изолируем в подпапку portfolio)
  localServerFolder: 'C:/inetpub/wwwroot/portfolio',

  // ==========================================
  // СТРУКТУРА ПРОЕКТА ДЛЯ АВТОМАТИЗАЦИИ
  // ==========================================
  structure: {
    components: path.join(srcFolder, 'components'),
    modules: path.join(srcFolder, 'js', 'modules'),
    plugins: path.join(srcFolder, 'js', 'plugins'),
  },

  // Корень для JS алиасов (используется в webpack и jsconfig)
  aliasPath: path.join(srcFolder, 'js'),

  // ==========================================
  // ПУТИ К ФАЙЛАМ ДЛЯ СБОРЩИКА GULP
  // ==========================================

  // 💡 Добавляем централизованный путь для таска деплоя
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
    // Централизованные пути для генератора фавиконок
    favicons: {
      src: `${srcFolder}/images/src/favicon.png`, // Новый путь к исходнику
      dest: `${buildFolder}/images/favicons/`, // Папка назначения в dist
      htmlOutput: path.join(srcFolder, 'parts', 'favicon-links.html'), // Где лежит кусок разметки
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
