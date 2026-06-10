let activeScrollListener: (() => void) | null = null;

export const header = (): void => {
  const headerElement = document.querySelector<HTMLElement>('.header');
  if (!headerElement) return;

  const toggleHeaderScroll = (): void => {
    if (window.scrollY > 20) {
      headerElement.classList.add('_scroll');
    } else {
      headerElement.classList.remove('_scroll');
    }
  };

  // Удаляем старый слушатель, предотвращая утечку памяти и дублирование событий
  if (activeScrollListener) {
    window.removeEventListener('scroll', activeScrollListener);
  }

  toggleHeaderScroll();
  window.addEventListener('scroll', toggleHeaderScroll);
  activeScrollListener = toggleHeaderScroll;
};
