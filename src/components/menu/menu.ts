export const menu = (): void => {
  console.log("Модуль навигационного меню (TS) инициализирован");

  const menuIcon = document.querySelector(".menu-icon");
  const menuBody = document.querySelector(".menu");

  // 🔥 ИСПРАВЛЕНО: Теперь ищем все ссылки, которые СОДЕРЖАТ '#', а не только начинаются с неё
  const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href*='#']");

  // Функция для принудительного закрытия меню
  const closeMenu = (): void => {
    if (menuIcon && menuBody && menuIcon.classList.contains("_active")) {
      document.body.classList.remove("_lock");
      menuIcon.classList.remove("_active");
      menuBody.classList.remove("_active");
    }
  };

  // 1. УПРАВЛЕНИЕ БУРГЕР-МЕНЮ НА СМАРТФОНАХ
  if (menuIcon && menuBody) {
    menuIcon.addEventListener("click", () => {
      document.body.classList.toggle("_lock");
      menuIcon.classList.toggle("_active");
      menuBody.classList.toggle("_active");
    });
  }

  // 2. УНИВЕРСАЛЬНЫЙ СКРОЛЛ И ПЕРЕХОД МЕЖДУ СТРАНИЦАМИ
  anchors.forEach((anchor) => {
    anchor.addEventListener("click", (e: Event) => {
      const href = anchor.getAttribute("href");
      if (!href) return;

      // Проверяем, находимся ли мы в блоге (путь содержит '/blog/')
      const isBlogPage = window.location.pathname.includes("/blog/");

      if (isBlogPage) {
        // Если мы в блоге, отменять клик НЕ надо!
        // Позволяем браузеру совершить стандартный переход по ссылке на главную.
        closeMenu(); // На всякий случай закрываем меню перед уходом со страницы
        return;
      }

      // Если мы НА ГЛАВНОЙ странице, включаем наш фирменный плавный скролл
      e.preventDefault();

      // 🔥 ИСПРАВЛЕНО: Извлекаем чистый ID секции, удаляя всё до знака '#' включительно
      const targetId = href.substring(href.indexOf("#") + 1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        // 🔥 ДОБАВЛЕНО: Закрываем мобильное меню сразу при клике, чтобы увидеть анимацию скролла контента
        closeMenu();

        const headerOffset = 80;
        const elementPosition = targetSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth", // Добавит нативную плавность, если она не задана глобально в CSS
        });
      }
    });
  });

  // 3. ХИТРЫЙ ТРЮК: Если мы только что перешли из блога на главную по якорной ссылке
  if (!window.location.pathname.includes("/blog/") && window.location.hash) {
    // Ждем 300мс, пока страница полностью загрузится и прорисуется
    setTimeout(() => {
      const targetId = window.location.hash.replace("#", "");
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        const headerOffset = 80;
        const elementPosition = targetSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - headerOffset;

        window.scrollTo({
          top: offsetPosition,
        });
      }
    }, 300);
  }
};
