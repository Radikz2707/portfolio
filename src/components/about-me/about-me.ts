export const aboutMe = (): void => {
  // 🔥 Ваш изначальный лог на месте — вы увидите его в консоли!
  console.log("Блок about-me (TS) инициализирован");

  // Находим элементы анимации внутри секции "О себе"
  const revealElements = document.querySelectorAll(
    ".element-reveal, .element-reveal-left",
  );

  if (revealElements.length === 0) return;

  const observerOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: "0px",
    threshold: 0.05,
  };

  const observerCallback = (
    entries: IntersectionObserverEntry[],
    observer: IntersectionObserver,
  ): void => {
    entries.forEach((entry) => {
      if (
        entry.isIntersecting ||
        entry.boundingClientRect.top < window.innerHeight
      ) {
        entry.target.classList.add("_active");
        observer.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);

  revealElements.forEach((element) => {
    observer.observe(element);

    // Защита от пустого места: если мы перешли из блога и секция уже на экране,
    // сразу делаем её видимой, не дожидаясь скролла
    if (element.getBoundingClientRect().top < window.innerHeight) {
      element.classList.add("_active");
    }
  });
};
