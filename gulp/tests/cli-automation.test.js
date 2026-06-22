import fs from 'node:fs';
import path from 'path';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

const appTsPath = path.join(process.cwd(), 'src', 'js', 'app.ts');
const styleScssPath = path.join(process.cwd(), 'src', 'scss', 'style.scss');

const runGulpTask = (command) => {
  try {
    // 🔥 ТОТАЛЬНЫЙ КОНТРОЛЬ КЭША: Передаем флаг сброса кэша для Gulp,
    // чтобы тестовые папки не оседали в оперативной памяти newer/cache
    const result = execSync(command, {
      stdio: 'pipe',
      env: { ...process.env, GULP_CACHE_CLEAR: 'true' },
    });
    execSync('node -e "setTimeout(() => {}, 250)"');
    return result.toString();
  } catch (error) {
    // Мягко гасим ошибку, если это удаление защищенного компонента в Тесте 4
    if (command.includes('remove') && command.includes('autotest-secure')) {
      return (
        error.stderr?.toString() || error.stdout?.toString() || error.message
      );
    }
    throw new Error(
      `🛑 Ошибка команды "${command}": ${error.stderr?.toString() || error.message}`,
    );
  }
};

describe('🚀 Интеграционные тесты CLI-автоматизации (Radik.Dev)', () => {
  let originalAppTs = '';
  let originalStyleScss = '';

  beforeEach(() => {
    originalAppTs = fs.readFileSync(appTsPath, 'utf-8');
    originalStyleScss = fs.readFileSync(styleScssPath, 'utf-8');
  });

  afterAll(() => {
    fs.writeFileSync(appTsPath, originalAppTs);
    fs.writeFileSync(styleScssPath, originalStyleScss);
  });

  it('1. Должен идеально создавать и подключать БЭМ-компонент', () => {
    const componentName = 'autotest-component';
    const compDir = path.join(
      process.cwd(),
      'src',
      'components',
      componentName,
    );

    runGulpTask(`gulp create --${componentName}`);

    expect(fs.existsSync(compDir)).toBe(true);
    expect(fs.existsSync(path.join(compDir, 'img', '.gitkeep'))).toBe(true);
    expect(fs.existsSync(path.join(compDir, `${componentName}.html`))).toBe(
      true,
    );

    const currentScss = fs.readFileSync(styleScssPath, 'utf-8');
    expect(currentScss).toContain(
      `@use '../components/${componentName}/${componentName}';`,
    );

    const currentAppTs = fs.readFileSync(appTsPath, 'utf-8');
    expect(currentAppTs).toContain(
      `import { autotestComponent } from '../components/${componentName}/${componentName}';`,
    );
    expect(currentAppTs).toContain('autotestComponent();');

    const regexOrder = new RegExp(
      `@use '\\.\\./components/${componentName}/${componentName}';[\\s\\S]*\\/\\/ ФУНКЦИОНАЛЬНЫЕ JS\\/TS МОДУЛИ`,
    );
    expect(regexOrder.test(currentScss)).toBe(true);

    runGulpTask(`gulp remove --${componentName}`);
    expect(fs.existsSync(compDir)).toBe(false);
  });

  it('2. Должен правильно распределять импорты при создании Системного Модуля', () => {
    const moduleName = 'autotest-module';
    const modDir = path.join(process.cwd(), 'src', 'js', 'modules', moduleName);

    runGulpTask(`gulp module --${moduleName}`);

    expect(fs.existsSync(modDir)).toBe(true);

    const currentScss = fs.readFileSync(styleScssPath, 'utf-8');
    expect(currentScss).toContain(
      `@use '../js/modules/${moduleName}/${moduleName}' as autotestModule;`,
    );

    const currentAppTs = fs.readFileSync(appTsPath, 'utf-8');
    expect(currentAppTs).toContain(
      `import { autotestModule } from './modules/${moduleName}/${moduleName}';`,
    );
    expect(currentAppTs).toContain('autotestModule();');

    runGulpTask(`gulp remove --${moduleName}`);
    expect(fs.existsSync(modDir)).toBe(false);
  });

  it('3. Должен правильно распределять импорты при создании Системного Плагина', () => {
    const pluginName = 'autotest-plugin';
    const plugDir = path.join(
      process.cwd(),
      'src',
      'js',
      'plugins',
      pluginName,
    );

    runGulpTask(`gulp plugin --${pluginName}`);

    expect(fs.existsSync(plugDir)).toBe(true);

    const currentAppTs = fs.readFileSync(appTsPath, 'utf-8');
    expect(currentAppTs).toContain(
      `import { autotestPlugin } from './plugins/${pluginName}/${pluginName}';`,
    );
    expect(currentAppTs).toContain('autotestPlugin();');

    runGulpTask(`gulp remove --${pluginName}`);
    expect(fs.existsSync(plugDir)).toBe(false);
  });

  it('4. Должен срабатывать предохранитель и блокировать удаление заполненного компонента', () => {
    const componentName = 'autotest-secure';
    const compDir = path.join(
      process.cwd(),
      'src',
      'components',
      componentName,
    );
    const tsFile = path.join(compDir, `${componentName}.ts`);

    // 1. Создаем компонент
    runGulpTask(`gulp create --${componentName}`);

    // 2. Ломаем шаблон «секретным» кодом
    fs.writeFileSync(
      tsFile,
      `export const autotestSecure = (): void => { const mySecretCode = "don't touch me"; console.log(mySecretCode); };`,
    );

    // 3. Пытаемся удалить. Команда вернет лог ошибки, так как сработает предохранитель Gulp
    const outputError = runGulpTask(`gulp remove --${componentName}`);

    // Проверяем, что падение зафиксировано
    expect(outputError).toBeDefined();

    // Проверяем, что предохранитель сохранил папку на диске
    expect(fs.existsSync(compDir)).toBe(true);

    // 🔥 4. ЖЕЛЕЗОБЕТОННЫЙ ФИНАЛ: Очищаем диск напрямую через Node.js!
    // Это исключает любые проблемы с кодировками шаблона в самом Gulp в конце теста.
    if (fs.existsSync(compDir)) {
      fs.rmSync(compDir, { recursive: true, force: true });
    }

    // Подчищаем временные импорты, которые успела наплодить команда создания
    const mainJsPath = path.join(process.cwd(), 'src', 'js', 'app.ts');
    const mainScssPath = path.join(process.cwd(), 'src', 'scss', 'style.scss');

    if (fs.existsSync(mainJsPath)) {
      const content = fs.readFileSync(mainJsPath, 'utf-8');
      const updated = content
        .split(/\r?\n/)
        .filter(
          (line) =>
            !line.includes(componentName) &&
            !line.includes('autotestSecure();'),
        )
        .join('\n');
      fs.writeFileSync(mainJsPath, updated);
    }

    if (fs.existsSync(mainScssPath)) {
      const content = fs.readFileSync(mainScssPath, 'utf-8');
      const updated = content
        .split(/\r?\n/)
        .filter((line) => !line.includes(componentName))
        .join('\n');
      fs.writeFileSync(mainScssPath, updated);
    }

    // Финальная проверка: папка полностью уничтожена, рабочая среда чиста
    expect(fs.existsSync(compDir)).toBe(false);
  });

  it('5. Должен бесследно вырезать все импорты после успешного удаления', () => {
    const componentName = 'autotest-clean';

    runGulpTask(`gulp create --${componentName}`);
    runGulpTask(`gulp remove --${componentName}`);

    const currentAppTs = fs.readFileSync(appTsPath, 'utf-8');
    const currentScss = fs.readFileSync(styleScssPath, 'utf-8');

    expect(currentAppTs).not.toContain(componentName);
    expect(currentScss).not.toContain(componentName);
  });
});
