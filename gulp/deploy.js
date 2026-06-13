import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import ftp from 'vinyl-ftp';
import dotenv from 'dotenv'; // 🔥 ДОБАВЛЕНО: Для чтения файла .env
import { onError } from './server.js';

// 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Активируем чтение переменных окружения
dotenv.config();

const { src } = gulp;

// Настройки FTP со строгим сопоставлением с вашим файлом .env
const ftpConfig = {
  host: process.env.FTP_HOST || 'your-hosting.com',
  user: process.env.FTP_USER || 'your_ftp_username',
  password: process.env.FTP_PASSWORD || 'your_ftp_password',
  remotePath: process.env.FTP_DEST || '/public_html/portfolio',
};

export function deploy(done) {
  // 🔥 МАКСИМАЛЬНЫЙ КОНТРОЛЬ: Перехватываем дефолтные заглушки до старта сети
  const isNotConfigured =
    ftpConfig.host.includes('your-hosting.com') ||
    ftpConfig.host.includes('your-ftp-host.com') ||
    ftpConfig.user.includes('your_ftp_username') ||
    ftpConfig.user.includes('your-username') ||
    ftpConfig.password.includes('your_ftp_password') ||
    ftpConfig.password.includes('your-password');

  if (isNotConfigured) {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      '⚠️  [Deploy Warning] FTP сервер не настроен! Заполните доступы в файле .env.',
    );
    console.log(
      'Выгрузка ресурсов в dist/ завершена локально. Деплой на хостинг пропущен.',
    );
    done(); // Безопасно завершаем задачу без зависания консоли
    return;
  }

  // Если данные изменены на реальные — создаем соединение
  const conn = ftp.create({
    host: ftpConfig.host,
    user: ftpConfig.user,
    password: ftpConfig.password,
    parallel: 10,
    log: console.log,
  });

  // Заливаем скомпилированную папку продакшена на сервер
  return src(path.join(config.buildFolder, '**', '*'), {
    base: config.buildFolder,
    buffer: false,
    encoding: false, // Защита Gulp 5 от повреждения бинарных файлов (картинок) при передаче
  })
    .pipe(conn.dest(ftpConfig.remotePath))
    .on('error', onError)
    .on('end', () => {
      console.log('✅ Проект успешно загружен на FTP-сервер!');
      done();
    });
}

export default deploy;
