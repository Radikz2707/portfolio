import { vi } from 'vitest';

// Мокаем Node.js модули для JSDOM
vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  },
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('path', () => ({
  default: {
    resolve: vi.fn(),
    join: vi.fn(),
    extname: vi.fn(),
    basename: vi.fn(),
    dirname: vi.fn(),
  },
}));

vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn(),
  },
}));

vi.mock('stream', () => ({
  Transform: vi.fn().mockImplementation(() => ({
    transform: vi.fn(),
    pipe: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })),
  default: {
    Transform: vi.fn().mockImplementation(() => ({
      transform: vi.fn(),
      pipe: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    })),
  },
}));

// Мокаем внешние модули
vi.mock('mammoth', () => ({
  extractRawText: vi.fn(),
  convertToHtml: vi.fn(),
}));

vi.mock('gulp', () => ({
  default: {
    src: vi.fn(),
    dest: vi.fn(),
    watch: vi.fn(),
    series: vi.fn(),
    parallel: vi.fn(),
  },
}));

vi.mock('gulp-markdown', () => ({ default: vi.fn() }));

// Мокаем конфигурацию
vi.mock('../../gulp.config.js', () => ({
  config: {
    srcFolder: 'src',
    siteName: 'Radik.Dev',
    repoPath: 'Radik/portfolio',
    structure: {
      components: 'src/components',
      modules: 'src/js/modules',
      plugins: 'src/js/plugins',
    },
    aliasPath: 'src/js',
    paths: {
      styles: {
        src: 'src/scss/style.scss',
        dest: 'dist/css/',
        output: 'app.min.css',
      },
      scripts: {
        src: 'src/js/app.ts',
        dest: 'dist/js/',
        output: 'app.min.js',
      },
      images: {
        src: 'src/images/**/*',
        dest: 'dist/images/',
        svg: 'src/images/**/*.svg',
      },
      favicons: {
        src: 'src/images/src/favicon.png',
        dest: 'dist/images/favicons/',
        htmlOutput: 'src/parts/favicon-links.html',
      },
      fonts: {
        src: 'src/fonts/src/**/*.{ttf,otf}',
        dest: 'dist/fonts/',
      },
    },
    settings: {
      webpQuality: 70,
      imagemin: {
        jpeg: 75,
        png: 5,
      },
      autoprefixer: ['> 0.5%', 'last 2 versions', 'not dead'],
    },
  },
}));

// Мокаем env-config
vi.mock('../src/js/env-config.js', () => ({
  env: {
    TELEGRAM_TOKEN: 'test-token',
    TELEGRAM_CHAT_ID: 'test-chat-id',
  },
}));

// Мокаем content-processor.js
vi.mock('../../gulp/utils/content-processor.js', () => ({
  parsePlainText: vi.fn(
    (content) => content?.replace(/<[^>]*>/g, '').trim() || '',
  ),
  generateSidebarLinks: vi.fn(() => ''),
  processHtmlContent: vi.fn((html) => html || ''),
  compileContentStream: vi.fn(() => ({})),
  wrapInMasterLayout: vi.fn(() => {}),
  default: vi.fn(() => {}),
}));
