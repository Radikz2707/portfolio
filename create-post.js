import fs from "fs";
import path from "path";
import readline from "readline";
import { translate } from "@vitalets/google-translate-api"; // Ваша установленная библиотека

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("--- 🤖 УМНЫЙ РОБОТ-ПЕРЕВОДЧИК СТАТЕЙ БЛОГА ---");

// Задаем один вопрос — название на русском языке
rl.question(
  "📝 Введите название новой статьи на русском: ",
  async (rawTitle) => {
    const cleanTitle = rawTitle.trim();

    if (!cleanTitle) {
      console.error("❌ Название статьи не может быть пустым!");
      rl.close();
      return;
    }

    console.log("⏳ Перевожу название и генерирую смысловой URL...");

    try {
      // 🔥 ПЕРЕВОД СМЫСЛА:
      // Робот переводит русский текст на чистый английский язык
      const res = await translate(cleanTitle, { from: "ru", to: "en" });
      const englishTitle = res.text;

      // Превращаем английский перевод в идеальный системный URL-slug
      const cleanSlug = englishTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Удаляем спецсимволы
        .replace(/\s+/g, "-") // Заменяем пробелы на дефисы
        .replace(/-+/g, "-"); // Убираем двойные дефисы

      // Пути к файлам проекта из корня
      const mdFilePath = path.join("src", "content", "blog", `${cleanSlug}.md`);
      const sidebarPath = path.join(
        "src",
        "components",
        "blog-sidebar",
        "blog-sidebar.html",
      );

      // Шаблон контента будущей Markdown-статьи
      const today = new Date().toISOString().split("T")[0];
      const mdTemplate = `# ${cleanTitle}\n\n*Дата публикации: ${today}*\n\nПривет! Начни писать текст новой статьи прямо здесь в формате Markdown...`;

      // 1. Создаем .md файл с русским заголовком и АНГЛИЙСКИМ смысловым именем
      fs.writeFileSync(mdFilePath, mdTemplate, "utf-8");
      console.log(`\n✅ Markdown файл успешно сгенерирован: ${mdFilePath}`);
      console.log(`🇬🇧 Перевод заголовка: "${englishTitle}"`);
      console.log(`ℹ️  Автоматический URL страницы: /blog/${cleanSlug}.html`);

      // 2. Автоматическое добавление БЭМ-ссылки в правый сайдбар страницы
      if (fs.existsSync(sidebarPath)) {
        let sidebarHtml = fs.readFileSync(sidebarPath, "utf-8");

        // Генерируем валидную БЭМ-строку ссылки (используем исходное русское имя для текста)
        const newLinkHtml = `      <li class="blog-sidebar__item"><a href="blog/${cleanSlug}.html" class="blog-sidebar__link">${cleanTitle}</a></li>\n`;

        // Ищем закрывающий тег списка </ul>, чтобы вставить ссылку в конец
        if (sidebarHtml.includes("</ul>")) {
          sidebarHtml = sidebarHtml.replace("</ul>", `${newLinkHtml}    </ul>`);
          fs.writeFileSync(sidebarPath, sidebarHtml, "utf-8");
          console.log("🔗 Ссылка автоматически добавлена в сайдбар!");
        } else {
          console.log(
            "⚠️  Тег </ul> не найден в сайдбаре. Добавьте ссылку вручную.",
          );
        }
      }

      console.log(
        "\n🚀 Автоматизация завершена! Можете приступать к написанию текста.",
      );
      console.log(
        "💡 Запустите \"npm run build && npm run deploy\" для публикации.",
      );
    } catch (error) {
      console.error(
        "❌ Произошла ошибка при переводе или генерации файлов:",
        error,
      );
    }

    rl.close();
  },
);
