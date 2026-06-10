import path from 'path';

// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ НАПРАВЛЕНИЙ
// ==========================================
const preprocessor = 'scss';
const srcFolder = 'src'; // Папка с исходными файлами
const buildFolder = 'dist'; // Папка готовой сборки проекта

export const config = {
  // Имя удаленного репозитория на GitHub для автоматизации ссылок
  repoName: null,

  preprocessor,
  srcFolder,
  buildFolder,

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
  paths: {
    styles: {
      src: `${srcFolder}/${preprocessor}/style.{sass,scss,less}`,
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
    // 🔥 ДОБАВЛЕНО: Централизованные пути для генератора фавиконок
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

  // ==========================================
  // КАРТА АВТОМАТИЧЕСКОГО СЛЕЖЕНИЯ ЗА ФАЙЛАМИ
  // ==========================================
  watchers: [
    { mask: '/**/*.html', task: 'html' },
    { mask: '/content/blog/**/*.md', task: 'blog' },
    { mask: '/fonts/src/**/*', task: 'fonts' },
    { mask: '/components/**/*.{jpg,jpeg,png,svg,webp,gif}', task: 'imagesDev' },
  ],
};
