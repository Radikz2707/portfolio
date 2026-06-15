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
  const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    target: ['web', 'es2015'], // 🔥 Исправлено: Гарантирует кроссбраузерность и работу JS на старых iOS/Android
    watch: false,
    performance: { hints: false },
    entry: {
      app: path.resolve(config.paths.scripts.src),
    },
    output: {
      filename: config.paths.scripts.output,
      chunkFilename: 'js/chunks/chunk-[name].js',
      publicPath: '/', // 🔥 Исправлено: Защищает динамические чанки от поломки путей внутри страниц блога
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
                transpileOnly: !isProd,
                compilerOptions: {
                  noEmit: false,
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
          extractComments: false,
          terserOptions: {
            compress: {
              drop_console: isProd,
              drop_debugger: isProd,
              dead_code: true,
              passes: 2,
            },
            format: {
              comments: false,
            },
          },
        }),
      ],
    },
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
  };

  const pipeline = [
    src(config.paths.scripts.src, { encoding: false }),
    plumber({ errorHandler: onError }),
    webpackStream(webpackConfig, webpack, (err, stats) => {
      if (err) return;
      if (stats.hasErrors()) {
        console.error(stats.toString('minimal'));
        // 🔥 Исправлено: Оповещаем plumber об ошибке, предотвращая зависание файлового вотчера
        if (typeof onError === 'function') {
          onError(
            new Error('Webpack compilation failed. Check terminal output.'),
          );
        }
      }
    }),
    dest(config.paths.scripts.dest),
  ];

  return pipeline
    .reduce((stream, plugin) => stream.pipe(plugin))
    .on('end', () => {
      bs.reload();
    });
}
