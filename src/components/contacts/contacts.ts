export const contacts = (): void => {
   console.log('Блок contacts (TS) инициализирован');

   const form = document.querySelector<HTMLFormElement>('#contact-form');
   if (!form) return;

   // 🔥 ДОБАВЛЕНЫ КОРРЕКТНЫЕ ДЖЕНЕРИКИ ДЛЯ DOM-ЭЛЕМЕНТОВ
   const nameInput = form.querySelector<HTMLInputElement>('#form-name');
   const methodSelect = form.querySelector<HTMLSelectElement>('#form-method');
   const contactInput = form.querySelector<HTMLInputElement>('#form-contact');
   const contactLabel = form.querySelector<HTMLLabelElement>('#contact-label');
   const contactError = form.querySelector<HTMLDivElement>('#contact-error');
   const messageInput = form.querySelector<HTMLTextAreaElement>('#form-message');

   const regexTelegram = /^[a-zA-Z0-9_]{5,32}/;
   const regexPhone =
      /^(?:\+7|8)?[\s-]?\(?[0-9]{3}\)?[\s-]?[0-9]{3}[\s-]?[0-9]{2}[\s-]?[0-9]{2}/;
   const regexEmail = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

   const showError = (
      input: HTMLInputElement | HTMLTextAreaElement | null,
   ): void => {
      if (!input) return;
      const group = input.parentElement;
      if (group) {
         group.classList.add('_has-error');
         input.classList.add('_error');
      }
   };

   const clearError = (
      input: HTMLInputElement | HTMLTextAreaElement | null,
   ): void => {
      if (!input) return;
      const group = input.parentElement;
      if (group) {
         group.classList.remove('_has-error');
         input.classList.remove('_error');
      }
   };

   methodSelect?.addEventListener('change', () => {
      if (!contactInput || !contactLabel || !contactError || !methodSelect)
         return;

      clearError(contactInput);
      contactInput.value = '';

      switch (methodSelect.value) {
         case 'telegram':
            contactLabel.textContent = 'Ваш Telegram';
            contactInput.placeholder = '@username';
            contactError.textContent =
               'Введите никнейм Telegram (не менее 5 символов)';
            break;
         case 'phone':
            contactLabel.textContent = 'Ваш номер телефона';
            contactInput.placeholder = '+7 (999) 123-45-67';
            contactError.textContent =
               'Введите корректный номер телефона РФ (+7 или 8)';
            break;
         case 'email':
            contactLabel.textContent = 'Ваш Email';
            contactInput.placeholder = 'example@mail.com';
            contactError.textContent = 'Введите корректный email адрес';
            break;
      }
   });

   const validateName = (): boolean => {
      if (!nameInput) return false;
      const isValid = nameInput.value.trim().length >= 2;
      if (isValid) {
         clearError(nameInput);
      } else {
         showError(nameInput);
      }
      return isValid;
   };

   const validateContact = (): boolean => {
      if (!contactInput || !methodSelect) return false;
      const value = contactInput.value.trim();
      let isValid = false;

      if (methodSelect.value === 'telegram') {
         isValid = regexTelegram.test(value);
      } else if (methodSelect.value === 'phone') {
         isValid = regexPhone.test(value);
      } else if (methodSelect.value === 'email') {
         isValid = regexEmail.test(value);
      }

      if (isValid) {
         clearError(contactInput);
      } else {
         showError(contactInput);
      }
      return isValid;
   };

   const validateMessage = (): boolean => {
      if (!messageInput) return false;
      const isValid = messageInput.value.trim().length >= 10;
      if (isValid) {
         clearError(messageInput);
      } else {
         showError(messageInput);
      }
      return isValid;
   };

   nameInput?.addEventListener('input', validateName);
   contactInput?.addEventListener('input', validateContact);
   messageInput?.addEventListener('input', validateMessage);

   form.addEventListener('submit', (e: Event) => {
      e.preventDefault();

      const isNameValid = validateName();
      const isContactValid = validateContact();
      const isMessageValid = validateMessage();

      if (isNameValid && isContactValid && isMessageValid) {
         const button = form.querySelector<HTMLButtonElement>('.form__button');
         if (button) {
            button.disabled = true;
            button.textContent = 'Отправка...';
         }
         setTimeout(() => {
            alert('Спасибо! Заявка принята, я свяжусь с вами выбранным способом.');
            form.reset();
            if (button) {
               button.disabled = false;
               button.textContent = 'Отправить сообщение';
            }
         }, 1000);
      }
   });

   // =========================================================================
   // 👁️ ОПТИМИЗИРОВАННЫЙ INTERSECTION OBSERVER ДЛЯ АНИМАЦИИ ПОЯВЛЕНИЯ
   // =========================================================================
   const revealElements: NodeListOf<HTMLElement> = document.querySelectorAll('.contacts__container.element-reveal');
  
   if (revealElements.length > 0) {
      const observerOptions: IntersectionObserverInit = {
         root: null,
         rootMargin: '0px',
         threshold: 0.05
      };
    
      // Счетчик для отслеживания анимированных элементов
      let revealedCount = 0;

      const observerCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver): void => {
         entries.forEach((entry) => {
            if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
               entry.target.classList.add('_active');
               observer.unobserve(entry.target);
               revealedCount++;

               // 🔥 ОПТИМИЗАЦИЯ: Если все элементы отображены, полностью уничтожаем наблюдатель
               if (revealedCount === revealElements.length) {
                  observer.disconnect();
               }
            }
         });
      };

      const observer = new IntersectionObserver(observerCallback, observerOptions);
    
      revealElements.forEach((element) => {
         observer.observe(element);
         // Проверка на случай, если элемент уже находится в зоне видимости при загрузке
         if (element.getBoundingClientRect().top < window.innerHeight) {
            element.classList.add('_active');
         }
      });
   }
};