import { config } from "../gulp.config.js";
import { exec } from "child_process";

// Проверяем, запущена ли команда в режиме слежения (watch) или сборки (build)
const isWatch =
  process.argv.includes("default") || process.argv.includes("startwatch");

// Универсальный обработчик завершения таски
const handleLintResult = (err, stdout, stderr, done) => {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  // Если запущен финальный билд на хостинг и линтер нашёл КРИТИЧЕСКИЕ ошибки синтаксиса,
  // которые он не смог исправить через --fix, мы останавливаем деплой!
  if (err && !isWatch) {
    return done(
      new Error(
        "Linter found unfixable errors or syntax defects. Fix them before deploy.",
      ),
    );
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
  const targetPath = filePath
    ? `"${filePath}"`
    : `"${config.srcFolder}/**/*.${config.preprocessor}"`;

  // 🔥 ИСПРАВЛЕНО: Теперь --fix работает ВСЕГДА. Линтер сам расставит свойства перед деплоем
  const fixFlag = "--fix";

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
  const targetPath = filePath
    ? `"${filePath}"`
    : `"${config.srcFolder}/**/*.{js,ts}"`;

  // 🔥 ИСПРАВЛЕНО: Включаем автоисправление скриптов для всех режимов
  const fixFlag = "--fix";

  exec(
    `npx eslint ${targetPath} ${fixFlag}`,
    execOptions,
    (err, stdout, stderr) => handleLintResult(err, stdout, stderr, done),
  );
};
