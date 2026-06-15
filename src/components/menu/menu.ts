export function menu(): void {
  const menuBtn = document.querySelector<HTMLElement>('.menu-icon');
  const menuElement = document.querySelector<HTMLElement>('.menu');
  const menuLinks =
    document.querySelectorAll<HTMLAnchorElement>('.menu__link, .logo');

  if (!menuBtn || !menuElement) return;

  // 🔥 Флаг блокировки дребезга кликов
  let isTransitioning = false;

  // Защита: сбрасываем флаг, когда шторка меню полностью закончила движение в CSS
  menuElement.addEventListener('transitionend', (e: TransitionEvent) => {
    if (e.target === menuElement) {
      isTransitioning = false;
    }
  });

  const closeMenu = (): void => {
    menuBtn.classList.remove('_active');
    menuElement.classList.remove('_active');
    document.body.classList.remove('_lock');
  };

  // Переключение гамбургера с защитой от race condition
  menuBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();

    // 🔥 Если анимация еще идет — полностью игнорируем клик
    if (isTransitioning) return;

    isTransitioning = true;
    menuBtn.classList.toggle('_active');
    menuElement.classList.toggle('_active');
    document.body.classList.toggle('_lock');
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', (e: MouseEvent) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const hasHash = href.includes('#');

      if (hasHash) {
        const targetId = href.substring(href.indexOf('#'));

        if (targetId === '#') {
          e.preventDefault();
          closeMenu();
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
          return;
        }

        const targetSection = document.querySelector<HTMLElement>(targetId);

        if (targetSection) {
          e.preventDefault();

          // 🔥 Сначала закрываем интерфейс меню, но даем Safari 50мс на корректный запуск smooth scroll
          closeMenu();

          setTimeout(() => {
            const headerElement =
              document.querySelector<HTMLElement>('.header');
            const headerOffset = headerElement
              ? headerElement.offsetHeight
              : 80;
            const elementPosition = targetSection.getBoundingClientRect().top;
            const offsetPosition =
              elementPosition + window.scrollY - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth',
            });
          }, 50);
        } else {
          closeMenu();
        }
      } else {
        closeMenu();
      }
    });
  });

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (
      menuElement.classList.contains('_active') &&
      !menuElement.contains(target) &&
      !menuBtn.contains(target) &&
      target !== menuBtn
    ) {
      closeMenu();
    }
  });
}
