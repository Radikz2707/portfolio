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

  // 🔥 ИСПРАВЛЕНО: Скрипт больше СЛЕДОМ НЕ БЛОКИРУЕТ КЛИКИ ЧЕРЕЗ preventDefault!
  menuLinks.forEach((link) => {
    link.addEventListener('click', () => {
      // При клике на любую ссылку мы просто аккуратно прячем мобильную бургер-шторку,
      // а сам переход по ссылке или скролл к якорю выполняет сам браузер!
      closeMenu();
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
