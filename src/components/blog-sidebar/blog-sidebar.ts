export const blogSidebar = (): void => {
  console.log('Компонент боковой панели (TS) успешно инициализирован');

  // Находим все ссылки на статьи внутри нашего сайдбара
  const sidebarLinks = document.querySelectorAll<HTMLElement>('.blog-sidebar__link');

  // Получаем только имя текущего открытого HTML-файла (например, "why-gulp-ts.html")
  const currentFileName =
    window.location.pathname.split('/').pop() || 'index.html';

  sidebarLinks.forEach((link: HTMLElement) => {
    const linkHref = link.getAttribute('href');
    if (!linkHref) return;

    // Вытаскиваем имя файла из самой ссылки (очищаем от возможных точек и папок)
    const linkFileName = linkHref.split('/').pop();

    // Если имя файла в ссылке и имя файла в браузере полностью совпали
    if (linkFileName === currentFileName) {
      // 1. Подсвечиваем активную статью фиолетовым цветом и делаем жирнее
      link.style.color = '#6366f1';
      link.style.fontWeight = '700';

      // 2. БЛОКИРОВКА КЛИКА: меняем курсор на обычный и полностью отключаем кликабельность
      link.style.cursor = 'default';
      link.style.pointerEvents = 'none';

      // На всякий случай удаляем сам href, чтобы ссылку нельзя было активировать с клавиатуры
      link.removeAttribute('href');

      // 3. Добавляем атрибут для доступности
      link.setAttribute('aria-current', 'page');
    }
  });
};
