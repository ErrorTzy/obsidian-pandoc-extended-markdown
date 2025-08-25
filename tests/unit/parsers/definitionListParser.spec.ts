import { parseDefinitionListMarker } from '../../../src/reading-mode/parsers/definitionListParser';

describe('DefinitionListParser', () => {
  describe('parseDefinitionListMarker', () => {
    it('should parse definition term', () => {
      const result = parseDefinitionListMarker('Term 1');
      expect(result).toEqual({
        type: 'term',
        indent: '',
        marker: '',
        content: 'Term 1'
      });
    });

    it('should parse definition with colon', () => {
      const result = parseDefinitionListMarker(':   Definition 1');
      expect(result).toEqual({
        type: 'definition',
        indent: '',
        marker: ':',
        content: 'Definition 1'
      });
    });

    it('should parse definition with tilde', () => {
      const result = parseDefinitionListMarker('  ~ Definition 2a');
      expect(result).toEqual({
        type: 'definition',
        indent: '  ',
        marker: '~',
        content: 'Definition 2a'
      });
    });

    it('should parse indented definition', () => {
      const result = parseDefinitionListMarker('    : Indented definition');
      expect(result).toEqual({
        type: 'definition',
        indent: '    ',
        marker: ':',
        content: 'Indented definition'
      });
    });

    it('should return null for regular list items', () => {
      expect(parseDefinitionListMarker('- Bullet list')).toBeNull();
      expect(parseDefinitionListMarker('1. Numbered list')).toBeNull();
      expect(parseDefinitionListMarker('* Another bullet')).toBeNull();
    });

    it('should handle terms with spaces', () => {
      const result = parseDefinitionListMarker('Complex Term With Spaces');
      expect(result).toEqual({
        type: 'term',
        indent: '',
        marker: '',
        content: 'Complex Term With Spaces'
      });
    });

    it('should not parse lines with colons in the middle as terms', () => {
      const result = parseDefinitionListMarker('URL: http://example.com');
      expect(result).toBeNull();
    });

    it('should handle definitions with inline formatting markers', () => {
      const result = parseDefinitionListMarker(':   Definition with *emphasis*');
      expect(result).toEqual({
        type: 'definition',
        indent: '',
        marker: ':',
        content: 'Definition with *emphasis*'
      });
    });
  });
});