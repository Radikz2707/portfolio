import fs from 'fs';
import path from 'path';
import readline from 'readline';
import translate from '@vitalets/google-translate-api';

// Путь к общему конфигурационному файлу категорий
const configPath = path.join('src', 'content', 'categories.json');

// Чтение категорий из единого JSON файла
const getCategoryNames = () => {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error(
      '⚠️ Ошибка чтения конфигурации категорий, используем пустой объект.',
    );
  }
  return {};
};

// Сохранение обновленной категории в единый JSON
const saveCategoryNames = (data) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(
      '❌ Не удалось сохранить новую категорию в конфигурационный файл.',
    );
  }
};

// Функция перевода строки в URL-безопасный slug (английский или транслит)
const convertToSlug = async (text) => {
  let slug = '';
  try {
    const res = await translate(text, { from: 'ru', to: 'en' });
    slug = res.text;
  } catch (e) {
    // Резервный транслит, если Google API лежит
    const ru = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'e',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'h',
      ц: 'c',
      ч: 'ch',
      ш: 'sh',
      щ: 'sch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };
    slug = text
      .split('')
      .map((c) => {
        const l = c.toLowerCase();
        return ru[l] !== undefined ? ru[l] : l;
      })
      .join('');
  }
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const generatePost = async (cleanTitle, categorySlug, mdFilePath) => {
  const today = new Date().toISOString().split('T')[0];
  const mdTemplate = `# ${cleanTitle}\n\n*Дата публикации: ${today}*\n\nПривет! Начни писать текст новой статьи прямо здесь в формате Markdown...`;

  const dir = path.dirname(mdFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(mdFilePath)) {
    console.error(`\n❌ Ошибка: Файл уже существует: ${mdFilePath}`);
    return false;
  }

  fs.writeFileSync(mdFilePath, mdTemplate, 'utf-8');
  console.log(`\n✅ Markdown файл успешно сгенерирован: ${mdFilePath}`);
  console.log(
    `ℹ️  Автоматический URL страницы: /blog/${categorySlug}/${path.basename(mdFilePath, '.md')}.html`,
  );
  return true;
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('--- 🤖 УМНЫЙ РОБОТ-ПЕРЕВОДЧИК СТАТЕЙ БЛОГА (v2.0) ---');

const categoryNames = getCategoryNames();
const contentRoot = path.join('src', 'content');

// Считываем папки на диске, отсекая системные файлы
const existingFolders = fs
  .readdirSync(contentRoot)
  .filter((f) => fs.statSync(path.join(contentRoot, f)).isDirectory());

console.log('\n📂 Доступные категории:');
existingFolders.forEach((cat, index) => {
  const name = categoryNames[cat] || `Неизвестная категория (${cat})`;
  console.log(`  ${index + 1}. ${name}`);
});
console.log(`  ${existingFolders.length + 1}. ✨ [СОЗДАТЬ НОВУЮ КАТЕГОРИЮ]`);

rl.question(
  '\n🔢 Выберите номер категории или создание новой: ',
  async (categoryInput) => {
    const inputIndex = parseInt(categoryInput.trim()) - 1;
    let selectedCategorySlug = '';

    // Сценарий создания абсолютно новой категории из консоли
    if (inputIndex === existingFolders.length) {
      rl.question(
        '🆕 Введите название новой категории на русском (например: История): ',
        async (newCatNameRaw) => {
          const newCatName = newCatNameRaw.trim();
          if (!newCatName) {
            console.error('❌ Название категории не может быть пустым!');
            rl.close();
            return;
          }

          console.log('⏳ Генерирую имя папки для новой категории...');
          const newCatSlug = await convertToSlug(newCatName);

          // Регистрируем в JSON и создаем физическую папку
          categoryNames[newCatSlug] = newCatName;
          saveCategoryNames(categoryNames);

          const newFolderPath = path.join(contentRoot, newCatSlug);
          if (!fs.existsSync(newFolderPath)) {
            fs.mkdirSync(newFolderPath, { recursive: true });
          }

          console.log(
            `\n🎉 Категория успешно зарегистрирована: "${newCatName}" -> папка [src/content/${newCatSlug}]`,
          );
          askForArticleTitle(newCatSlug);
        },
      );
    } else if (inputIndex >= 0 && inputIndex < existingFolders.length) {
      selectedCategorySlug = existingFolders[inputIndex];
      console.log(
        `✅ Выбрана категория: ${categoryNames[selectedCategorySlug] || selectedCategorySlug}`,
      );
      askForArticleTitle(selectedCategorySlug);
    } else {
      console.error('❌ Некорректный выбор!');
      rl.close();
    }
  },
);

// Вынесено в функцию, так как шаг повторяется в обоих сценариях
function askForArticleTitle(categorySlug) {
  rl.question(
    '📝 Введите название новой статьи на русском: ',
    async (rawTitle) => {
      const cleanTitle = rawTitle.trim();
      if (!cleanTitle) {
        console.error('❌ Название статьи не может быть пустым!');
        rl.close();
        return;
      }

      console.log('⏳ Перевожу название и генерирую смысловой URL...');
      const cleanSlug = await convertToSlug(cleanTitle);

      const mdFilePath = path.join(
        'src',
        'content',
        categorySlug,
        `${cleanSlug}.md`,
      );
      const success = await generatePost(cleanTitle, categorySlug, mdFilePath);

      if (success) {
        console.log(
          '\n🚀 Автоматизация завершена! Можете приступать к написанию текста.',
        );
      }
      rl.close();
    },
  );
}
