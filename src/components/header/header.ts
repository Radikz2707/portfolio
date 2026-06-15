let activeScrollListener: (() => void) | null = null;

export const header = (): void => {
  const headerElement = document.querySelector<HTMLElement>('.header');
  if (!headerElement) return;

  const toggleHeaderScroll = (): void => {
    const isScrolled = window.scrollY > 20;

    // 🔥 Исправлено: Мутируем DOM только в момент реального изменения состояния
    if (isScrolled && !headerElement.classList.contains('_scroll')) {
      headerElement.classList.add('_scroll');
    } else if (!isScrolled && headerElement.classList.contains('_scroll')) {
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
