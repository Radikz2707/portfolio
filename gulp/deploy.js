import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import ftp from 'vinyl-ftp';
import dotenv from 'dotenv';

dotenv.config();

const { src } = gulp;

export function deploy(done) {
  const ftpConfig = {
    host: process.env.FTP_HOST || 'your-hosting.com',
    user: process.env.FTP_USER || 'your_ftp_username',
    password: process.env.FTP_PASSWORD || 'your_ftp_password',
    remotePath: process.env.FTP_DEST || '/public_html/portfolio',
  };

  const isNotConfigured =
    !process.env.FTP_HOST || 
    process.env.FTP_HOST === 'your-hosting.com' ||
    !process.env.FTP_USER || 
    process.env.FTP_USER === 'your_ftp_username';

  if (isNotConfigured) {
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    
    console.log(`\n${yellow}==================================================`);
    console.warn('⚠️  [DEPLOY WARNING]: FTP-сервер не настроен!');
    console.warn('Пожалуйста, укажите FTP_HOST и FTP_USER в файле .env');
    console.log(`Деплой на удаленный сервер пропущен.${reset}`);
    console.log(`${yellow}==================================================\n${reset}`);
    return done();
  }

  console.log('🚀 Начинаю деплой на FTP-сервер...');

  const conn = ftp.create({
    host: ftpConfig.host,
    user: ftpConfig.user,
    password: ftpConfig.password,
    parallel: 10,
    log: console.log,
  });

  return src(path.join(config.buildFolder, '**', '*'), {
    base: config.buildFolder,
    buffer: false,
    encoding: false,
  })
    .pipe(conn.dest(ftpConfig.remotePath))
    .on('error', (err) => {
      console.error('❌ Ошибка деплоя:', err.message);
      done(err);
    })
    .on('end', () => {
      console.log('✅ Проект успешно загружен на FTP-сервер!');
      done();
    });
}

export default deploy;
