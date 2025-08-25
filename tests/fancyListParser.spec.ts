import { parseFancyListMarker } from '../src/reading-mode/parsers/fancyListParser';

describe('FancyListParser', () => {
  describe('parseFancyListMarker', () => {
    it('should parse uppercase letters with period', () => {
      const result = parseFancyListMarker('A. First item');
      expect(result).toEqual({
        indent: '',
        marker: 'A.',
        type: 'upper-alpha',
        delimiter: '.',
        value: 'A'
      });
    });

    it('should parse lowercase letters with period', () => {
      const result = parseFancyListMarker('  a. First item');
      expect(result).toEqual({
        indent: '  ',
        marker: 'a.',
        type: 'lower-alpha',
        delimiter: '.',
        value: 'a'
      });
    });

    it('should parse uppercase roman numerals', () => {
      const result = parseFancyListMarker('IV. Fourth item');
      expect(result).toEqual({
        indent: '',
        marker: 'IV.',
        type: 'upper-roman',
        delimiter: '.',
        value: 'IV'
      });
    });

    it('should parse lowercase roman numerals with parenthesis', () => {
      const result = parseFancyListMarker('    iii) Third item');
      expect(result).toEqual({
        indent: '    ',
        marker: 'iii)',
        type: 'lower-roman',
        delimiter: ')',
        value: 'iii'
      });
    });

    it('should parse hash marker', () => {
      const result = parseFancyListMarker('#. Auto numbered');
      expect(result).toEqual({
        indent: '',
        marker: '#.',
        type: 'hash',
        delimiter: '.',
        value: undefined
      });
    });

    it('should return null for regular decimal numbers', () => {
      const result = parseFancyListMarker('1. Regular list');
      expect(result).toBeNull();
    });

    it('should return null for invalid markers', () => {
      const result = parseFancyListMarker('- Bullet list');
      expect(result).toBeNull();
    });

    it('should handle mixed case letters correctly', () => {
      const result1 = parseFancyListMarker('ABC. Multiple letters');
      expect(result1).toEqual({
        indent: '',
        marker: 'ABC.',
        type: 'upper-alpha',
        delimiter: '.',
        value: 'ABC'
      });

      const result2 = parseFancyListMarker('xyz) Lower multiple');
      expect(result2).toEqual({
        indent: '',
        marker: 'xyz)',
        type: 'lower-alpha',
        delimiter: ')',
        value: 'xyz'
      });
    });
  });
});