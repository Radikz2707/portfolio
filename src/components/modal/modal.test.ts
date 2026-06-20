import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modal } from './modal';

describe('Component: Modal', () => {
  beforeEach(() => {
    // Очищаем DOM и блокировку body перед каждым тестом
    document.body.innerHTML = `
      <button data-modal-trigger="test-modal">Open Modal</button>
      <div id="test-modal" class="modal">
        <div class="modal__overlay" data-close></div>
        <div class="modal__container">
          <button data-close id="close-btn">Close</button>
        </div>
      </div>
    `;
    document.body.className = '';
    
    // Инициализируем логику модального окна
    modal();
  });

  it('should open modal and lock body on trigger click', () => {
    const trigger = document.querySelector('[data-modal-trigger]') as HTMLElement;
    const modalElement = document.getElementById('test-modal');

    trigger.click();

    expect(modalElement?.classList.contains('_active')).toBe(true);
    expect(document.body.classList.contains('_lock')).toBe(true);
    expect(modalElement?.getAttribute('aria-hidden')).toBe('false');
  });

  it('should close modal and unlock body on close button click', () => {
    const trigger = document.querySelector('[data-modal-trigger]') as HTMLElement;
    const closeBtn = document.getElementById('close-btn') as HTMLElement;
    const modalElement = document.getElementById('test-modal');

    // Открываем
    trigger.click();
    // Закрываем
    closeBtn.click();

    expect(modalElement?.classList.contains('_active')).toBe(false);
    expect(document.body.classList.contains('_lock')).toBe(false);
    expect(modalElement?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should close modal on Escape key press', () => {
    const trigger = document.querySelector('[data-modal-trigger]') as HTMLElement;
    const modalElement = document.getElementById('test-modal');

    trigger.click();
    
    // Симулируем нажатие Escape
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(modalElement?.classList.contains('_active')).toBe(false);
    expect(document.body.classList.contains('_lock')).toBe(false);
  });
});
