export const projectsGrid = (): void => {
  console.log('Компонент проектов (TS) инициализирован');

  // Находим заголовки и сами карточки проектов внутри этой секции
  const revealElements = document.querySelectorAll(
    '.projects-grid__title, .projects-grid__subtitle, .card-project',
  );

  if (revealElements.length === 0) return;

  // Настройки наблюдателя
  const observerOptions: IntersectionObserverInit = {
    root: null, // Отслеживаем относительно экрана
    rootMargin: '0px', // Срабатывает сразу при появлении
    threshold: 0, // Срабатывает, как только показался хотя бы 1 пиксель
  };

  const observerCallback = (
    entries: IntersectionObserverEntry[],
    observer: IntersectionObserver,
  ): void => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Добавляем класс _active, который запускает CSS-анимацию
        entry.target.classList.add('_active');

        // Отключаем слежку, чтобы анимация не переигрывалась при каждом скролле
        observer.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);

  // Запускаем наблюдение за каждым элементом секции
  revealElements.forEach((element) => {
    observer.observe(element);

    // 🔥 ДОБАВЛЕНО: Страховка на случай резкого прыжка к секции из блога!
    // Если элемент в момент загрузки страницы уже находится выше нижней границы экрана,
    // мы мгновенно активируем его, чтобы он не остался невидимым.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      element.classList.add('_active');
      observer.unobserve(element);
    }
  });

  // Дополнительная проверка после полной загрузки страницы
  window.addEventListener('load', () => {
    revealElements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight) {
        element.classList.add('_active');
        observer.unobserve(element);
      }
    });
  }, { once: true });
};
