export const blogSidebar = (): void => {
  const sidebar = document.querySelector('.blog-sidebar');
  if (!sidebar) return;

  const categoryBtns = sidebar.querySelectorAll<HTMLButtonElement>('.blog-sidebar__category-btn');
  const sidebarLinks = sidebar.querySelectorAll<HTMLAnchorElement>('.blog-sidebar__link');
  const currentPath = window.location.pathname;

  // 1. Логика аккордеона
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sublist = btn.nextElementSibling as HTMLElement;
      const isOpen = sublist.classList.contains('_open');

      // Закрываем все другие категории при открытии новой (аккордеон)
      sidebar.querySelectorAll('.blog-sidebar__sublist').forEach(el => {
        if (el !== sublist) {
          el.classList.remove('_open');
        }
      });
      sidebar.querySelectorAll('.blog-sidebar__category-btn').forEach(el => {
        if (el !== btn) {
          el.classList.remove('_active');
        }
      });

      if (isOpen) {
        sublist.classList.remove('_open');
        btn.classList.remove('_active');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        sublist.classList.add('_open');
        btn.classList.add('_active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // 2. Подсветка активной ссылки и авто-раскрытие категории
  sidebarLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Проверяем, совпадает ли ссылка с текущим URL
    // Учитываем, что ссылки могут быть относительными (../category/file.html)
    const linkPath = new URL(href, window.location.href).pathname;

    if (currentPath === linkPath) {
      link.classList.add('_active');
      link.setAttribute('aria-current', 'page');

      // Раскрываем родительскую категорию
      const parentSublist = link.closest('.blog-sidebar__sublist');
      if (parentSublist) {
        parentSublist.classList.add('_open');
        const parentBtn = parentSublist.previousElementSibling as HTMLElement;
        if (parentBtn) {
          parentBtn.classList.add('_active');
          parentBtn.setAttribute('aria-expanded', 'true');
        }
      }
    }
  });
};
