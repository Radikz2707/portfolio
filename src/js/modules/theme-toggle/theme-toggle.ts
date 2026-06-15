export const themeToggle = (): void => {
  console.log('Модуль theme-toggle (TS) инициализирован');

  // 🛠️ 1. Находим кнопку переключателя
  const toggleBtn = document.querySelector<HTMLElement>('.theme-toggle-btn');
  if (!toggleBtn) return;

  const htmlElement = document.documentElement;
  const STORAGE_KEY = 'radik-portfolio-theme';

  // 🌓 2. Логика переключения темы по клику
  const toggleTheme = (): void => {
    const isLight = htmlElement.classList.contains('_light-theme');

    if (isLight) {
      htmlElement.classList.remove('_light-theme');
      localStorage.setItem(STORAGE_KEY, 'dark');
      toggleBtn.setAttribute('aria-label', 'Включить светлую тему');
    } else {
      htmlElement.classList.add('_light-theme');
      localStorage.setItem(STORAGE_KEY, 'light');
      toggleBtn.setAttribute('aria-label', 'Включить темную тему');
    }
  };

  // Навешиваем событие клика
  toggleBtn.addEventListener('click', toggleTheme);
};
