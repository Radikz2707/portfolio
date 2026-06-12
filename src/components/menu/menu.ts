export const menu = (): void => {
  console.log('Модуль навигационного меню (TS) инициализирован');

  // Строгая типизация DOM-элементов через дженерики querySelector
  const menuIcon = document.querySelector<HTMLElement>('.menu-icon');
  const menuBody = document.querySelector<HTMLElement>('.menu');

  // Явное указание типа NodeListOf для коллекции ссылок-якорей
  // 🔥 ИСПРАВЛЕНО: Ищем ВСЕ ссылки, включая те, что без # (например, ./why-gulp-ts.html)
  const anchors: NodeListOf<HTMLAnchorElement> =
    document.querySelectorAll<HTMLAnchorElement>('a[href]');

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

  // 2. ФУНКЦИЯ ДЛЯ ПРОВЕРКИ, НАХОДИМСЯ ЛИ МЫ В БЛОГЕ
  const checkIsBlogPage = (): boolean => {
    return /\/blog\//.test(window.location.pathname);
  };

  // 3. ФУНКЦИЯ ДЛЯ ВЫДЕЛЕНИЯ АКТИВНОГО ПУНКТА МЕНЮ
  const highlightActiveMenu = (): void => {
    const isBlogPage = checkIsBlogPage();
    anchors.forEach((anchor: HTMLAnchorElement) => {
      const href: string | null = anchor.getAttribute('href');
      if (!href) return;

      // Если мы на странице блога, выделяем пункт "Блог" (GO_BLOG)
      if (isBlogPage && href.includes('GO_BLOG')) {
        anchor.classList.add('_active');
      }

      // Если мы на странице блога и это якорная ссылка (например, #contacts), выделяем соответствующий пункт
      if (isBlogPage && href.startsWith('#') && href.length > 1) {
        const targetIdMain: string = href.substring(href.indexOf('#') + 1);
        if (window.location.hash === '#' + targetIdMain) {
          anchor.classList.add('_active');
        }
      }
    });
  };

  // Выполняем выделение при инициализации
  highlightActiveMenu();

  // 3. УНИВЕРСАЛЬНЫЙ СКРОЛЛ И ПЕРЕХОД МЕЖДУ СТРАНИЦАМИ
  anchors.forEach((anchor: HTMLAnchorElement) => {
    anchor.addEventListener('click', (e: Event): void => {
      const href: string | null = anchor.getAttribute('href');
      if (!href) return;

      // ✅ ДОБАВЛЕНО: Если ссылка ведёт на index.html (с относительным путём или без),
      // мы НЕ отменяем клик! Позволяем браузеру просто перезагрузить/открыть главную страницу.
      // Проверяем как простой index.html, так и относительные пути (../index.html, ./index.html)
      const isIndexLink = href === 'index.html' || href === '/index.html' || href.endsWith('/index.html') || href.endsWith('index.html');
      if (isIndexLink) {
        closeMenu();
        return;
      }

      // 🔥 ИСПРАВЛЕНО: Если ссылка ведёт на blog/index.html, разрешаем переход
      const isBlogLink = href.includes('blog/index.html') || href === 'blog/index.html';
      if (isBlogLink) {
        closeMenu();
        return;
      }

      // 🔥 ИСПРАВЛЕНО: Проверяем, является ли ссылка якорной (внутренней навигацией)
      const isAnchorLink: boolean = href.startsWith('#');

      // 🔥 ИСПРАВЛЕНО: Блокировка кликов внутри блога только для якорных ссылок
      // (чтобы не переключать секции внутри одной статьи)
      const isBlogPage = checkIsBlogPage();

      // 🔥 ИСПРАВЛЕНО: Разрешаем переход по якорным ссылкам (например, #contacts) при нахождении в блоге
      // Блокируем только если это пустая якорная ссылка (#) или если цель не найдена
      if (isBlogPage && isAnchorLink && href.length > 1) {
        const targetIdAnchor: string = href.substring(href.indexOf('#') + 1);
        const targetSection: HTMLElement | null =
          document.getElementById(targetIdAnchor);

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

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
        }
        return;
      }

      // 🔥 ИСПРАВЛЕНО: Если это не якорная ссылка и не index.html, разрешаем переход
      // (включая ссылки на другие статьи блога вида blog/why-gulp-ts.html)
      if (!isAnchorLink) {
        closeMenu();
        return;
      }

      // "Если мы НА ГЛАВНОЙ странице и это якорная ссылка" (содержит #), включаем плавный скролл
      e.preventDefault();

      const targetIdMain: string = href.substring(href.indexOf('#') + 1);
      const targetSection: HTMLElement | null =
        document.getElementById(targetIdMain);

      if (targetSection) {
        closeMenu();
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
      }
    });
  });

  // 4. СТАБИЛЬНЫЙ СКРОЛЛ ПРИ ПЕРЕХОДЕ ИЗ БЛОГА НА ГЛАВНУЮ (БЕЗ СЛЕПЫХ ТАЙМАУТОРОВ)
  if (!checkIsBlogPage() && window.location.hash) {
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

    // Если страница еще загружается, ждем событие полного рендеринга
    if (document.readyState === 'complete') {
      handleInitialScroll();
    } else {
      window.addEventListener('load', handleInitialScroll, { once: true });
    }
  }
};
