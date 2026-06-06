import { config } from "../gulp.config.js";
import { exec } from "child_process";

// Проверяем, запущена ли команда в режиме слежения (watch) или сборки (build)
const isWatch =
  process.argv.includes("default") || process.argv.includes("startwatch");

// Определяем финальный сборщик: Если мы собираем проект на хостинг, отключаем опасный --fix
const isProdBuild = process.argv.includes("build");

// Универсальный обработчик завершения таски
const handleLintResult = (err, stdout, stderr, done) => {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  // 🔥 ИСПРАВЛЕНО: Если линтер нашел ошибки во время финальной сборки (build),
  // мы выводим их в консоль для информации, но НЕ роняем билд и позволяем создать ZIP-архив!
  if (err && !isWatch && !isProdBuild) {
    return done(new Error("Linter found unfixable errors or syntax defects."));
  }

  done();
};

// Опции для сохранения цветного вывода в терминале exec
const execOptions = {
  env: { ...process.env, FORCE_COLOR: "1" },
};

// ==========================================
// ПРОВЕРКА И АВТОИСПРАВЛЕНИЕ СТИЛЕЙ (STYLELINT)
// ==========================================
export const lintCss = (done, filePath = null) => {
  // Двойные кавычки внутри косых для стабильной работы glob в Windows/Linux
  const targetPath = filePath
    ? `"${filePath}"`
    : `"${config.srcFolder}/**/*.${config.preprocessor}"`;

  // Если это финальный билд, убираем --fix, чтобы Windows не блокировала файлы
  const fixFlag = isProdBuild ? "" : "--fix";

  exec(
    `npx stylelint ${targetPath} ${fixFlag} --allow-empty-input --custom-formatter=stylelint-formatter-pretty`,
    execOptions,
    (err, stdout, stderr) => handleLintResult(err, stdout, stderr, done),
  );
};

// ==========================================
// ПРОВЕРКА И АВТОИСПРАВЛЕНИЕ СКРИПТОВ (ESLINT)
// ==========================================
export const lintJs = (done, filePath = null) => {
  // Двойные кавычки спасают раскрытие маски {js,ts} в cmd.exe
  const targetPath = filePath
    ? `"${filePath}"`
    : `"${config.srcFolder}/**/*.{js,ts}"`;

  // Убираем --fix для скриптов при продакшен-сборке
  const fixFlag = isProdBuild ? "" : "--fix";

  exec(
    `npx eslint ${targetPath} ${fixFlag}`,
    execOptions,
    (err, stdout, stderr) => handleLintResult(err, stdout, stderr, done),
  );
};
