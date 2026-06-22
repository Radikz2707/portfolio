import { vi, expect } from 'vitest';

// 1. Мокаем Node.js модули для JSDOM (С динамическим пропуском серверных CLI-тестов)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');

  // Внутренний интерфейс состояния Vitest, чтобы TypeScript точно знал про существование testPath
  interface VitestState {
    testPath?: string;
  }

  const checkIsCliTest = (): boolean => {
    if (typeof expect === 'undefined') return false;

    // Сначала приводим к unknown (разрешено), а затем вытаскиваем getState
    const expectWithState = expect as unknown as {
      getState?: () => VitestState;
    };
    const testPath = expectWithState.getState?.()?.testPath;

    return !!testPath?.replace(/\\/g, '/').includes('gulp/tests/');
  };

  return {
    ...actual,
    default: {
      ...actual,
      createReadStream: vi.fn(),
      existsSync: (path: string) => {
        return checkIsCliTest() ? actual.existsSync(path) : false;
      },
    },
    existsSync: (path: string) => {
      return checkIsCliTest() ? actual.existsSync(path) : false;
    },
  };
});

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { default: actual, ...actual };
});

vi.mock('readline', () => ({
  default: { createInterface: vi.fn() },
  createInterface: vi.fn(),
}));

vi.mock('stream', () => {
  const mockTransform = vi.fn().mockImplementation(() => ({
    transform: vi.fn(),
    pipe: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  }));
  return {
    Transform: mockTransform,
    default: { Transform: mockTransform },
  };
});

// 2. Мокаем внешние модули сборщика
vi.mock('mammoth', () => ({ extractRawText: vi.fn(), convertToHtml: vi.fn() }));
vi.mock('gulp', () => ({
  default: {
    src: vi.fn(),
    dest: vi.fn(),
    watch: vi.fn(),
    series: vi.fn(),
    parallel: vi.fn(),
  },
  src: vi.fn(),
  dest: vi.fn(),
  watch: vi.fn(),
  series: vi.fn(),
  parallel: vi.fn(),
}));
vi.mock('gulp-markdown', () => ({ default: vi.fn() }));

// 3. Мокаем конфигурацию проекта
vi.mock('../../gulp.config.js', () => ({
  config: {
    srcFolder: 'src',
    siteName: 'Radik.Dev',
    repoPath: 'Radik/portfolio',
    scssExtension: 'scss',
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
      scripts: { src: 'src/js/app.ts', dest: 'dist/js/', output: 'app.min.js' },
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
      fonts: { src: 'src/fonts/src/**/*.{ttf,otf}', dest: 'dist/fonts/' },
    },
    settings: {
      webpQuality: 70,
      imagemin: { jpeg: 75, png: 5 },
      autoprefixer: ['> 0.5%', 'last 2 versions', 'not dead'],
    },
  },
}));

vi.mock('../src/js/env-config.js', () => ({
  env: { TELEGRAM_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat-id' },
}));

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
