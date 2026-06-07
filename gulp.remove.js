import fs from "fs";
import path from "path";
import { config } from "./gulp.config.js";

const PROTECTED_NAMES = [
  "js",
  "scss",
  "html",
  "img",
  "fonts",
  "components",
  "modules",
  "src",
  "dist",
  "plugins",
];

const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const updateFileContent = (filePath, modifyCallback) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  const updatedContent = modifyCallback(content);
  fs.writeFileSync(filePath, updatedContent.trimEnd() + "\n");
};

const cleanAppTs = (filePath, blockName, camelName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();

      // ИСПРАВЛЕНО: Более точная проверка импорта (ищет имя блока как изолированную часть пути в кавычках)
      const isTargetImport =
        trimmed.startsWith("import ") &&
        (trimmed.includes(`/${blockName}/`) ||
          trimmed.includes(`/${blockName}"`) ||
          trimmed.includes(`/${blockName}'`));

      // ИСПРАВЛЕНО: Проверка вызова функции без привязки к лишним пробелам или табам по краям
      const isTargetCall = trimmed.replace(/\s+/g, "") === `${camelName}();`;

      return !isTargetImport && !isTargetCall;
    });
    return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n");
  });
  console.log("✂️ Импорты и вызовы TS успешно удалены.");
};

const cleanStyleScss = (filePath, blockName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.includes(`/${blockName}/`) &&
        !trimmed.includes(`/${blockName}"`) &&
        !trimmed.includes(`/${blockName}'`)
      );
    });
    return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n");
  });
  console.log(`✂️ Стили удалены из style.${config.preprocessor}`);
};

const cleanIndexHtml = (filePath, blockName) => {
  updateFileContent(filePath, (content) => {
    // ИСПРАВЛЕНО: Регулярное выражение теперь корректно вырезает инклуд вместе с переносом строки, не оставляя пустых дыр
    const htmlIncludeReg = new RegExp(
      `@@include\\(['"].*?${blockName}/${blockName}.html['"]\\)\\r?\\n?`,
      "g",
    );
    return content.replace(htmlIncludeReg, "").replace(/\n{3,}/g, "\n\n");
  });
  console.log("✂️ Инклуд удален из HTML.");
};

export const remove = (done) => {
  const blockName = process.argv
    .find((arg) => arg.startsWith("--"))
    ?.replace("--", "");

  if (!blockName) {
    console.log("\n❌ Ошибка: Укажите имя! Пример: gulp remove --header\n");
    return done();
  }

  if (PROTECTED_NAMES.includes(blockName.toLowerCase())) {
    console.log(
      `\n❌ Ошибка: Удаление системной папки "${blockName}" запрещено!\n`,
    );
    return done();
  }

  const camelName = toCamelCase(blockName);

  // Добавлен поиск как папок, так и возможных одиночных файлов модулей/плагинов
  const possibleDirs = [
    path.join(config.structure.components, blockName),
    path.join(config.structure.modules, blockName),
    path.join(config.structure.plugins, blockName),
  ];
  const possibleFiles = [
    path.join(config.structure.modules, `${blockName}.ts`),
    path.join(config.structure.plugins, `${blockName}.ts`),
  ];

  const mainJsPath = config.paths.scripts.src; // ИСПРАВЛЕНО: Динамический путь из конфигурации
  const mainScssPath = path.join(
    config.srcFolder,
    config.preprocessor,
    `style.${config.preprocessor}`,
  );
  const indexHtmlPath = path.join(config.srcFolder, "index.html");

  let dirDeleted = false;

  // Удаляем папки
  possibleDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️ Папка удалена: ${dir}`);
      dirDeleted = true;
    }
  });

  // Удаляем одиночные файлы (если модуль был создан без папки)
  possibleFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`🗑️ Файл удален: ${file}`);
      dirDeleted = true;
    }
  });

  if (!dirDeleted)
    console.log(`⚠️ Ресурсы для "${blockName}" не найдены на диске.`);

  cleanAppTs(mainJsPath, blockName, camelName);
  cleanStyleScss(mainScssPath, blockName);
  cleanIndexHtml(indexHtmlPath, blockName);

  console.log(
    `\n✅ "${blockName}" полностью вырезан из архитектуры проекта.\n`,
  );
  done();
};
