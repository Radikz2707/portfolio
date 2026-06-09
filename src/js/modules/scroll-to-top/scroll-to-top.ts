export const scrollToTop = (): void => {
  console.log('Модуль scroll-to-top (TS) инициализирован');

  // Динамически создаем элемент кнопки
  const btn = document.createElement('button');

  // Присваиваем класс — все стили (размеры, градиент, ховеры) подтянутся из SCSS автоматически!
  btn.className = 'scroll-top';
  btn.innerHTML = '↑';

  // Добавляем готовую кнопку на страницу внутрь тега body
  document.body.appendChild(btn);

  // Следим за скроллом страницы в реальном времени
  window.addEventListener('scroll', (): void => {
    if (window.scrollY > 400) {
      btn.style.opacity = '1';
      btn.style.visibility = 'visible';
    } else {
      btn.style.opacity = '0';
      btn.style.visibility = 'hidden';
    }
  });

  // Клик по кнопке — мгновенный и плавный возврат наверх силами самого браузера
  btn.addEventListener('click', (): void => {
    window.scrollTo({
      top: 0,
    });
  });
};
