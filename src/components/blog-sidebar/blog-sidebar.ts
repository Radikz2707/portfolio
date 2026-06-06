export const blogSidebar = (): void => {
  console.log("Компонент боковой панели (TS) успешно инициализирован");

  // Находим все ссылки на статьи внутри нашего сайдбара
  const sidebarLinks = document.querySelectorAll<HTMLAnchorElement>(
    ".blog-sidebar__link",
  );

  // Получаем точный адрес текущей страницы в браузере (например, '/blog/why-gulp-ts.html')
  const currentPath = window.location.pathname;

  sidebarLinks.forEach((link) => {
    const linkHref = link.getAttribute("href");

    // Если адрес ссылки полностью совпадает с текущим адресом страницы
    if (linkHref && currentPath.includes(linkHref)) {
      // Подсвечиваем активную статью фиолетовым цветом и делаем жирнее
      link.style.color = "#6366f1";
      link.style.fontWeight = "700";
      // Добавляем атрибут для доступности (линтеры скажут спасибо)
      link.setAttribute("aria-current", "page");
    }
  });
};
