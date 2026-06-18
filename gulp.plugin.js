import fs from 'fs';
import path from 'path';
import { config } from './gulp.config.js';

const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const updateFileContent = (filePath, modifyCallback) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const updatedContent = modifyCallback(content);
  fs.writeFileSync(filePath, updatedContent.trimEnd() + '\n');
};

const updateAppTs = (filePath, name, camelName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const importLine = `import { ${camelName} } from "../plugins/${name}/${name}";`;
    const callLine = `${camelName}();`;

    // 1. ИМПОРТЫ: Находим самый последний импорт в файле и вставляем под него
    const lastImportIndex = lines.findLastIndex((line) =>
      line.trim().startsWith('import '),
    );
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }

    // 2. ВЫЗОВЫ: Вставляем вызов новой функции в самый-самый конец файла
    lines.push(callLine);

    return lines
      .join('\n')
      .replace(/(import\s+.*?;)\n\s*\n\s*(import\s+.*?;)/gi, '$1\n$2')
      .replace(/\n{3,}/g, '\n\n');
  });
  console.log('📝 Плагин успешно добавлен в app.ts');
};

const updateStyleScss = (filePath, dirPath, name, camelName) => {
  updateFileContent(filePath, (content) => {
    const styleDir = path.dirname(filePath);
    let relativePath = path
      .relative(styleDir, path.join(dirPath, name))
      .replace(/\\/g, '/');
    if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;

    const lines = content.split(/\r?\n/);

    // ИСПРАВЛЕНО: Безопасный импорт стилей с уникальным пространств��м имен (алиасом) на основе camelName
    const newImport = `@use "${relativePath}" as ${camelName};`;

    const firstCodeIndex = lines.findIndex((line) => {
      const trimmed = line.trim();
      return (
        trimmed !== '' &&
        !trimmed.startsWith('@use') &&
        !trimmed.startsWith('//')
      );
    });

    if (firstCodeIndex !== -1) {
      lines.splice(firstCodeIndex, 0, newImport);
    } else {
      lines.push(newImport);
    }

    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/(@use\s+.*?;)\n*(?![^]*@use)/i, '$1\n\n');
  });
  console.log('🎨 Стили плагина добавлены в style.scss');
};

export const createPlugin = (done) => {
  const name = process.argv
    .find((arg) => arg.startsWith('--'))
    ?.replace('--', '');

  if (!name) {
    console.log(
      '\n❌ Укажите имя плагина! Пример: gulp plugin --my-plugin\n',
    );
    return done();
  }

  const camelName = toCamelCase(name);
  const dirPath = path.join(config.structure.plugins, name);
  const appJsPath = path.join(config.srcFolder, 'js', 'app.ts');
  const styleScssPath = path.join(
    config.srcFolder,
    config.scssExtension,
    `style.${config.scssExtension}`,
  );

  if (fs.existsSync(dirPath)) {
    console.log(`\n⚠️ Плагин "${name}" уже существует!\n`);
    return done();
  }

  fs.mkdirSync(dirPath, { recursive: true });

  const tsTemplate = `export const ${camelName} = (): void => {\n  console.log("Плагин ${name} (TS) инициализирован");\n};\n`;
  const scssTemplate = `.${name} {\n  \n}\n`;

  fs.writeFileSync(path.join(dirPath, `${name}.ts`), tsTemplate);
  fs.writeFileSync(path.join(dirPath, `${name}.scss`), scssTemplate);

  updateAppTs(appJsPath, name, camelName);
  updateStyleScss(styleScssPath, dirPath, name, camelName);

  console.log(`\n✅ Плагин "${name}" (TS: ${camelName}) успешно создан!\n`);
  done();
};
