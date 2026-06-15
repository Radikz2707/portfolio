import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import fs from 'fs';
import plumber from 'gulp-plumber';
import fonter from 'gulp-fonter';
import ttf2woff2 from 'gulp-ttf2woff2';

import { onError, bs } from './server.js';

const { src, dest } = gulp;

export function fonts(done) {
  const sourceDir = path.dirname(config.paths.fonts.src).replace(/\*\*$/, '');

  if (!fs.existsSync(sourceDir) || fs.readdirSync(sourceDir).length === 0) {
    console.log('ℹ️ Шрифты не найдены, пропускаем конвертацию.');
    return done();
  }

  return (
    src(config.paths.fonts.src, { encoding: false, allowEmpty: true })
      .pipe(plumber({ errorHandler: onError }))
      .pipe(fonter({ formats: ['woff'] }))
      .pipe(dest(config.paths.fonts.dest))
      // 🔥 Исправлено: Динамически берем путь к TTF из gulp.config.js вместо хардкода папки
      .pipe(src(config.paths.fonts.src, { encoding: false, allowEmpty: true }))
      .pipe(ttf2woff2())
      .pipe(dest(config.paths.fonts.dest))
      .on('end', () => {
        bs.reload();
        done();
      })
      .on('error', (err) => {
        console.error('Ошибка при обработке шрифтов:', err);
        bs.reload();
        done();
      })
  );
}

export function fontsStyle(done) {
  const extension = config.preprocessor === 'sass' ? 'sass' : 'scss';
  const fontsFile = path.join(
    config.srcFolder,
    config.preprocessor,
    'base',
    `_fonts.${extension}`,
  );

  if (!fs.existsSync(config.paths.fonts.dest)) return done();

  const files = fs
    .readdirSync(config.paths.fonts.dest)
    .filter((file) => file.endsWith('.woff2'));
  if (files.length === 0) return done();

  fs.writeFileSync(fontsFile, '');

  files.forEach((file) => {
    const fontFileName = path.basename(file, path.extname(file));

    // 🔥 Исправлено: Улучшенное регулярное выражение для корректного сохранения составных имен вроде "Open-Sans" или "Ubuntu-Condensed"
    const fontName = fontFileName.replace(
      /-(thin|extralight|light|regular|medium|semibold|bold|extrabold|heavy|black|italic)/gi,
      '',
    );

    const fontInfo = fontFileName.toLowerCase();

    let fontWeight = 400;
    if (fontInfo.includes('thin')) fontWeight = 100;
    else if (fontInfo.includes('extralight')) fontWeight = 200;
    else if (fontInfo.includes('light')) fontWeight = 300;
    else if (fontInfo.includes('medium')) fontWeight = 500;
    else if (fontInfo.includes('semibold')) fontWeight = 600;
    else if (fontInfo.includes('bold')) fontWeight = 700;
    else if (fontInfo.includes('extrabold') || fontInfo.includes('heavy'))
      fontWeight = 800;
    else if (fontInfo.includes('black')) fontWeight = 900;

    const fontStyle = fontInfo.includes('italic') ? 'italic' : 'normal';
    const fontRecord = `@font-face {\n\tfont-family: "${fontName}";\n\tfont-display: swap;\n\tsrc: url("../fonts/${fontFileName}.woff2") format("woff2");\n\tfont-weight: ${fontWeight};\n\tfont-style: ${fontStyle};\n}\n\n`;

    fs.appendFileSync(fontsFile, fontRecord);
  });

  console.log(`📝 Файл _fonts.${extension} успешно обновлен.`);
  done();
}
