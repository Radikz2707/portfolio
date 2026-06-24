// ==========================================
// 📦 ВНЕШНИЕ БИБЛИОТЕКИ И СИСТЕМНЫЕ МОДУЛИ
// ==========================================
import AOS from 'aos';
import { isWebp } from './modules/isWebp';
import { themeToggle } from './modules/theme-toggle/theme-toggle';
import { scrollToTop } from './modules/scroll-to-top/scroll-to-top';

// ==========================================
// 🧩 КОМПОНЕНТЫ И ИНТЕРФЕЙСНЫЕ БЛОКИ
// ==========================================
import { autotestComponent } from '../components/autotest-component/autotest-component';
import { header } from '../components/header/header';
import { menu } from '../components/menu/menu';
import { modal } from '../components/modal/modal';
import { blogSidebar } from '../components/blog-sidebar/blog-sidebar';
import { blogCategories } from '../components/blog-categories/blog-categories';
import { contacts } from '../components/contacts/contacts';
import { aboutMe } from '../components/about-me/about-me';
import { projectsGrid } from '../components/projects-grid/projects-grid';

// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ БАЗОВЫХ МОДУЛЕЙ
// ==========================================
isWebp();
header();
menu();
modal();
scrollToTop();
themeToggle();
// [ДИНАМИЧЕСКИЕ МОДУЛИ]

// 🔥 ОПРЕДЕЛЕНИЕ ТИПА СТРАНИЦЫ
const isBlogPage =
  window.location.pathname.includes('/blog/') ||
  window.location.href.includes('/blog/') ||
  document.body.classList.contains('page-blog') ||
  !!document.querySelector('.blog-sidebar');

// ==========================================
// 2. ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ
// ==========================================
const initApp = () => {
  // Добавляем класс готовности для CSS-анимаций
  document.body.classList.add('_js-ready');

  if (isBlogPage) {
    blogSidebar();
    blogCategories();
    // [ВЫЗОВЫ БЛОГ]
  } else {
    contacts();
    aboutMe();
    projectsGrid();
    // [ВЫЗОВЫ ГЛАВНАЯ]
  }

  // Инициализация AOS и активация видимых элементов

  // [ВЫЗОВЫ ГЛАВНАЯ]ебольшая задержка дает браузеру время на финальный рендеринг
  setTimeout(() => {
    AOS.init({
      duration: 800,
      once: true,
    });

    // Принудительно активируем элементы в зоне видимости
    const revealElements = document.querySelectorAll(
      '.element-reveal, .element-reveal-left',
    );
    revealElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.2) {
        el.classList.add('_active');
      }
    });

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
  }, 200);
};

// [ВЫЗОВЫ ГЛАВНАЯ]апуск при полной загрузке всех ресурсов
if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', initApp);
}

// ==========================================
// 3. ЗАЩИТА КОНТЕНТА
// ==========================================
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

console.log('🚀 Radik.Dev: TypeScript успешно инициализирован');
