import fs from 'fs';
import path from 'path';
import slugify from 'slugify';

const contentDir = path.resolve('src', 'content');

function renameFilesRecursively(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Идем вглубь папок категорий
      renameFilesRecursively(fullPath);
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      const nameWithoutExt = path.basename(file, ext);

      // Проверяем, есть ли в имени русские буквы
      if (/[а-яА-ЯёЁ]/.test(nameWithoutExt)) {
        // Транслитерируем имя файла по правилам CMS
        const newName = slugify(nameWithoutExt, {
          replacement: '-',
          remove: /[*+~.()'"!:@]/g,
          lower: true,
          strict: true,
          locale: 'ru',
        });

        const newFullPath = path.join(dir, `${newName}${ext}`);

        fs.renameSync(fullPath, newFullPath);
        console.log(`✅ Переименован: ${file} ➡️ ${newName}${ext}`);
      }
    }
  });
}

console.log('🚀 Запуск массового переименования файлов контента...');
renameFilesRecursively(contentDir);
console.log('🎉 Все файлы успешно переименованы в латиницу!');
