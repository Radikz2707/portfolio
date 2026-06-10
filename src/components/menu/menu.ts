export const menu = (): void => {
  console.log('Модуль навигационного меню (TS) инициализирован');

  // Строгая типизация DOM-элементов через дженерики querySelector
  const menuIcon = document.querySelector<HTMLElement>('.menu-icon');
  const menuBody = document.querySelector<HTMLElement>('.menu');

  // Явное указание типа NodeListOf для коллекции ссылок-якорей
  const anchors: NodeListOf<HTMLAnchorElement> =
    document.querySelectorAll<HTMLAnchorElement>("a[href*='#']");

  // Функция для принудительного закрытия меню
  const closeMenu = (): void => {
    if (menuIcon && menuBody && menuIcon.classList.contains('_active')) {
      document.body.classList.remove('_lock');
      menuIcon.classList.remove('_active');
      menuBody.classList.remove('_active');
    }
  };

  // 1. УПРАВЛЕНИЕ БУРГЕР-МЕНЮ НА СМАРТФОНАХ (С ЗАЩИТОЙ ОТ ДРЕБЕЗГА КЛИКОВ)
  if (menuIcon && menuBody) {
    let isClickBlocked = false;

    menuIcon.addEventListener('click', (e: MouseEvent): void => {
      e.stopPropagation();
      if (isClickBlocked) return;

      // Блокируем гонку частых кликов на 300мс (время анимации гамбургера)
      isClickBlocked = true;

      document.body.classList.toggle('_lock');
      menuIcon.classList.toggle('_active');
      menuBody.classList.toggle('_active');

      setTimeout(() => {
        isClickBlocked = false;
      }, 300);
    });
  }

  // 2. УНИВЕРСАЛЬНЫЙ СКРОЛЛ И ПЕРЕХОД МЕЖДУ СТРАНИЦАМИ
  anchors.forEach((anchor: HTMLAnchorElement) => {
    anchor.addEventListener('click', (e: Event): void => {
      const href: string | null = anchor.getAttribute('href');
      if (!href) return;

      // Проверяем, находимся ли мы в блоге (путь содержит '/blog/')
      const isBlogPage: boolean = window.location.pathname.includes('/blog/');

      if (isBlogPage) {
        // Если мы в блоге, отменять клик НЕ надо! Позволяем перейти на главную
        closeMenu();
        return;
      }

      // Если мы НА ГЛАВНОЙ странице, включаем плавный скролл
      e.preventDefault();

      // Извлекаем чистый ID секции, удаляя всё до знака '#' включительно
      const targetId: string = href.substring(href.indexOf('#') + 1);
      const targetSection: HTMLElement | null =
        document.getElementById(targetId);

      if (targetSection) {
        closeMenu();

        const headerElement = document.querySelector<HTMLElement>('.header');
        // Динамически высчитываем высоту шапки, если она изменилась (например, класс _scroll)
        const headerOffset: number = headerElement
          ? headerElement.offsetHeight
          : 80;

        const elementPosition: number =
          targetSection.getBoundingClientRect().top;
        const offsetPosition: number =
          elementPosition + window.scrollY - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    });
  });

  // 3. СТАБИЛЬНЫЙ СКРОЛЛ ПРИ ПЕРЕХОДЕ ИЗ БЛОГА НА ГЛАВНУЮ (БЕЗ СЛЕПЫХ ТАЙМАУТОВ)
  if (!window.location.pathname.includes('/blog/') && window.location.hash) {
    const handleInitialScroll = (): void => {
      const targetId: string = window.location.hash.replace('#', '');
      const targetSection: HTMLElement | null =
        document.getElementById(targetId);

      if (targetSection) {
        // requestAnimationFrame гарантирует, что браузер полностью построил Layout
        requestAnimationFrame(() => {
          const headerElement = document.querySelector<HTMLElement>('.header');
          const headerOffset: number = headerElement
            ? headerElement.offsetHeight
            : 80;

          const elementPosition: number =
            targetSection.getBoundingClientRect().top;
          const offsetPosition: number =
            elementPosition + window.scrollY - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
        });
      }
    };

    // Если страница еще загружается, ждем события полного рендеринга
    if (document.readyState === 'complete') {
      handleInitialScroll();
    } else {
      window.addEventListener('load', handleInitialScroll, { once: true });
    }
  }
};
