export const blogSidebar = (): void => {
  const sidebar = document.querySelector('.blog-sidebar');
  if (!sidebar) return;

  const categories = sidebar.querySelectorAll<HTMLDetailsElement>(
    '.blog-sidebar__category',
  );
  const sidebarLinks = sidebar.querySelectorAll<HTMLAnchorElement>(
    '.blog-sidebar__link',
  );
  const currentPath = window.location.pathname;

  // 1. 🔥 УМНАЯ ЛОГИКА АККОРДЕОНА: При старте всё закрыто, соседи закрываются сами
  categories.forEach((currentCategory) => {
    const summary = currentCategory.querySelector('summary');
    if (!summary) return;

    // Изначально выставляем доступность в false, так как всё закрыто
    summary.setAttribute('aria-expanded', 'false');

    summary.addEventListener('click', (_) => {
      // Нативный <details> переключает open ПОСЛЕ клика, проверяем текущее состояние
      const isCurrentlyOpen = currentCategory.hasAttribute('open');

      // 🎯 Если мы ОТКРЫВАЕМ категорию, автоматически захлопываем ВСЕ ОСТАЛЬНЫЕ
      if (!isCurrentlyOpen) {
        categories.forEach((otherCategory) => {
          if (otherCategory !== currentCategory) {
            otherCategory.removeAttribute('open');
            otherCategory
              .querySelector('summary')
              ?.setAttribute('aria-expanded', 'false');
          }
        });
        summary.setAttribute('aria-expanded', 'true');
      } else {
        summary.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // 2. АВТО-РАСКРЫТИЕ: Находим статью, которую сейчас читает пользователь
  sidebarLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = new URL(href, window.location.href).pathname;

    if (currentPath === linkPath) {
      link.classList.add('_active');
      link.setAttribute('aria-current', 'page');

      // 🎯 Находим только ту категорию, где находится активная статья, и открываем ЕЁ ОДНУ
      const parentCategory = link.closest<HTMLDetailsElement>(
        '.blog-sidebar__category',
      );
      if (parentCategory) {
        parentCategory.setAttribute('open', '');
        parentCategory
          .querySelector('summary')
          ?.setAttribute('aria-expanded', 'true');
      }
    }
  });
};
