import path from "path";

// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ НАПРАВЛЕНИЙ
// ==========================================
const preprocessor = "scss";
const srcFolder = "src"; // Папка с исходными файлами
const buildFolder = "dist"; // Папка готовой сборки проекта

export const config = {
  preprocessor,
  srcFolder,
  buildFolder,

  // ==========================================
  // СТРУКТУРА ПРОЕКТА ДЛЯ АВТОМАТИЗАЦИИ
  // ==========================================
  structure: {
    components: path.join(srcFolder, "components"),
    modules: path.join(srcFolder, "js", "modules"),
    lessons: path.join(srcFolder, "js", "modules", "lessons"),
    plugins: path.join(srcFolder, "js", "plugins"),
  },

  // Корень для JS алиасов (используется в webpack и jsconfig)
  aliasPath: path.join(srcFolder, "js"),

  // ==========================================
  // ПУТИ К ФАЙЛАМ ДЛЯ СБОРЩИКА GULP
  // ==========================================
  paths: {
    styles: {
      src: `${srcFolder}/${preprocessor}/style.{sass,scss,less}`, // Оставляем glob-паттерн для Gulp
      dest: `${buildFolder}/css/`,
      output: "app.min.css",
    },
    scripts: {
      src: `${srcFolder}/js/app.ts`,
      dest: `${buildFolder}/js/`,
      output: "app.min.js",
    },
    images: {
      src: `${srcFolder}/images/src/**/*`,
      dest: `${buildFolder}/images/`,
      svg: `${srcFolder}/images/src/**/*.svg`,
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
    autoprefixer: ["> 0.5%", "last 2 versions", "not dead"],
  },

  // ==========================================
  // 🔥 КАРТА АВТОМАТИЧЕСКОГО СЛЕЖЕНИЯ ЗА ФАЙЛАМИ
  // ==========================================
  watchers: [
    { mask: "/**/*.html", task: "html" },
    { mask: "/content/blog/**/*.md", task: "blog" }, // <-- Наш блог
    { mask: "/fonts/src/**/*", task: "fonts" },
    { mask: "/components/**/*.{jpg,jpeg,png,svg,webp,gif}", task: "imagesDev" },
  ],
};
