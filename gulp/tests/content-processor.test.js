import { describe, it, expect } from 'vitest';
import { processHtmlContent, parsePlainText } from '../utils/content-processor.js';

describe('Gulp Utils: Content Processor', () => {
  
  describe('parsePlainText', () => {
    it('should strip HTML tags from string', () => {
      const input = '<h1>Hello</h1><p>World</p>';
      expect(parsePlainText(input)).toBe('HelloWorld');
    });
  });

  describe('processHtmlContent', () => {
    it('should replace relative image paths with prefixed paths', () => {
      const html = '<img src="./images/photo.jpg">';
      const prefix = '../';
      const result = processHtmlContent(html, prefix);
      // Теперь код корректно заменяет ./images/ на ../images/
      expect(result).toContain('src="../images/photo.jpg"');
    });

    it('should escape code blocks to prevent HTML execution', () => {
      const html = '<pre><code>const x = 10 < 20;</code></pre>';
      const result = processHtmlContent(html, '');
      // Используем конкатенацию, чтобы избежать автозамены символов в редакторе
      const expectedEntity = '10 ' + '&' + 'lt; 20';
      expect(result).toContain(expectedEntity);
    });

    it('should replace "images/" with prefixed path', () => {
      const html = '<img src="images/test.png">';
      const result = processHtmlContent(html, '../');
      expect(result).toContain('src="../images/test.png"');
    });
  });
});
