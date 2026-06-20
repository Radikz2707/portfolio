import fs from 'fs';
import path from 'path';
import { config } from '../../gulp.config.js';

const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const updateFileContent = (filePath, modifyCallback) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = modifyCallback(content);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
  }
};

export function create(done) {
  const args = process.argv.slice(3);
  const name = args[0]?.replace(/^---/, '');

  if (!name) {
    console.error('❌ Ошибка: Укажите имя блока (например: npm run create ---my-block)');
    return done();
  }

  const struct = config.structure;
  const scssExt = config.scssExtension;
  const blockDir = path.join(struct.components, name);

  if (fs.existsSync(blockDir)) {
    console.error(`❌ Ошибка: Блок "${name}" уже существует!`);
    return done();
  }

  // Создаем папки
  fs.mkdirSync(blockDir, { recursive: true });
  fs.mkdirSync(path.join(blockDir, 'img'), { recursive: true });

  // Генерируем файлы
  fs.writeFileSync(path.join(blockDir, `${name}.html`), `<section class="${name}">\n  <div class="${name}__container container">\n    <h2>${name} Component</h2>\n  </div>\n</section>`);
  fs.writeFileSync(path.join(blockDir, `${name}.${scssExt}`), `.${name} {\n  padding: 50px 0;\n}`);
  fs.writeFileSync(path.join(blockDir, `${name}.ts`), `export const ${toCamelCase(name)} = (): void => {\n  console.log('Блок ${name} (TS) инициализирован');\n};`);

  // 1. Подключаем в style.scss
  const stylePath = path.join(config.srcFolder, scssExt, `style.${scssExt}`);
  updateFileContent(stylePath, (content) => {
    const importStr = `@use '../components/${name}/${name}';`;
    if (content.includes(importStr)) return content;
    const lines = content.split('\n');
    const lastImportIndex = lines.findLastIndex(line => line.startsWith('@use'));
    lines.splice(lastImportIndex + 1, 0, importStr);
    return lines.join('\n');
  });

  // 2. Подключаем в app.ts
  const appPath = path.join(config.srcFolder, 'js', 'app.ts');
  updateFileContent(appPath, (content) => {
    const importStr = `import { ${toCamelCase(name)} } from '../components/${name}/${name}';`;
    const callStr = `${toCamelCase(name)}();`;
    let newContent = content;
    if (!newContent.includes(importStr)) {
      newContent = newContent.replace('import { themeToggle }', `${importStr}\nimport { themeToggle }`);
    }
    if (!newContent.includes(callStr)) {
      newContent = newContent.replace('// [ВЫЗОВЫ ГЛАВНАЯ]', `${callStr}\n    // [ВЫЗОВЫ ГЛАВНАЯ]`);
    }
    return newContent;
  });

  console.log(`✅ Блок "${name}" успешно создан и подключен!`);
  done();
}
