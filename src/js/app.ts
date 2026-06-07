// 1. ИМПОРТЫ СИСТЕМНЫХ МОДУЛЕЙ И ХЕЛПЕРОВ
import { isWebp } from "@/modules/isWebp";

// 2. ИМПОРТЫ СТАТИЧЕСКИХ КОМПОНЕНТОВ
import { header } from "@comp/header/header"; // 🔥 ДОБАВИЛИ ИМПОРТ ШАПКИ САЙТА
import { hero } from "@comp/hero/hero";
import { projectsGrid } from "@comp/projects-grid/projects-grid";
import { aboutMe } from "@comp/about-me/about-me";
import { blogArticle } from "@comp/blog-article/blog-article";
import { scrollToTop } from "@/modules/scroll-to-top/scroll-to-top";
import { menu } from "@comp/menu/menu";
import { blogSidebar } from "@comp/blog-sidebar/blog-sidebar";
import { contacts } from "@comp/contacts/contacts";

// 3. ИМПОРТЫ ДИНАМИЧЕСКИХ JS/TS МОДУЛЕЙ

// ==========================================
// ВЫЗОВЫ ФУНКЦИЙ (В порядке их инициализации)
// ==========================================

// Сервисные утилиты
isWebp();

// Компоненты структуры сайта
header();
menu();
hero();

// 🔥 ИСПРАВЛЕНО: Запуск анимационных модулей с микрозадержкой 100мс.
// Это гарантирует, что IntersectionObserver увидит элементы после перерендеринга DOM.
setTimeout(() => {
  projectsGrid();
  aboutMe();
}, 100);

blogArticle();
blogSidebar();
contacts();

// Интерактивные модули логики
scrollToTop();

console.log("TypeScript успешно запущен!");

// 🔥 ЗАЩИТА АВТОРСКИХ ПРАВ: Блокировка копирования и скачивания
document.addEventListener("contextmenu", (e: Event) => e.preventDefault()); // Блокируем правую кнопку мыши

document.addEventListener("keydown", (e: KeyboardEvent) => {
  // 🔥 ИСПРАВЛЕНО: Все одинарные кавычки заменены на двойные по правилам ESLint
  if (
    e.key === "F12" || 
    (e.ctrlKey && (e.key === "s" || e.key === "u" || e.key === "S" || e.key === "U"))
  ) {
    e.preventDefault();
    return false;
  }
});



