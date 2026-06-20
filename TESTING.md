# 🧪 Руководство по тестированию Radik.Dev

В проекте используется **Vitest** совместно с **JSDOM** для обеспечения надежности как пользовательского интерфейса, так и логики сборки.

---

## 🚀 Как запускать тесты

*   **Одиночный прогон (CI режим):**
    ```bash
    npm run test:run
    ```
    *Используется автоматически при команде `npm run build`.*

*   **Режим разработки (Watch режим):**
    ```bash
    npm run test
    ```
    *Тесты будут перезапускаться автоматически при каждом сохранении кода.*

---

## 📂 Структура тестов

1.  **Тесты компонентов (`src/components/**/*.test.ts`)**
    *   Проверяют DOM-события, валидацию форм, открытие модалок и т.д.
    *   Лежат рядом с файлами компонентов для удобства поддержки.

2.  **Системные тесты (`gulp/tests/**/*.test.js`)**
    *   Проверяют логику сборщика, процессоры контента и утилиты.

---

## 🛠️ Как создать новый тест

### 1. Тест для UI-компонента (TypeScript)
Создайте файл `my-component.test.ts` в папке компонента:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myComponent } from './my-component';

describe('MyComponent', () => {
  beforeEach(() => {
    // Имитируем HTML разметку
    document.body.innerHTML = `<div class="my-comp">...</div>`;
    // Инициализируем логику
    myComponent();
  });

  it('should do something on click', () => {
    const el = document.querySelector('.my-comp');
    el.click();
    expect(el.classList.contains('_active')).toBe(true);
  });
});
```

### 2. Тест для функции/утилиты (JavaScript/TypeScript)
Создайте файл в `gulp/tests/`:

```javascript
import { describe, it, expect } from 'vitest';
import { myFunc } from '../utils/my-utils.js';

describe('My Utility', () => {
  it('should format data correctly', () => {
    const result = myFunc('input');
    expect(result).toBe('OUTPUT');
  });
});
```

---

## 💡 Важные нюансы

*   **JSDOM:** У нас нет реального браузера, поэтому такие вещи как `IntersectionObserver` или `getBoundingClientRect` нужно "мокать" (подменять заглушками) через `vi.fn()`.
*   **События:** После изменения `value` у инпутов в тесте, всегда вызывайте `element.dispatchEvent(new Event('input'))`, чтобы сработали ваши слушатели.
*   **Очистка:** Всегда используйте `beforeEach`, чтобы сбрасывать `document.body.innerHTML`, иначе тесты будут влиять друг на друга.

---

*Документация актуальна для версии движка v3.1+*
