export const blogSidebar = (): void => {
  const sidebar = document.querySelector('.blog-sidebar');
  if (!sidebar) return;

  // Находим нативные элементы summary и детализированные блоки
  const categories = sidebar.querySelectorAll<HTMLDetailsElement>(
    '.blog-sidebar__category',
  );
  const sidebarLinks = sidebar.querySelectorAll<HTMLAnchorElement>(
    '.blog-sidebar__link',
  );
  const currentPath = window.location.pathname;

  // 1. Умная логика аккордеона на нативных тегах
  categories.forEach((currentCategory) => {
    const summary = currentCategory.querySelector('summary');
    if (!summary) return;
    summary.addEventListener('click', (_) => {
      const isCurrentlyOpen = currentCategory.hasAttribute('open');

      // Закрываем все остальные категории, кроме той, по которой кликнули
      categories.forEach((otherCategory) => {
        if (otherCategory !== currentCategory) {
          otherCategory.removeAttribute('open');
          const otherSummary = otherCategory.querySelector('summary');
          otherSummary?.setAttribute('aria-expanded', 'false');
        }
      });

      // Переключаем состояние текущей категории
      if (isCurrentlyOpen) {
        summary.setAttribute('aria-expanded', 'false');
      } else {
        summary.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // 2. Подсветка активной ссылки и автоматическое раскрытие нужного details
  sidebarLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = new URL(href, window.location.href).pathname;

    if (currentPath === linkPath) {
      link.classList.add('_active');
      link.setAttribute('aria-current', 'page');

      // Находим ближайший родительский тег <details> и нативно открываем его
      const parentCategory = link.closest<HTMLDetailsElement>(
        '.blog-sidebar__category',
      );
      if (parentCategory) {
        parentCategory.setAttribute('open', '');
        const currentSummary = parentCategory.querySelector('summary');
        currentSummary?.setAttribute('aria-expanded', 'true');
      }
    }
  });
};
