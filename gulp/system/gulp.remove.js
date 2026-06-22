import fs from 'fs';
import path from 'path';
import { config } from '../../gulp.config.js';

const PROTECTED_NAMES = [
  'js',
  'scss',
  'html',
  'img',
  'fonts',
  'components',
  'modules',
  'src',
  'dist',
  'plugins',
];

const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const updateFileContent = (filePath, modifyCallback) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const updatedContent = modifyCallback(content);
  fs.writeFileSync(filePath, updatedContent.trimEnd() + '\n');
};

const cleanAppTs = (filePath, blockName, camelName) => {
  updateFileContent(filePath, (content) => {
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      const isTargetImport =
        trimmed.startsWith('import ') &&
        (trimmed.includes(`/${blockName}/`) ||
          trimmed.includes(`/${blockName}"`) ||
          trimmed.includes(`/${blockName}'`) ||
          trimmed.includes(`@comp/${blockName}/`) ||
          trimmed.includes(`@comp/${blockName}"`) ||
          trimmed.includes(`@comp/${blockName}'`) ||
          trimmed.includes(`@modules/${blockName}/`) ||
          trimmed.includes(`@modules/${blockName}"`) ||
          trimmed.includes(`@modules/${blockName}'`));
      const isTargetCall = trimmed.replace(/\s+/g, '') === `${camelName}();`;
      return !isTargetImport && !isTargetCall;
    });
    return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
  });
  console.log('✂️ Импорты и вызовы TS успешно удалены.');
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
    return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
  });
  console.log(`✂️ Стили удалены из style.${config.scssExtension}`);
};

const cleanIndexHtml = (filePath, blockName) => {
  updateFileContent(filePath, (content) => {
    const htmlIncludeReg = new RegExp(
      `@@include\\(['"].*?${blockName}/${blockName}.html['"]\\)\\r?\\n?`,
      'g',
    );
    return content.replace(htmlIncludeReg, '').replace(/\n{3,}/g, '\n\n');
  });
  console.log('✂️ Инклуд удален из HTML.');
};

const checkDirectorySafety = (dirPath) => {
  if (!fs.existsSync(dirPath)) return true;
  if (!fs.statSync(dirPath).isDirectory()) return true;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) return false;

    const content = fs.readFileSync(fullPath, 'utf-8').trim();

    if (file.endsWith('.html')) {
      const cleanContent = content.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (
        cleanContent.length > 0 &&
        !cleanContent.includes('Шаблон компонента')
      )
        return false;
    }

    if (file.endsWith('.scss') || file.endsWith('.sass')) {
      const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/@use\s+['"][^'"]+['"]\s*as\s+\w+;/g, '')
        .trim();
      if (cleanContent.length > 0) return false;
    }

    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(
          /export\s+const\s+\w+\s*=\s*\(\)\s*=>\s*\{\s*console\.log\(.*?\);\s*\};/g,
          '',
        )
        .trim();
      if (cleanContent.length > 0) return false;
    }
  }
  return true;
};

export const remove = (done) => {
  const blockName = process.argv
    .find((arg) => arg.startsWith('--'))
    ?.replace('--', '');
  if (!blockName) {
    console.log('\n❌ Ошибка: Укажите имя! Пример: gulp remove --header\n');
    return done();
  }
  if (PROTECTED_NAMES.includes(blockName.toLowerCase())) {
    console.log(
      `\n❌ Ошибка: Удаление системной папки "${blockName}" запрещено!\n`,
    );
    return done();
  }

  const camelName = toCamelCase(blockName);
  const possibleDirs = [
    path.join(config.structure.components, blockName),
    path.join(config.structure.modules, blockName),
    path.join(config.structure.plugins, blockName),
  ];
  const possibleFiles = [
    path.join(config.structure.modules, `${blockName}.ts`),
    path.join(config.structure.plugins, `${blockName}.ts`),
  ];

  for (const dir of possibleDirs) {
    if (fs.existsSync(dir) && !checkDirectorySafety(dir)) {
      console.log(
        `\n🛑 Защита: Компонент "${blockName}" содержит рабочий код и не может быть удален автоматически!\n`,
      );
      return done(new Error('Попытка удаления заполненного компонента.'));
    }
  }

  const mainJsPath = config.paths.scripts.src;
  const mainScssPath = path.join(
    config.srcFolder,
    config.scssExtension,
    `style.${config.scssExtension}`,
  );
  const indexHtmlPath = path.join(config.srcFolder, 'index.html');
  let dirDeleted = false;

  possibleDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️ Папка удалена: ${dir}`);
      dirDeleted = true;
    }
  });

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
