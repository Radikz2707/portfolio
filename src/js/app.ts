// 1. ИМПОРТЫ СИСТЕМНЫХ МОДУЛЕЙ И ХЕЛПЕРОВ
import { isWebp } from './modules/isWebp';

// 2. ИМПОРТЫ СТАТИЧЕСКИХ КОМПОНЕНТОВ
import { header } from '../components/header/header';
import { hero } from '../components/hero/hero';
import { projectsGrid } from '../components/projects-grid/projects-grid';
import { aboutMe } from '../components/about-me/about-me';
import { blogArticle } from '../components/blog-article/blog-article';
import { scrollToTop } from './modules/scroll-to-top/scroll-to-top';
import { menu } from '../components/menu/menu';
import { blogSidebar } from '../components/blog-sidebar/blog-sidebar';
import { contacts } from '../components/contacts/contacts';
import { footer } from '../components/footer/footer';
import { main } from '../components/main/main';

// ==========================================
// ВЫЗОВЫ ФУНКЦИЙ (В порядке их инициализации)
// ==========================================

// Сервисные утилиты
isWebp();

// Компоненты структуры сайта
header();
menu();
hero();

// Запуск анимационных модулей с микрозадержкой 100мс.
// Это гарантирует, что IntersectionObserver увидит элементы после перерендеринга DOM.
setTimeout(() => {
  projectsGrid();
  aboutMe();
}, 100);

blogArticle();
blogSidebar();
contacts();
footer();
main();

// Интерактивные модули логики
scrollToTop();

console.log('TypeScript успешно запущен!');

// 🔥 ЗАЩИТА АВТОРСКИХ ПРАВ: Блокировка копирования и скачивания
document.addEventListener('contextmenu', (e: Event) => e.preventDefault());

document.addEventListener('keydown', (e: KeyboardEvent): void => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey &&
      (e.key === 's' || e.key === 'u' || e.key === 'S' || e.key === 'U'))
  ) {
    e.preventDefault();
  }
});
