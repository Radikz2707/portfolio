import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import ftp from 'vinyl-ftp';
import dotenv from 'dotenv';
import { onError } from './server.js';

dotenv.config();

const { src } = gulp;

const ftpConfig = {
  host: process.env.FTP_HOST || 'your-hosting.com',
  user: process.env.FTP_USER || 'your_ftp_username',
  password: process.env.FTP_PASSWORD || 'your_ftp_password',
  remotePath: process.env.FTP_DEST || '/public_html/portfolio',
};

export function deploy(done) {
  const isNotConfigured =
    ftpConfig.host.includes('your-hosting.com') ||
    ftpConfig.host.includes('your-ftp-host.com') ||
    ftpConfig.user.includes('your_ftp_username') ||
    ftpConfig.user.includes('your-username') ||
    ftpConfig.password.includes('your_ftp_password') ||
    ftpConfig.password.includes('your-password');

  if (isNotConfigured) {
    console.log('\n==================================================');
    console.warn('⚠️  [DEPLOY WARNING]: FTP-сервер не настроен!');
    console.warn('Заполните реальные доступы в файле .env в корне проекта.');
    console.log('Выгрузка в dist/ завершена. Деплой на хостинг пропущен.');
    console.log('==================================================\n');
    done();
    return;
  }
  console.log(
    'Выгрузка ресурсов в dist/ завершена локально. Деплой на хостинг пропущен.',
  );
  done();
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
  encoding: false,
})
  .pipe(conn.dest(ftpConfig.remotePath))
  .on('error', onError)
  .on('end', () => {
    console.log('✅ Проект успешно загружен на FTP-сервер!');
    done();
  });

export default deploy;
