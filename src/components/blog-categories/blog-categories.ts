export const blogCategories = (): void => {
  console.log('Блок blog-categories (TS) инициализирован');

  const categoryCards = document.querySelectorAll<HTMLElement>(
    '.blog-category-card',
  );
  if (categoryCards.length === 0) return;

  categoryCards.forEach((card) => {
    const header = card.querySelector<HTMLElement>(
      '.blog-category-card__header',
    );
    const list = card.querySelector<HTMLElement>('.blog-category-card__list');

    if (!header || !list) return;

    header.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = list.classList.contains('_open');

      if (isOpen) {
        list.classList.remove('_open');
        header.setAttribute('aria-expanded', 'false');

        // Схлопываем обратно на мобильных
        list.style.height = '0px';
      } else {
        // Закрываем все остальные открытые карточки на странице
        categoryCards.forEach((otherCard) => {
          if (otherCard !== card) {
            const otherHeader = otherCard.querySelector<HTMLElement>(
              '.blog-category-card__header',
            );
            const otherList = otherCard.querySelector<HTMLElement>(
              '.blog-category-card__list',
            );

            if (otherList && otherHeader) {
              otherList.classList.remove('_open');
              otherHeader.setAttribute('aria-expanded', 'false');
              otherList.style.height = '0px';
            }
          }
        });

        // 🔥 ИСПРАВЛЕНО ДЛЯ IIS: Перебиваем инлайновые стили HTML-шаблона
        list.classList.add('_open');
        header.setAttribute('aria-expanded', 'true');

        // Разрешаем элементу принять его честную высоту из CSS
        list.style.height = 'auto';
      }
    });
  });
};
