import { modal } from '../components/modal/modal';
import AOS from 'aos';

import { isWebp } from './modules/isWebp';
import { scrollToTop } from './modules/scroll-to-top/scroll-to-top';
import { menu } from '../components/menu/menu';
import { blogSidebar } from '../components/blog-sidebar/blog-sidebar';
import { contacts } from '../components/contacts/contacts';
import { aboutMe } from '../components/about-me/about-me';
import { projectsGrid } from '../components/projects-grid/projects-grid';
import { themeToggle } from './modules/theme-toggle/theme-toggle';

// ==========================================
// ВЫЗОВЫ ФУНКЦИЙ (В порядке их инициализации)
// ==========================================
isWebp();
menu();
modal();
scrollToTop();
themeToggle();

// Инициализация с небольшой задержкой для корректного расчета координат
setTimeout(() => {
  AOS.init({
    duration: 800,
    once: true,
  });

  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
}, 100);

// 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Определяем, где находится пользователь
const isBlogPage =
  window.location.pathname.includes('/blog/') ||
  document.body.classList.contains('page-blog');

// Асинхронная обёртка для ленивой загрузки динамических чанков страниц
(async () => {
  if (isBlogPage) {
    // Запускаем скрипты СТРОГО на страницах блога и статей
    blogSidebar();
    console.log('Скрипты блога успешно инициализированы.');
  } else {
    // Запускаем скрипты СТРОГО на ГЛАВНОЙ странице портфолио
    contacts();
    aboutMe();
    projectsGrid();
    console.log('Скрипты главных разделов портфолио успешно инициализированы.');
  }

  // 🔥 ФИКС: Принудительно вызываем события скролла и ресайза,
  // чтобы IntersectionObserver и AOS увидели элементы сразу после загрузки
  setTimeout(() => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
  }, 100);
})();

console.log('TypeScript успешно запущен!');

// ЗАЩИТА АВТОРСКИХ ПРАВ
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
