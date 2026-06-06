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
projectsGrid();
aboutMe();
blogArticle();
blogSidebar();

// Интерактивные модули логики

scrollToTop();

console.log("TypeScript успешно запущен!");
