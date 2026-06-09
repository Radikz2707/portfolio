import { config } from "../gulp.config.js";
import gulp from "gulp";
import path from "path";
import plumber from "gulp-plumber";

import { createRequire } from "module"; 
const require = createRequire(import.meta.url); 
const webpackStream = require("webpack-stream");

import webpack from "webpack"; 
import TerserPlugin from "terser-webpack-plugin";

import { onError, isProd, bs } from "./server.js";

const { src, dest } = gulp;

export function scripts(done) { 
  let isFirstBuild = true;

  const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    watch: !isProd,
    // Кэшируем сборку в оперативной памяти, убирая конфликты с диском Windows
    cache: isProd ? false : { type: 'memory' },
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
                transpileOnly: !isProd, // Максимальное ускорение в dev-режиме
                /* 🔥 ИСПРАВЛЕНО: Принудительно разрешаем генерацию кода для потока Webpack */
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
      minimizer: [new TerserPlugin({ extractComments: false })],
    },
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
  };

  const stream = src(config.paths.scripts.src) 
    .pipe(plumber({ errorHandler: onError })) 
    .pipe( 
      webpackStream(webpackConfig, webpack, (err, stats) => { 
        if (err) return;
        if (!isProd) { 
          if (isFirstBuild) { 
            isFirstBuild = false; 
            done(); 
          } 
          bs.reload(); 
        } 
      }), 
    ) 
    .pipe(dest(config.paths.scripts.dest));

  if (isProd) { 
    return stream.on("end", done); 
  } 
}