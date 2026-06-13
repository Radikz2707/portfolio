import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import plumber from 'gulp-plumber';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpackStream = require('webpack-stream');
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

import { onError, isProd, bs } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { src, dest } = gulp;

export function scripts() {
  // Базовая конфигурация Webpack, общая для обоих режимов
  const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ ДЛЯ GULP 5: Отключаем встроенный watch вебпака в dev-режиме,
    // так как за пересборку теперь полностью отвечает наш стабильный файловый watcher из server.js
    watch: false,
    performance: { hints: false },
    entry: {
      app: path.resolve(config.paths.scripts.src),
    },
    output: {
      filename: config.paths.scripts.output,
      chunkFilename: 'js/chunks/chunk-[name].js',
    },
    resolve: {
      alias: {
        '@': path.resolve(config.aliasPath),
        '@comp': path.resolve(config.structure.components),
        '@modules': path.resolve(config.structure.modules),
      },
      extensions: ['.ts', '.js', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, '../tsconfig.json'),
                // transpileOnly гарантирует молниеносную скорость в режиме разработки,
                // отключая тяжелую проверку типов на каждом сохранении (её делает npm run lint)
                transpileOnly: !isProd,
                compilerOptions: {
                  noEmit: false, // Принудительно разрешаем генерацию кода для потока Webpack
                },
              },
            },
          ],
        },
        {
          test: /\.m?js$/,
          exclude: /node_modules/,
          type: 'javascript/auto',
        },
      ],
    },
    optimization: {
      minimize: isProd,
      minimizer: [
        new TerserPlugin({
          extractComments: false, // Отключает генерацию файлов .LICENSE.txt
          terserOptions: {
            compress: {
              drop_console: isProd, // 🔥 Удаляет все console.log() строго на продакшене
              drop_debugger: isProd, // Удаляет дебаггеры
              dead_code: true, // Вырезает неиспользуемый код
              passes: 2, // Повторный проход для максимального сжатия
            },
            format: {
              comments: false, // Полностью удаляет комментарии из бандла
            },
          },
        }),
      ],
    },
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
  };

  // Инициализируем пайплайн. В Gulp 5 для скриптов тоже отключаем кодировку строк ({ encoding: false }),
  // чтобы минифицированный JS и бинарные карты кода (.map) не повредились при потоковой записи.
  const pipeline = [
    src(config.paths.scripts.src, { encoding: false }),
    plumber({ errorHandler: onError }),
    // Передаем кастомный логгер в коллбэк webpack-stream для вывода статистики компиляции
    webpackStream(webpackConfig, webpack, (err, stats) => {
      if (err) return;
      if (stats.hasErrors()) {
        console.error(stats.toString('minimal'));
      }
    }),
    dest(config.paths.scripts.dest),
  ];

  // Склеиваем стримы черезreduce и триггерим обновление браузера
  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', () => {
      bs.reload();
    });
}
