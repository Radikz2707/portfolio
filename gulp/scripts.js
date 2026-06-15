// === ОБНОВЛЕННЫЙ GULP/SCRIPTS.JS ===
import { config } from '../gulp.config.js';
import gulp from 'gulp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import plumber from 'gulp-plumber';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const webpackStream = require('webpack-stream');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

import { onError, isProd, bs } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { src, dest } = gulp;

export function scripts() {
  const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    target: ['web', 'es2015'],
    watch: false,
    performance: { hints: false },
    entry: {
      app: path.resolve(config.paths.scripts.src),
    },
    output: {
      // Поддерживаем динамическое имя в зависимости от чанка
      filename: '[name].min.js',
      chunkFilename: 'js/chunks/chunk-[name].js',
      publicPath: '/',
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
    // 🔥 КРИТИЧЕСКИЙ БЛОК: ОПТИМИЗАЦИЯ И РАЗДЕЛЕНИЕ КОДА
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
            format: { comments: false },
          },
        }),
      ],
      // Настройка автоматического разделения кода
      splitChunks: {
        cacheGroups: {
          // Выносим все сторонние зависимости из node_modules в vendor
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all',
            enforce: true,
            minSize: 0,
            minChunks: 1,
          },
        },
      },
    },
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
  };

  const pipeline = [
    src(config.paths.scripts.src, { encoding: false }),
    plumber({ errorHandler: onError }),
    webpackStream(webpackConfig, webpack, function (err, stats) {
      if (err) return;
      if (stats.hasErrors()) {
        console.error(stats.toString('minimal'));
        if (typeof onError === 'function') {
          onError.call(this, new Error('Webpack compilation failed.'));
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
