export const blogCategories = (): void => {
  console.log('Блок blog-categories (TS) инициализирован');

  const categoryCards = document.querySelectorAll<HTMLElement>(
    '.blog-category-card',
  );
  if (categoryCards.length === 0) return;

  categoryCards.forEach((card) => {
    const header = card.querySelector<HTMLDivElement>(
      '.blog-category-card__header',
    );
    const list = card.querySelector<HTMLUListElement>(
      '.blog-category-card__list',
    );

    if (!header || !list) {
      console.warn('Не найдены необходимые элементы в карточке', card);
      return;
    }

    const title =
      header.querySelector('.blog-category-card__title')?.textContent?.trim() ||
      '';

    header.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = list.classList.contains('_open');
      console.log(`Клик по категории "${title}", сейчас открыта: ${isOpen}`);

      if (
        list.style.transition.includes('height') ||
        card.dataset.animating === 'true'
      ) {
        return;
      }
      card.dataset.animating = 'true';

      if (isOpen) {
        list.style.height = `${list.scrollHeight}px`;
        list.style.overflow = 'hidden';

        requestAnimationFrame(() => {
          list.style.transition = 'height 300ms ease';
          list.style.height = '0px';
        });

        setTimeout(() => {
          list.classList.remove('_open');
          header.setAttribute('aria-expanded', 'false');
          list.style.height = '';
          list.style.overflow = '';
          list.style.transition = '';
          card.dataset.animating = 'false';
        }, 300);
      } else {
        // Закрываем другие открытые карточки
        categoryCards.forEach((otherCard) => {
          if (otherCard !== card) {
            const otherHeader = otherCard.querySelector<HTMLDivElement>(
              '.blog-category-card__header',
            );
            const otherList = otherCard.querySelector<HTMLUListElement>(
              '.blog-category-card__list',
            );

            if (
              otherList &&
              otherList.classList.contains('_open') &&
              otherHeader
            ) {
              otherCard.dataset.animating = 'true';
              otherList.style.height = `${otherList.scrollHeight}px`;

              requestAnimationFrame(() => {
                otherList.style.transition = 'height 300ms ease';
                otherList.style.height = '0px';
              });

              setTimeout(() => {
                otherList.classList.remove('_open');
                otherHeader.setAttribute('aria-expanded', 'false');
                otherList.style.height = '';
                otherList.style.transition = '';
                otherCard.dataset.animating = 'false';
              }, 300);
            }
          }
        });

        // Открываем текущую карточку
        list.classList.add('_open');
        header.setAttribute('aria-expanded', 'true');

        const targetHeight = list.scrollHeight;
        list.style.height = '0px';
        list.style.overflow = 'hidden';

        requestAnimationFrame(() => {
          list.style.transition = 'height 300ms ease';
          list.style.height = `${targetHeight}px`;
        });

        setTimeout(() => {
          list.style.height = '';
          list.style.overflow = '';
          list.style.transition = '';
          card.dataset.animating = 'false';
        }, 300);
      }
    });
  });
};
