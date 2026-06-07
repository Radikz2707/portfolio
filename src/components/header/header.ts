export const header = (): void => {
  const headerElement = document.querySelector<HTMLElement>(".header");

  if (!headerElement) return;

  const toggleHeaderScroll = (): void => {
    // Если прокрутили больше 20px, добавляем класс, иначе убираем
    if (window.scrollY > 20) {
      headerElement.classList.add("_scroll");
    } else {
      headerElement.classList.remove("_scroll");
    }
  };

  // Запускаем проверку сразу при загрузке (на случай, если страницу обновили посреди контента)
  toggleHeaderScroll();

  // Отслеживаем скролл
  window.addEventListener("scroll", toggleHeaderScroll);
};
