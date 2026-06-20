import fs from 'fs';
import path from 'path';
import readline from 'readline';
import translate from '@vitalets/google-translate-api';

// Улучшенная функция транслитерации
const transliterate = (str) => {
  const ru = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return str.split('').map(char => {
    const lower = char.toLowerCase();
    if (ru[lower] !== undefined) {
      return char === lower ? ru[lower] : ru[lower].toUpperCase();
    }
    return char;
  }).join('');
};

const generatePost = async (cleanTitle, mdFilePath) => {
  const today = new Date().toISOString().split('T')[0];
  const mdTemplate = `# ${cleanTitle}\n\n*Дата публикации: ${today}*\n\nПривет! Начни писать текст новой статьи прямо здесь в формате Markdown...`;

  // Создаем директорию, если её нет
  const dir = path.dirname(mdFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Проверка на существование файла
  if (fs.existsSync(mdFilePath)) {
    console.error(`\n❌ Ошибка: Файл уже существует: ${mdFilePath}`);
    console.log('💡 Попробуйте другое название или удалите старый файл.');
    return false;
  }

  fs.writeFileSync(mdFilePath, mdTemplate, 'utf-8');
  console.log(`\n✅ Markdown файл успешно сгенерирован: ${mdFilePath}`);
  console.log(
    `ℹ️  Автоматический URL страницы: /blog/${path.basename(mdFilePath, '.md')}.html`,
  );
  console.log(
    '🔗 Ссылка будет автоматически добавлена в сайдбар при сборке через Gulp.',
  );
  return true;
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('--- 🤖 УМНЫЙ РОБОТ-ПЕРЕВОДЧИК СТАТЕЙ БЛОГА ---');

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

    let cleanSlug = '';

    try {
      // Пытаемся перевести через Google Translate
      const res = await translate(cleanTitle, { from: 'ru', to: 'en' });
      const englishTitle = res.text;
      console.log(`🇬🇧 Перевод заголовка: "${englishTitle}"`);

      cleanSlug = englishTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    } catch (translateError) {
      console.warn('⚠️ API перевода недоступно, используем транслитерацию...');
      const transliterated = transliterate(cleanTitle);
      console.log(`latin: "${transliterated}"`);

      cleanSlug = transliterated
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    // Финальная очистка slug от дефисов по краям
    cleanSlug = cleanSlug.replace(/^-+|-+$/g, '');

    const mdFilePath = path.join('src', 'content', 'blog', `${cleanSlug}.md`);
    const success = await generatePost(cleanTitle, mdFilePath);

    if (success) {
      console.log('\n🚀 Автоматизация завершена! Можете приступать к написанию текста.');
      console.log('💡 Запустите "npm run build && npm run deploy" для публикации.');
    }

    rl.close();
  },
);

