import fs from "fs";
import path from "path";
import { config } from "./gulp.config.js";

const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const updateFileContent = (filePath, modifyCallback) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  const updatedContent = modifyCallback(content);
  fs.writeFileSync(filePath, updatedContent.trimEnd() + "\n");
};

const getSemanticTag = (blockName) => {
  const tags = ["header", "footer", "main", "nav", "aside", "article"];
  return tags.includes(blockName) ? blockName : "section";
};

const updateAppTs = (filePath, blockName, camelName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const importLine = `import { ${camelName} } from "@comp/${blockName}/${blockName}";`;
    const callLine = `${camelName}();`;

    const nextBlockIndex = lines.findIndex((line) =>
      line.includes("ИМПОРТЫ ДИНАМИЧЕСКИХ JS/TS МОДУЛЕЙ"),
    );
    if (nextBlockIndex !== -1) {
      lines.splice(nextBlockIndex, 0, importLine);
    } else {
      lines.unshift(importLine);
    }

    const interactiveIndex = lines.findIndex((line) =>
      line.includes("Интерактивные модули логики"),
    );
    if (interactiveIndex !== -1) {
      lines.splice(interactiveIndex, 0, callLine);
    } else {
      lines.push(callLine);
    }

    return lines
      .join("\n")
      .replace(/(import\s+.*?;)\n\s*\n\s*(import\s+.*?;)/gi, "$1\n$2")
      .replace(/(\(\);\r?\n)\s*\r?\n\s*(\b\w+\(\);)/gi, "$1$2")
      .replace(
        /([^\n])\n*(\/\/ .*?ИМПОРТЫ ДИНАМИЧЕСКИХ JS\/TS МОДУЛЕЙ)/i,
        "$1\n\n$2",
      )
      .replace(/([^\n])\n*(\/\/ Интерактивные модули логики)/i, "$1\n\n$2");
  });
  console.log("📝 Компонент успешно добавлен в app.ts по своим blocks");
};

const updateStyleScss = (filePath, blockName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const scssImport = `@use "../components/${blockName}/${blockName}";`;

    const modulesIndex = lines.findIndex((line) =>
      line.includes("ФУНКЦИОНАЛЬНЫЕ JS/TS МОДУЛИ"),
    );
    if (modulesIndex !== -1) {
      lines.splice(modulesIndex, 0, scssImport);
    } else {
      const zeroIndex = lines.findIndex((line) => line.includes("base/zero"));
      lines.splice(zeroIndex !== -1 ? zeroIndex + 1 : 0, 0, scssImport);
    }

    return lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(\/\/ КОМПОНЕНТЫ СТРУКТУРЫ САЙТА\r?\n)\s*\r?\n/i, "$1")
      .replace(/([^\n])\n*(\/\/ ФУНКЦИОНАЛЬНЫЕ JS\/TS МОДУЛИ)/i, "$1\n\n$2");
  });
  console.log("🎨 Стили добавлены в блок компонентов style.scss");
};

const updateIndexHtml = (filePath, blockName) => {
  updateFileContent(filePath, (content) => {
    const includeString = `@@include("components/${blockName}/${blockName}.html")\n`;
    const scriptTag = '<script src="js/app.min.js"></script>';

    if (content.includes(scriptTag)) {
      return content.replace(scriptTag, `${includeString}${scriptTag}`);
    }
    return content.replace("</body>", `${includeString}</body>`);
  });
};

export const create = (done) => {
  const blockName = process.argv
    .find((arg) => arg.startsWith("--"))
    ?.replace("--", "");

  if (!blockName) {
    console.log("\n❌ Ошибка: Укажите имя блока!\n");
    return done();
  }

  const camelName = toCamelCase(blockName);
  const dirPath = path.join(config.structure.components, blockName);

  const mainJsPath = path.join(config.srcFolder, "js", "app.ts");
  const mainScssPath = path.join(
    config.srcFolder,
    config.preprocessor,
    `style.${config.preprocessor}`,
  );
  const indexHtmlPath = path.join(config.srcFolder, "index.html");

  if (fs.existsSync(dirPath)) {
    console.log(`\n⚠️ Блок "${blockName}" уже существует!\n`);
    return done();
  }

  fs.mkdirSync(dirPath, { recursive: true });
  fs.mkdirSync(path.join(dirPath, "img"), { recursive: true });

  const tag = getSemanticTag(blockName);
  const htmlTemplate = `<${tag} class="${blockName}">\n\t<div class="${blockName}__container container">\n\t\t\n\t</div>\n</${tag}>`;
  const scssTemplate = `.${blockName} {\n\t\n}`;
  const tsTemplate = `export const ${camelName} = () => {\n  console.log("Блок ${blockName} (TS) инициализирован");\n};\n`;

  fs.writeFileSync(path.join(dirPath, `${blockName}.html`), htmlTemplate);
  fs.writeFileSync(
    path.join(dirPath, `${blockName}.${config.preprocessor}`),
    scssTemplate,
  );
  fs.writeFileSync(path.join(dirPath, `${blockName}.ts`), tsTemplate);

  updateAppTs(mainJsPath, blockName, camelName);
  updateStyleScss(mainScssPath, blockName);
  updateIndexHtml(indexHtmlPath, blockName);

  console.log(`\n✅ Блок "${blockName}" (TS: ${camelName}) успешно создан!\n`);
  done();
};
