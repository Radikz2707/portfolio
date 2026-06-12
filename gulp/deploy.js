import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import ftp from 'vinyl-ftp';
import util from 'gulp-util';
import { onError } from './server.js';

const { src, dest } = gulp;

// Настройки FTP
const ftpConfig = {
  host: process.env.FTP_HOST || 'your-ftp-host.com',
  user: process.env.FTP_USER || 'your-username',
  password: process.env.FTP_PASSWORD || 'your-password',
  remotePath: process.env.FTP_REMOTE_PATH || '/public_html/',
};

export function deploy(done) {
  const conn = ftp.create(ftpConfig);

  return src(path.join(config.buildFolder, '**', '*'), {
    base: config.buildFolder,
    buffer: false,
  })
    .pipe(
      util.env.production
        ? conn.dest(ftpConfig.remotePath)
        : conn.dest(ftpConfig.remotePath),
    )
    .on('error', onError)
    .on('end', () => {
      console.log('✅ Проект успешно загружен на сервер!');
      done();
    });
}

export default deploy;
