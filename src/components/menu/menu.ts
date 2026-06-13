function checkIsBlogPage(): boolean {
  // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Ловим любое упоминание слова blog в пути
  return window.location.pathname.toLowerCase().includes('blog');
}

export function menu(): void {
  const menuBtn = document.querySelector<HTMLElement>('.menu-btn');
  const menuElement = document.querySelector<HTMLElement>('.menu');
  const menuLinks =
    document.querySelectorAll<HTMLAnchorElement>('.menu__link, .logo');

  if (!menuBtn || !menuElement) return;

  const closeMenu = (): void => {
    menuBtn.classList.remove('active');
    menuElement.classList.remove('active');
    document.body.classList.remove('lock');
  };

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    menuElement.classList.toggle('active');
    document.body.classList.toggle('lock');
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', (e: MouseEvent) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const isAnchorLink = href.includes('#');
      const isBlogPage = checkIsBlogPage();

      // ЛОГИКА ДЛЯ СТРАНИЦ БЛОГА И СТАТЕЙ
      if (isBlogPage && isAnchorLink && href.length > 1) {
        const targetIdAnchor: string = href.substring(href.indexOf('#') + 1);
        const targetSection: HTMLElement | null =
          document.getElementById(targetIdAnchor);

        // Если это локальный якорь ОНЛАЙН на текущей странице статьи (например, содержание)
        if (targetSection) {
          e.preventDefault();
          closeMenu();
          const headerElement = document.querySelector<HTMLElement>('.header');
          const headerOffset: number = headerElement
            ? headerElement.offsetHeight
            : 80;
          const elementPosition: number =
            targetSection.getBoundingClientRect().top;
          const offsetPosition: number =
            elementPosition + window.scrollY - headerOffset;

          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          return;
        }

        // 🔥 ЖЕСТКИЙ РЕДИРЕКТ НА ГЛАВНУЮ: Уходим из папки /blog/ в корень сайта!
        e.preventDefault();
        closeMenu();

        // Перенаправляем строго на http://localhost:3000/#contacts (без index.html)
        window.location.href = `${window.location.origin}/#${targetIdAnchor}`;
        return;
      }

      // ОБЫЧНАЯ ЛОГИКА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ
      if (isAnchorLink) {
        e.preventDefault();
        closeMenu();

        if (href === '#') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const targetSection = document.querySelector<HTMLElement>(href);
        if (targetSection) {
          const headerElement = document.querySelector<HTMLElement>('.header');
          const headerOffset = headerElement ? headerElement.offsetHeight : 80;
          const elementPosition = targetSection.getBoundingClientRect().top;
          const offsetPosition =
            elementPosition + window.scrollY - headerOffset;

          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      } else {
        closeMenu();
      }
    });
  });

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      menuElement.classList.contains('active') &&
      !menuElement.contains(target) &&
      !menuBtn.contains(target)
    ) {
      closeMenu();
    }
  });
}
