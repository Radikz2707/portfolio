import fs from 'fs';
import path from 'path';
import readline from 'readline';
import translate from '@vitalets/google-translate-api';

// Fallback функция для простой транслитерации кириллицы в латиницу
const transliterate = (str) => {
  const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя-'.split('');
  const en = 'abvgdeejzijklmnoprstufhcchyieua-'.split('');
  return str
    .split('')
    .map((char) => {
      const lowerChar = char.toLowerCase();
      const index = ru.indexOf(lowerChar);
      if (index === -1) return char;
      const replaced = en[index];
      return char === lowerChar ? replaced : replaced.toUpperCase();
    })
    .join('');
};

const generatePost = async (cleanTitle, mdFilePath) => {
  const today = new Date().toISOString().split('T')[0];
  const mdTemplate = `# ${cleanTitle}\n\n*Дата публикации: ${today}*\n\nПривет! Начни писать текст новой статьи прямо здесь в формате Markdown...`;

  // 1. Создаем .md файл с русским заголовком и АНГЛИЙСКИМ смысловым именем
  fs.writeFileSync(mdFilePath, mdTemplate, 'utf-8');
  console.log(`\n✅ Markdown файл успешно сгенерирован: ${mdFilePath}`);
  console.log(
    `ℹ️  Автоматический URL страницы: /blog/${path.basename(mdFilePath, '.md')}.html`,
  );
  console.log(
    '🔗 Ссылка будет автоматически добавлена в сайдбар при сборке через Gulp.',
  );
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('--- 🤖 УМНЫЙ РОБОТ-ПЕРЕВОДЧИК СТАТЕЙ БЛОГА ---');

// Задаем один вопрос — название на русском языке
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

    try {
      // 🔥 ПЕРЕВОД СМЫСЛА:
      // Робот переводит русский текст на чистый английский язык
      const res = await translate(cleanTitle, { from: 'ru', to: 'en' });
      const englishTitle = res.text;

      // Превращаем английский перевод в идеальный системный URL-slug
      const cleanSlug = englishTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Удаляем спецсимволы
        .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
        .replace(/-+/g, '-'); // Убираем двойные дефисы

      console.log(`🇬🇧 Перевод заголовка: "${englishTitle}"`);

      const mdFilePath = path.join('src', 'content', 'blog', `${cleanSlug}.md`);

      await generatePost(cleanTitle, mdFilePath);

      console.log(
        '\n🚀 Автоматизация завершена! Можете приступать к написанию текста.',
      );
      console.log(
        '💡 Запустите "npm run build && npm run deploy" для публикации.',
      );
    } catch (translateError) {
      console.warn('⚠️ API перевода недоступно, используем транслитерацию...');
      const transliterated = transliterate(cleanTitle);
      const cleanSlug = transliterated
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      console.log(`latin: "${transliterated}"`);

      const mdFilePath = path.join('src', 'content', 'blog', `${cleanSlug}.md`);

      await generatePost(cleanTitle, mdFilePath);

      console.log(
        '\n🚀 Автоматизация завершена! Можете приступать к написанию текста.',
      );
      console.log(
        '💡 Запустите "npm run build && npm run deploy" для публикации.',
      );
    }

    rl.close();
  },
);
