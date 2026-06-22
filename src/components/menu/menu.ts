export function menu(): void {
  const menuBtn = document.querySelector<HTMLElement>('.menu-icon');
  const menuElement = document.querySelector<HTMLElement>('.menu');
  const menuLinks =
    document.querySelectorAll<HTMLAnchorElement>('.menu__link, .logo');

  if (!menuBtn || !menuElement) return;

  let isTransitioning = false;

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

  menuBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const targetSection = document.querySelector<HTMLElement>(targetId);

        if (targetSection) {
          // 🔥 ИСПРАВЛЕНО: Блокируем стандартный прыжок только если мы реально переходим по чистому якорю
          // или если мы УЖЕ находимся на главной странице, чтобы не срывать переходы браузера
          e.preventDefault();
          closeMenu();

          // Мягкая задержка для закрытия мобильной шторки меню
          setTimeout(() => {
            // 🔥 БРОНЕБОЙНЫЙ ИДЕАЛЬНЫЙ СКРОЛЛ: Больше никаких сложных расчетов пикселей!
            // Метод scrollIntoView сам с точностью до микрона опустит экран к нужной секции,
            // учитывая любые особенности рендеринга Windows, Mac, Chrome и Safari.
            targetSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });

            // Если у вас фиксированная шапка перекрывает верх секции, мы делаем микро-коррекцию скролла:
            const headerElement =
              document.querySelector<HTMLElement>('.header');
            if (headerElement) {
              const headerOffset = headerElement.offsetHeight;
              window.scrollBy(0, -headerOffset);
            }
          }, 50);
        } else {
          // Если элемент не найден на текущей странице (значит, мы в блоге) —
          // МЫ НЕ ВЫЗЫВАЕМ e.preventDefault()! Браузер спокойно улетит на главную страницу по href!
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
