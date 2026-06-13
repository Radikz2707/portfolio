export function menu(): void {
  // 🔥 ИСПРАВЛЕНО: Ищем кнопку по реальному классу .menu-icon из вашей разметки
  const menuBtn = document.querySelector<HTMLElement>('.menu-icon');
  const menuElement = document.querySelector<HTMLElement>('.menu');
  const menuLinks =
    document.querySelectorAll<HTMLAnchorElement>('.menu__link, .logo');

  if (!menuBtn || !menuElement) return;

  // Используем БЭМ-классы с нижним подчеркиванием из вашего SCSS
  const closeMenu = (): void => {
    menuBtn.classList.remove('_active');
    menuElement.classList.remove('_active');
    document.body.classList.remove('_lock');
  };

  // Переключение гамбургера с защитой от всплытия событий
  menuBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
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

        // Защита от пустого селектора "#"
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

        // Если секция найдена на текущей странице (плавный скролл)
        if (targetSection) {
          e.preventDefault();
          closeMenu();

          const headerElement = document.querySelector<HTMLElement>('.header');
          const headerOffset = headerElement ? headerElement.offsetHeight : 80;
          const elementPosition = targetSection.getBoundingClientRect().top;
          const offsetPosition =
            elementPosition + window.scrollY - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
        }
        // Если секции нет на странице (уходим из блога на главную)
        else {
          closeMenu();
        }
      } else {
        // Обычные ссылки без якоря
        closeMenu();
      }
    });
  });

  // Безопасное закрытие меню при клике вне области
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
