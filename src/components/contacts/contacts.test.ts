import { describe, it, expect, beforeEach, vi } from 'vitest';
import { contacts } from './contacts';

describe('Component: Contacts', () => {
  beforeEach(() => {
    // Подготавливаем DOM формы контактов
    document.body.innerHTML = `
      <form id="contact-form">
        <div class="form__group">
          <input id="form-name" value="">
        </div>
        <div class="form__group">
          <select id="form-method">
            <option value="telegram">Telegram</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div class="form__group">
          <label id="contact-label">Ваш Telegram</label>
          <input id="form-contact" value="">
          <div id="contact-error"></div>
        </div>
        <div class="form__group">
          <textarea id="form-message"></textarea>
        </div>
        <button type="submit" class="form__button">Отправить</button>
      </form>
    `;
    
    // Мокаем IntersectionObserver, так как его нет в JSDOM
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    contacts();
  });

  it('should change labels and placeholders when contact method changes', () => {
    const methodSelect = document.getElementById('form-method') as HTMLSelectElement;
    const contactLabel = document.getElementById('contact-label');
    const contactInput = document.getElementById('form-contact') as HTMLInputElement;

    // Выбираем телефон
    methodSelect.value = 'phone';
    methodSelect.dispatchEvent(new Event('change'));

    expect(contactLabel?.textContent).toBe('Ваш номер телефона');
    expect(contactInput.placeholder).toBe('+7 (999) 123-45-67');

    // Выбираем email
    methodSelect.value = 'email';
    methodSelect.dispatchEvent(new Event('change'));

    expect(contactLabel?.textContent).toBe('Ваш Email');
    expect(contactInput.placeholder).toBe('example@mail.com');
  });

  it('should show error for invalid name (less than 2 chars)', () => {
    const nameInput = document.getElementById('form-name') as HTMLInputElement;
    
    nameInput.value = 'A';
    nameInput.dispatchEvent(new Event('input'));

    expect(nameInput.classList.contains('_error')).toBe(true);
    expect(nameInput.parentElement?.classList.contains('_has-error')).toBe(true);
  });

  it('should validate telegram username correctly', () => {
    const methodSelect = document.getElementById('form-method') as HTMLSelectElement;
    const contactInput = document.getElementById('form-contact') as HTMLInputElement;

    methodSelect.value = 'telegram';
    methodSelect.dispatchEvent(new Event('change'));

    // Невалидный (слишком короткий)
    contactInput.value = 'abc';
    contactInput.dispatchEvent(new Event('input'));
    expect(contactInput.classList.contains('_error')).toBe(true);

    // Валидный
    contactInput.value = 'my_telegram_nick';
    contactInput.dispatchEvent(new Event('input'));
    expect(contactInput.classList.contains('_error')).toBe(false);
  });

  it('should disable submit button on successful form submission', () => {
    const form = document.getElementById('contact-form') as HTMLFormElement;
    const nameInput = document.getElementById('form-name') as HTMLInputElement;
    const contactInput = document.getElementById('form-contact') as HTMLInputElement;
    const messageInput = document.getElementById('form-message') as HTMLTextAreaElement;
    const submitBtn = document.querySelector('.form__button') as HTMLButtonElement;

    // Заполняем валидными данными
    nameInput.value = 'Radik';
    contactInput.value = 'radik_dev';
    messageInput.value = 'Hello, this is a test message for validation.';

    // Симулируем отправку
    form.dispatchEvent(new Event('submit'));

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('Отправка...');
  });
});
