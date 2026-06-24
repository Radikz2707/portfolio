export const aboutMe = (): void => {
  // 🔥 Лог для отладки: вы увидите его в консоли!
  console.log('Блок about-me (TS) инициализирован');

  // Находим элементы анимации внутри секции "О себе"
  const revealElements = document.querySelectorAll(
    '.element-reveal, .element-reveal-left',
  );

  if (revealElements.length === 0) {
    console.log('Элементы для анимации не найдены');
    return;
  }

  console.log(`Найдено элементов для анимации: ${revealElements.length}`);

  // Используем относительную позицию, чтобы работать корректно в подпапках
  const observerOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px 0px',
    threshold: 0,
  };

  const observerCallback = (
    entries: IntersectionObserverEntry[],
    observer: IntersectionObserver,
  ): void => {
    entries.forEach((entry) => {
      // Исправлено: используем isIntersecting и относительную позицию
      if (entry.isIntersecting || entry.boundingClientRect.top <= window.innerHeight) {
        console.log(`Элемент ${entry.target.classList[0]} стал видимым`);
        entry.target.classList.add('_active');
        observer.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);

  revealElements.forEach((element) => {
    observer.observe(element);
  });

  // 🔥 ИСПРАВЛЕНО: Проверяем видимость сразу после загрузки страницы
  // Это критично для работы в подпапках (например, /portfolio/)
  window.addEventListener(
    'load',
    () => {
      console.log('Проверка видимости элементов после загрузки страницы');
      revealElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;

        console.log(
          `Элемент "${element.className}": top=${rect.top}, height=${windowHeight}, visible=${rect.top < windowHeight}`
        );

        // Если элемент находится в верхней половине экрана или выше, активируем его
        if (rect.top < windowHeight * 0.8) {
          element.classList.add('_active');
        }
      });
    },
    { once: true },
  );
};
