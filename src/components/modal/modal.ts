export const modal = () => {
  // 🔥 СОХРАНЕНО: Стандартная строка вашего генератора компонентов
  console.log('Блок modal (TS) инициализирован');

  // НАЧАЛО ИНТЕРАКТИВНОЙ ЛОГИКИ МОДАЛЬНОГО ОКНА
  const triggers = document.querySelectorAll<HTMLElement>(
    '[data-modal-trigger]',
  );

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.getAttribute('data-modal-trigger');
      if (!modalId) return;

      const currentModal = document.getElementById(modalId);
      if (!currentModal) return;

      // Открываем модальное окно (добавляем наш БЭМ-класс)
      currentModal.classList.add('_active');
      currentModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('_lock'); // Блокируем скролл сайта

      // Функция плавного закрытия
      const closeModal = (): void => {
        currentModal.classList.remove('_active');
        currentModal.setAttribute('aria-hidden', 'true');

        // Убираем блокировку body, только если нет других открытых окон
        const activeModals = document.querySelectorAll('.modal._active');
        if (activeModals.length === 0) {
          document.body.classList.remove('_lock');
        }
      };

      // Навешиваем клик на элементы закрытия (оверлей, крестик, кнопка)
      const closeElements = currentModal.querySelectorAll('[data-close]');
      closeElements.forEach((el) => {
        el.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            closeModal();
          },
          { once: true },
        );
      });

      // Закрытие окна по нажатию на клавишу Escape
      const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  });
};
