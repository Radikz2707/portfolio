export const contacts = (): void => {
  console.log("Блок contacts (TS) инициализирован");

  const form = document.querySelector<HTMLFormElement>("#contact-form");
  if (!form) return;

  const nameInput = form.querySelector<HTMLInputElement>("#form-name");
  const methodSelect = form.querySelector<HTMLSelectElement>("#form-method");
  const contactInput = form.querySelector<HTMLInputElement>("#form-contact");
  const contactLabel = form.querySelector<HTMLLabelElement>("#contact-label");
  const contactError = form.querySelector<HTMLSpanElement>("#contact-error");
  const messageInput = form.querySelector<HTMLTextAreaElement>("#form-message");

  // Регулярные выражения для валидации мессенджеров и связи в РФ
  const regexTelegram = /^(?:@)?[a-zA-Z0-9_]{5,32}$/;
  const regexPhone =
    /^(?:\+7|8)?[\s-]?\(?[0-9]{3}\)?[\s-]?[0-9]{3}[\s-]?[0-9]{2}[\s-]?[0-9]{2}$/;
  const regexEmail = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

  const showError = (
    input: HTMLInputElement | HTMLTextAreaElement | null,
  ): void => {
    if (!input) return;
    const group = input.parentElement;
    if (group) {
      group.classList.add("_has-error");
      input.classList.add("_error");
    }
  };

  const clearError = (
    input: HTMLInputElement | HTMLTextAreaElement | null,
  ): void => {
    if (!input) return;
    const group = input.parentElement;
    if (group) {
      group.classList.remove("_has-error");
      input.classList.remove("_error");
    }
  };

  // 1. ДИНАМИЧЕСКАЯ СМЕНА ТИПА СВЯЗИ
  methodSelect?.addEventListener("change", () => {
    if (!contactInput || !contactLabel || !contactError) return;

    clearError(contactInput);
    contactInput.value = ""; // Очищаем поле при смене типа

    switch (methodSelect.value) {
      case "telegram":
        contactLabel.textContent = "Ваш Telegram";
        contactInput.placeholder = "@username";
        contactError.textContent =
          "Введите никнейм Telegram (не менее 5 символов)";
        break;
      case "phone":
        contactLabel.textContent = "Ваш номер телефона";
        contactInput.placeholder = "+7 (999) 123-45-67";
        contactError.textContent =
          "Введите корректный номер телефона РФ (+7 или 8)";
        break;
      case "email":
        contactLabel.textContent = "Ваш Email";
        contactInput.placeholder = "example@mail.com";
        contactError.textContent = "Введите корректный email адрес";
        break;
    }
  });

  // 2. ФУНКЦИИ ВАЛИДАЦИИ
  const validateName = (): boolean => {
    if (!nameInput) return false;
    const isValid = nameInput.value.trim().length >= 2;

    // 🔥 ИСПРАВЛЕНО: Заменили тернарник на if/else
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

    if (methodSelect.value === "telegram") {
      isValid = regexTelegram.test(value);
    } else if (methodSelect.value === "phone") {
      isValid = regexPhone.test(value);
    } else if (methodSelect.value === "email") {
      isValid = regexEmail.test(value);
    }

    // 🔥 ИСПРАВЛЕНО: Заменили тернарник на if/else
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

    // 🔥 ИСПРАВЛЕНО: Заменили тернарник на if/else
    if (isValid) {
      clearError(messageInput);
    } else {
      showError(messageInput);
    }

    return isValid;
  };

  // Живые слушатели
  nameInput?.addEventListener("input", validateName);
  contactInput?.addEventListener("input", validateContact);
  messageInput?.addEventListener("input", validateMessage);

  form.addEventListener("submit", (e: Event) => {
    e.preventDefault();

    const isNameValid = validateName();
    const isContactValid = validateContact();
    const isMessageValid = validateMessage();

    if (isNameValid && isContactValid && isMessageValid) {
      const button = form.querySelector<HTMLButtonElement>(".form__button");
      if (button) {
        button.disabled = true;
        button.textContent = "Отправка...";
      }

      setTimeout(() => {
        alert("Спасибо! Заявка принята, я свяжусь с вами выбранным способом.");
        form.reset();
        if (button) {
          button.disabled = false;
          button.textContent = "Отправить сообщение";
        }
      }, 1000);
    }
  });

  // Логика анимации появления (оставляем без изменений)
  const revealElements = document.querySelectorAll(
    ".contacts__container.element-reveal",
  );
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
    if (element.getBoundingClientRect().top < window.innerHeight)
      element.classList.add("_active");
  });
};
