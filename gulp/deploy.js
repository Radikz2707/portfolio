import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import fs from "fs";
import ftp from "vinyl-ftp";
import logSymbols from "log-symbols";

// Импорт dotenv для чтения скрытых переменных окружения из .env
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();

const { src } = gulp;

export function deploy(done) {
  // Автоматически присваиваем значения-заглушки, если переменные пустые
  process.env.FTP_HOST = process.env.FTP_HOST || "your-hosting.com";
  process.env.FTP_USER = process.env.FTP_USER || "your_ftp_username";
  process.env.FTP_PASSWORD = process.env.FTP_PASSWORD || "your_ftp_password";

  // Проверяем, содержатся ли в переменных значения-заглушки
  const isUsingPlaceholder =
    process.env.FTP_HOST === "your-hosting.com" ||
    process.env.FTP_USER === "your_ftp_username" ||
    process.env.FTP_PASSWORD === "your_ftp_password";

  if (isUsingPlaceholder) {
    console.log(
      `\n${logSymbols.warning} \x1b[33mХостинг не настроен\x1b[0m\n`,
    );
    console.log(
      `\x1b[33mПожалуйста, настройте FTP-доступ в файле .env:\x1b[0m`,
    );
    console.log(`  FTP_HOST=ваш-хостинг`);
    console.log(`  FTP_USER=ваш-ftp-логин`);
    console.log(`  FTP_PASSWORD=ваш-ftp-пароль\n`);
    return done();
  }

  // Защита: Автоматически вырезаем протоколы (ftp://, http://), если они указаны в .env
  const cleanHost = process.env.FTP_HOST.replace(
    /^ftp:\/\/|^https:\/\/|^http:\/\//i,
    "",
  ).trim();

  // Настраиваем FTP соединение
  const conn = ftp.create({
    host: cleanHost,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    parallel: 5,
    log: function (msg) {
      if (msg.includes("UP")) console.log(`📡 Загрузка: ${msg}`);
    },
  });

  // Находим самый свежий созданный zip-архив в папке archives
  const archiveDir = path.resolve("./archives");
  if (!fs.existsSync(archiveDir)) {
    console.error(
      `\n${logSymbols.error} \x1b[31mОшибка:\x1b[0m Папка archives не найдена. Сначала соберите проект через build.\n`,
    );
    return done();
  }

  const files = fs.readdirSync(archiveDir).filter((f) => f.endsWith(".zip"));
  if (files.length === 0) {
    console.error(
      `\n${logSymbols.error} \x1b[31mОшибка:\x1b[0m В папке archives нет ZIP-файлов для отправки.\n`,
    );
    return done();
  }

  // Сортируем архивы по дате изменения, чтобы взять самый актуальный
  files.sort((a, b) => {
    return (
      fs.statSync(path.join(archiveDir, b)).mtime.getTime() -
      fs.statSync(path.join(archiveDir, a)).mtime.getTime()
    );
  });

  const latestArchive = path.join(archiveDir, files[0]);
  console.log(
    `\n${logSymbols.info} \x1b[36mНайден свежий архив:\x1b[0m ${files[0]}`,
  );
  console.log(
    `${logSymbols.info} \x1b[36mУстанавливаю соединение с сервером...\x1b[0m\n`,
  );

  const remoteFolder = process.env.FTP_DEST || "/";

  return src(latestArchive)
    .pipe(conn.dest(remoteFolder))
    .on("end", () => {
      console.log(
        `\n${logSymbols.success} \x1b[32mАрхив успешно доставлен на хостинг в директорию: ${remoteFolder}!\x1b[0m\n`,
      );
      done();
    });
}
