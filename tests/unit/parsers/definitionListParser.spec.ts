import { parseDefinitionListMarker } from '../../../src/reading-mode/features/extended-lists/definitionListMarker';
import { findPandocDefinitionListBlocks } from '../../../src/reading-mode/features/definition-lists/sourceParser';

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

  describe('findPandocDefinitionListBlocks', () => {
    it('does not treat a fenced div opener as a definition term', () => {
      const blocks = findPandocDefinitionListBlocks('::: title\n: text\n:::');

      expect(blocks).toEqual([]);
    });

    it('still finds definition lists inside fenced div content when a term is present', () => {
      const blocks = findPandocDefinitionListBlocks('::: title\nTerm\n: text\n:::');

      expect(blocks).toHaveLength(1);
      expect(blocks[0].termTexts).toEqual(['Term']);
      expect(blocks[0].definitionTexts).toEqual(['text']);
    });

    it('does not turn the final line of a multiline paragraph into a definition term', () => {
      const blocks = findPandocDefinitionListBlocks('Term one\nterm two\n: definition');

      expect(blocks).toEqual([]);
    });

    it.each([false, true])(
      'keeps an apparent lazy quote item in the preceding root definition list when the extension is %s',
      extensionEnabled => {
        const blocks = findPandocDefinitionListBlocks(
          'A\n: da\n\n> B\n: db',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].startLine).toBe(0);
        expect(blocks[0].endLine).toBe(4);
        expect(blocks[0].termTexts).toEqual(['A', '> B']);
        expect(blocks[0].definitionTexts).toEqual(['da', 'db']);
        expect(blocks[0].items.map(item => ({
          term: item.term,
          definitions: item.definitions.map(definition => definition.plainText)
        }))).toEqual([
          { term: 'A', definitions: ['da'] },
          { term: '> B', definitions: ['db'] }
        ]);
        expect(blocks[0].joinsLazyContainer).toBe(false);
      }
    );

    it('parses consecutive root markers as definitions of the lazy quoted term when the extension is disabled', () => {
      const blocks = findPandocDefinitionListBlocks(
        '> Term\n: one\n: two',
        { enableListsWithoutPrecedingBlankline: false }
      );

      expect(blocks).toHaveLength(1);
      expect(blocks[0].termTexts).toEqual(['Term']);
      expect(blocks[0].definitionTexts).toEqual(['one', 'two']);
      expect(blocks[0].items[0].definitions.map(definition => definition.plainText))
        .toEqual(['one', 'two']);
      expect(blocks[0].joinsLazyContainer).toBe(true);
    });

    it('treats the first root marker as a literal definition term when the extension is enabled', () => {
      const blocks = findPandocDefinitionListBlocks(
        '> Term\n: one\n: two',
        { enableListsWithoutPrecedingBlankline: true }
      );

      expect(blocks).toHaveLength(1);
      expect(blocks[0].startLine).toBe(1);
      expect(blocks[0].endLine).toBe(2);
      expect(blocks[0].termTexts).toEqual([': one']);
      expect(blocks[0].definitionTexts).toEqual(['two']);
      expect(blocks[0].items.map(item => ({
        term: item.term,
        definitions: item.definitions.map(definition => definition.plainText)
      }))).toEqual([
        { term: ': one', definitions: ['two'] }
      ]);
      expect(blocks[0].joinsLazyContainer).toBe(false);
    });

    it.each([
      [false, ['one', 'two']],
      [true, ['one']]
    ])(
      'respects the extension when a later definition leaves the owning quote (extension=%s)',
      (extensionEnabled, expectedDefinitions) => {
        const blocks = findPandocDefinitionListBlocks(
          '> Term\n> : one\n: two',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].termTexts).toEqual(['Term']);
        expect(blocks[0].definitionTexts).toEqual(expectedDefinitions);
      }
    );

    it.each([
      { marker: '- ', indent: '  ', nextMarker: '- ' },
      { marker: '1. ', indent: '   ', nextMarker: '2. ' },
      { marker: '100. ', indent: '     ', nextMarker: '101. ' }
    ])(
      'bounds a definition inside native $marker list content before its sibling',
      ({ marker, indent, nextMarker }) => {
        const blocks = findPandocDefinitionListBlocks([
          `${marker}Native Term`,
          `${indent}: native definition`,
          `${nextMarker}Native tail`,
          '',
          'Root Term',
          ': root definition'
        ].join('\n'));

        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toMatchObject({
          startLine: 0,
          endLine: 1,
          nativeListParentIndex: 0,
          termTexts: ['Native Term'],
          definitionTexts: ['native definition']
        });
        expect(blocks[1]).toMatchObject({
          startLine: 4,
          endLine: 5,
          termTexts: ['Root Term'],
          definitionTexts: ['root definition']
        });
        expect(blocks[1].nativeListParentIndex).toBeUndefined();
      }
    );

    it('rejects a nested definition when the current mode rejects its outer native list', () => {
      const source = [
        'Paragraph',
        '- Native Term',
        '  : native definition',
        '- Native tail'
      ].join('\n');

      expect(findPandocDefinitionListBlocks(source, {
        enableListsWithoutPrecedingBlankline: false
      })).toEqual([]);
      expect(findPandocDefinitionListBlocks(source, {
        enableListsWithoutPrecedingBlankline: true
      })[0]).toMatchObject({
        startLine: 1,
        endLine: 2,
        nativeListParentIndex: 1,
        termTexts: ['Native Term'],
        definitionTexts: ['native definition']
      });
    });

    it.each([false, true])(
      'keeps an indented definition marker inside its owning description (extension=%s)',
      extensionEnabled => {
        const blocks = findPandocDefinitionListBlocks(
          'Term\n: one\n  : two',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].items).toHaveLength(1);
        expect(blocks[0].items[0].definitions).toHaveLength(1);
        const nested = blocks[0].items[0].definitions[0].nestedDefinitionBlocks;
        expect(blocks[0].items[0].definitions[0].lines).toEqual(['one', ': two']);
        expect(nested).toHaveLength(1);
        expect(nested[0].items[0].term).toBe('one');
        expect(nested[0].items[0].definitions[0].plainText).toBe('two');
      }
    );

    it.each([false, true])(
      'keeps a nested definition inside a native list description (extension=%s)',
      extensionEnabled => {
        const blocks = findPandocDefinitionListBlocks(
          '- Term\n  : one\n    : two',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].nativeListParentIndex).toBe(0);
        expect(blocks[0].items).toHaveLength(1);
        expect(blocks[0].items[0].definitions).toHaveLength(1);
        const nested = blocks[0].items[0].definitions[0].nestedDefinitionBlocks;
        expect(blocks[0].items[0].definitions[0].lines).toEqual(['one', ': two']);
        expect(nested).toHaveLength(1);
        expect(nested[0].items[0].term).toBe('one');
        expect(nested[0].items[0].definitions[0].plainText).toBe('two');
      }
    );

    it.each([false, true])(
      'exposes a definition nested in a description-body bullet list (extension=%s)',
      extensionEnabled => {
        const blocks = findPandocDefinitionListBlocks(
          'Term\n: - bullet\n    : indented',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        const definition = blocks[0].items[0].definitions[0];
        expect(definition.lines).toEqual(['- bullet', '    : indented']);
        expect(definition.nestedDefinitionBlocks).toHaveLength(1);
        expect(definition.nestedDefinitionBlocks[0]).toMatchObject({
          startLine: 0,
          endLine: 1,
          nativeListParentIndex: 0,
          termTexts: ['bullet'],
          definitionTexts: ['indented']
        });
      }
    );

    it.each([false, true])(
      'preserves excess marker padding as indented body content (extension=%s)',
      extensionEnabled => {
        const blocks = findPandocDefinitionListBlocks(
          'Term\n:     one\n  : two',
          { enableListsWithoutPrecedingBlankline: extensionEnabled }
        );

        expect(blocks).toHaveLength(1);
        expect(blocks[0].items[0].definitions).toHaveLength(1);
        expect(blocks[0].items[0].definitions[0].lines).toEqual([
          '    one',
          ': two'
        ]);
        expect(blocks[0].items[0].definitions[0].nestedDefinitionBlocks)
          .toEqual([]);
      }
    );

    it.each([
      [2, true],
      [3, true],
      [4, true],
      [5, true],
      [6, false]
    ])(
      'uses the Pandoc definition content-indent boundary at indent=%s',
      (indent, expectsNestedDefinition) => {
        const source = `Term\n: one\n${' '.repeat(indent)}: two`;
        const definition = findPandocDefinitionListBlocks(source)[0]
          .items[0].definitions[0];

        expect(definition.nestedDefinitionBlocks.length > 0)
          .toBe(expectsNestedDefinition);
      }
    );

    it.each([false, true])(
      'does not reinterpret a native-list continuation as a root definition term (extension=%s)',
      extensionEnabled => {
        const source = [
          '- Term',
          '  continued',
          '  : def',
          '  - CHILD'
        ].join('\n');

        expect(findPandocDefinitionListBlocks(source, {
          enableListsWithoutPrecedingBlankline: extensionEnabled
        })).toEqual([]);
      }
    );
  });
});
