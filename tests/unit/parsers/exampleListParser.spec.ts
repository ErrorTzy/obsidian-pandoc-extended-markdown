import { parseExampleListMarker } from '../../../src/reading-mode/parsers/exampleListParser';

describe('ExampleListParser', () => {
  describe('parseExampleListMarker', () => {
    it('should parse simple example marker', () => {
      const result = parseExampleListMarker('(@) First example');
      expect(result).toEqual({
        indent: '',
        originalMarker: '(@)',
        label: undefined
      });
    });

    it('should parse labeled example marker', () => {
      const result = parseExampleListMarker('  (@good) This is a good example');
      expect(result).toEqual({
        indent: '  ',
        originalMarker: '(@good)',
        label: 'good'
      });
    });

    it('should parse example with numeric label', () => {
      const result = parseExampleListMarker('(@test123) Example with numbers');
      expect(result).toEqual({
        indent: '',
        originalMarker: '(@test123)',
        label: 'test123'
      });
    });

    it('should parse example with underscore and hyphen', () => {
      const result = parseExampleListMarker('    (@my-test_example) Complex label');
      expect(result).toEqual({
        indent: '    ',
        originalMarker: '(@my-test_example)',
        label: 'my-test_example'
      });
    });

    it('should return null for non-example markers', () => {
      expect(parseExampleListMarker('1. Regular list')).toBeNull();
      expect(parseExampleListMarker('- Bullet list')).toBeNull();
      expect(parseExampleListMarker('A. Fancy list')).toBeNull();
    });

    it('should return null for malformed example markers', () => {
      expect(parseExampleListMarker('(@)No space after')).toBeNull();
      expect(parseExampleListMarker('(@ invalid) Space in label')).toBeNull();
      expect(parseExampleListMarker('@test Missing parentheses')).toBeNull();
    });
  });
});