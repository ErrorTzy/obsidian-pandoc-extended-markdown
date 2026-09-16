import { ListBlockValidator } from '../../../src/live-preview/validators/listBlockValidator';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('Pandoc list spacing validation', () => {
    const settings: PandocExtendedMarkdownSettings = {
        enableListsWithoutPrecedingBlankline: false,
        fancyLists: true,
        enableCustomLabelLists: true
    } as PandocExtendedMarkdownSettings;

    describe('Invalid list blocks without blank lines', () => {
        it('should mark ALL list items as invalid when no blank line before', () => {
            const lines = [
                'text',
                'A.  First item',
                'B.  Second item', 
                'C.  Third item'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid (0-based indices)
            expect(invalidLines.has(1)).toBe(true); // Array index 1: "A.  First item"
            expect(invalidLines.has(2)).toBe(true); // Array index 2: "B.  Second item"
            expect(invalidLines.has(3)).toBe(true); // Array index 3: "C.  Third item"
            expect(invalidLines.size).toBe(3);
        });

        it('allows following text to continue the final Pandoc list item', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should mark ALL list items as invalid when no blank lines before AND after', () => {
            const lines = [
                'text before',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text after'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true); // Line index 1: "A.  First item"
            expect(invalidLines.has(2)).toBe(true); // Line index 2: "B.  Second item"
            expect(invalidLines.has(3)).toBe(true); // Line index 3: "C.  Third item"
            expect(invalidLines.size).toBe(3);
        });

        it('should handle hash lists correctly', () => {
            const lines = [
                'text',
                '#.  First item',
                '#.  Second item',
                '#.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true);
            expect(invalidLines.has(2)).toBe(true);
            expect(invalidLines.has(3)).toBe(true);
            expect(invalidLines.size).toBe(3);
        });

        it('should handle example lists correctly', () => {
            const lines = [
                'text',
                '(@ex1)  First item',
                '(@ex2)  Second item',
                '(@ex3)  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true);
            expect(invalidLines.has(2)).toBe(true);
            expect(invalidLines.has(3)).toBe(true);
            expect(invalidLines.size).toBe(3);
        });
    });

    describe('Valid list blocks with proper blank lines', () => {
        it('allows a list immediately after an ATX heading', () => {
            const lines = [
                '# Heading',
                '- parent',
                '    - child'
            ];

            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);

            expect(invalidLines.size).toBe(0);
        });

        it('applies the extension after an unresolved reference definition candidate', () => {
            const lines = [
                '[reference]: /target',
                '(1) extension-controlled item'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('does not mistake an ATX-looking paragraph continuation for a heading', () => {
            const lines = [
                'Paragraph',
                '# This is still paragraph text',
                '- item'
            ];

            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);

            expect(invalidLines).toEqual(new Set([2]));
        });

        it.each([
            ['a setext heading', ['Heading', '===', '- item']],
            ['a fenced code block', ['Paragraph', '```', 'code', '```', '- item']],
            ['a thematic break', ['***', '- item']],
            ['a reference definition', ['[ref]: /target', '- item']],
            ['a pipe table', ['| Heading |', '| --- |', '- item']],
            ['a native div', ['<div>', 'content', '</div>', '- item']],
            ['a fenced div', ['::: note', 'content', ':::', '- item']]
        ])('allows a list immediately after %s', (_description, lines) => {
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);

            expect(invalidLines.size).toBe(0);
        });

        it('does not apply the Pandoc extension to plugin-only custom labels', () => {
            const lines = [
                'Paragraph',
                '{::NOTE} custom label'
            ];

            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);

            expect(invalidLines.size).toBe(0);
        });

        it('should not mark any items as invalid when properly formatted', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should allow list at beginning of document', () => {
            const lines = [
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should allow list at end of document', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });
    });

    describe('Definition lists special case', () => {
        it('should only require blank line after, not before', () => {
            const lines = [
                'Term',
                ':   Definition',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('allows following text to continue a Pandoc definition', () => {
            const lines = [
                'Term',
                ':   Definition',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });
    });

    describe('When lists_without_preceding_blankline is enabled', () => {
        it('should not mark any lines as invalid', () => {
            const extensionEnabledSettings: PandocExtendedMarkdownSettings = {
                ...settings,
                enableListsWithoutPrecedingBlankline: true
            };
            
            const lines = [
                'text',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(
                lines,
                extensionEnabledSettings
            );
            
            expect(invalidLines.size).toBe(0);
        });
    });

    describe('lists_without_preceding_blankline parity', () => {
        it('changes only a root list that interrupts an open paragraph', () => {
            const lines = [
                'Paragraph',
                '- parent',
                '  - child'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([1, 2]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('never applies the extension rule to a nested list', () => {
            const lines = [
                '- parent',
                '  - child',
                '    1. grandchild'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings).size).toBe(0);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            }).size).toBe(0);
        });

        it('keeps a loose nested list inside its parent after a blank line', () => {
            const lines = [
                '- parent',
                '',
                '  continuation paragraph',
                '  - nested child'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings).size).toBe(0);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            }).size).toBe(0);
        });

        it('ends an interrupted paragraph at an internal blank line', () => {
            const lines = [
                'Paragraph',
                '- remains paragraph text',
                '',
                '- starts a list'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([1]));
        });

        it('tracks lazy continuation text before another nested marker', () => {
            const lines = [
                'Paragraph',
                '- first marker',
                'lazy continuation',
                '  - nested marker'
            ];
            const analysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(analysis.invalidLines).toEqual(new Set([1, 3]));
            expect(analysis.interruptedParagraphs).toEqual([{
                paragraphStartIndex: 0,
                listStartIndex: 1,
                endIndex: 3
            }]);
        });

        it('applies inside a block quote, including lazy block-quote continuation', () => {
            expect(ListBlockValidator.validateListBlocks(['> Paragraph', '> - item'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(['> Paragraph', '- item'], settings))
                .toEqual(new Set([1]));
        });

        it('does not treat a deeper block quote as a boundary for an outer paragraph', () => {
            const directMarker = ['Paragraph', '> - item'];
            const quotedBlank = ['Paragraph', '>', '> - item'];
            const enabled = { enableListsWithoutPrecedingBlankline: true };

            expect(ListBlockValidator.validateListBlocks(directMarker, settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(directMarker, enabled))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(quotedBlank, settings))
                .toEqual(new Set([2]));
            expect(ListBlockValidator.validateListBlocks(quotedBlank, enabled))
                .toEqual(new Set([2]));
        });

        it('still treats a quoted blank at the paragraph depth as a separator', () => {
            const lines = ['> Paragraph', '>', '> - item'];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set());
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('accepts root-list indentation through three columns but not four', () => {
            expect(ListBlockValidator.validateListBlocks(['Paragraph', '   - item'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(['Paragraph', '    - item'], settings))
                .toEqual(new Set());
        });

        it('keeps uppercase-period marker spacing independent of the extension', () => {
            const invalidMarker = ['A. item'];
            const validMarker = ['A.  item'];

            expect(ListBlockValidator.validateListBlocks(invalidMarker, settings))
                .toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(invalidMarker, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(validMarker, settings).size).toBe(0);
        });

        it('matches Pandoc block boundaries before a root list', () => {
            const standaloneBlocks: string[][] = [
                ['```', 'code', '```'],
                ['| first line', '| second line'],
                ['---', 'title: Example', '---'],
                ['Term', '', ': definition']
            ];

            standaloneBlocks.forEach(block => {
                const lines = [...block, '- item'];
                expect(ListBlockValidator.validateListBlocks(lines, settings)).toEqual(new Set());
            });
        });

        it('keeps a raw TeX environment in paragraph state', () => {
            const lines = [
                '\\begin{equation}',
                '- not a Markdown list',
                '\\end{equation}',
                '- extension-controlled list'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([3]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('does not swallow a list marker after an unclosed raw TeX environment', () => {
            const lines = [
                '\\begin{equation}',
                '- extension-controlled list'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('does not let a tilde fence interrupt an open Pandoc paragraph', () => {
            const lines = [
                'Paragraph',
                '~~~',
                'code',
                '~~~',
                '- item'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([4]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('recognizes Pandoc empty list items', () => {
            expect(ListBlockValidator.validateListBlocks(['Paragraph', '+'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(['Paragraph', '+'], {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('uses Pandoc fancy-list marker grammar in both spacing modes', () => {
            const enabled = { enableListsWithoutPrecedingBlankline: true };

            expect(ListBlockValidator.validateListBlocks(['AB.  not a marker'], settings))
                .toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(['AB.  not a marker'], enabled))
                .toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(['aa. not a marker'], settings))
                .toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(['aa. not a marker'], enabled))
                .toEqual(new Set([0]));
            expect(ListBlockValidator.validateListBlocks(['Paragraph', 'IIII. item'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(['Paragraph', 'IIII. item'], enabled))
                .toEqual(new Set());
            expect(ListBlockValidator.validateListBlocks(['- parent', '  A. child'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks(['- parent', '  A. child'], enabled))
                .toEqual(new Set([1]));
        });

        it.each([
            ['a bullet marker', '- parent', 2],
            ['a decimal marker', '1. parent', 3],
            ['an ambiguous uppercase marker', 'A.  parent', 4],
            ['an example marker', '(@x) parent', 4]
        ])('uses Pandoc content indentation after a blank in %s', (
            _description,
            firstLine,
            requiredIndent
        ) => {
            const insufficient = [
                firstLine,
                '',
                `${' '.repeat(requiredIndent - 1)}continuation`,
                '- next'
            ];
            const sufficient = [
                firstLine,
                '',
                `${' '.repeat(requiredIndent)}continuation`,
                '- next'
            ];

            expect(ListBlockValidator.validateListBlocks(insufficient, settings))
                .toEqual(new Set([3]));
            expect(ListBlockValidator.validateListBlocks(sufficient, settings))
                .toEqual(new Set());
        });

        it('recognizes anonymous example-list markers', () => {
            const enabled = { enableListsWithoutPrecedingBlankline: true };
            ['(@) item', '@. item', '@) item'].forEach(marker => {
                expect(ListBlockValidator.validateListBlocks(['Paragraph', marker], settings))
                    .toEqual(new Set([1]));
                expect(ListBlockValidator.validateListBlocks(['Paragraph', marker], enabled))
                    .toEqual(new Set());
            });
        });

        it('accepts a tab after an ambiguous uppercase-period marker', () => {
            expect(ListBlockValidator.validateListBlocks(['A.\titem'], settings))
                .toEqual(new Set());
            expect(ListBlockValidator.validateListBlocks(['A.\titem'], {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('uses only ASCII spaces and tabs as Pandoc list whitespace', () => {
            const nonBreakingSpace = '\u00a0';

            expect(ListBlockValidator.isListItemForValidation(`${nonBreakingSpace}- item`))
                .toBe(false);
            expect(ListBlockValidator.validateListBlocks([
                'Paragraph',
                nonBreakingSpace,
                '- item'
            ], settings)).toEqual(new Set([2]));
        });

        it.each([
            ['an HTML comment', ['<!-- comment -->']],
            ['a script block', ['<script>const value = 1;</script>']],
            ['a processing instruction', ['<?target value?>']]
        ])('allows a list after %s', (_description, prefix) => {
            expect(ListBlockValidator.validateListBlocks([...prefix, '- item'], settings))
                .toEqual(new Set());
        });

        it.each([
            ['a multiline HTML comment', ['<!--', '- not a list', '-->']],
            ['a pipe table with a body', ['| H |', '| --- |', '| value |']],
            ['a grid table', ['+---+', '| x |', '+---+']]
        ])('keeps markers after %s outside the preceding block', (_description, prefix) => {
            expect(ListBlockValidator.validateListBlocks([...prefix, '- item'], settings))
                .toEqual(new Set());
        });

        it('does not treat a grid-table-looking line as a complete block', () => {
            expect(ListBlockValidator.validateListBlocks(['+---+', '- item'], settings))
                .toEqual(new Set([1]));
        });

        it('recognizes only valid fenced-div openers as block boundaries', () => {
            expect(ListBlockValidator.validateListBlocks([':::', '- item'], settings))
                .toEqual(new Set([1]));
            expect(ListBlockValidator.validateListBlocks([
                ':::note',
                '- item',
                ':::'
            ], settings)).toEqual(new Set());
        });

        it('applies lists_without_preceding_blankline inside fenced div bodies', () => {
            const lines = [
                '::: note',
                'paragraph',
                '- parent',
                '  - CHILD_MUST_STAY',
                ':::'
            ];

            expect(ListBlockValidator.analyzeListBlocks(lines, settings)).toEqual({
                invalidLines: new Set([2, 3]),
                interruptedParagraphs: [{
                    paragraphStartIndex: 1,
                    listStartIndex: 2,
                    endIndex: 3
                }],
                sourceLines: lines,
                referenceDefinitionRanges: [],
                literalListContinuations: []
            });
            expect(ListBlockValidator.analyzeListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual({
                invalidLines: new Set(),
                interruptedParagraphs: [],
                sourceLines: lines,
                referenceDefinitionRanges: [],
                literalListContinuations: []
            });
        });

        it('does not swallow list markers after an unclosed backtick fence', () => {
            const lines = ['Paragraph', '```', 'code', '- item'];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([3]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('does not let an indented backtick fence interrupt an open paragraph', () => {
            const lines = [
                'Paragraph',
                '  ```',
                '  code',
                '  ```',
                '- item'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([4]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('keeps list-looking text inside an indented fence in the interrupted paragraph', () => {
            const lines = [
                'Paragraph',
                '- first item',
                '  ```',
                '  - code content',
                '  ```',
                '- final item'
            ];
            const analysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(analysis.invalidLines).toEqual(new Set([1, 5]));
            expect(analysis.interruptedParagraphs).toEqual([{
                paragraphStartIndex: 0,
                listStartIndex: 1,
                endIndex: 5
            }]);
        });

        it('keeps list-looking lines inside a multiline inline-code span opaque', () => {
            const lines = [
                'Paragraph ``',
                '- CODE_MUST_STAY',
                '``',
                '- extension-controlled item'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([3]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('reports source marker candidates without treating fenced code as list syntax', () => {
            const lines = [
                '```',
                'A.  CODE_MUST_STAY',
                '```',
                'Paragraph',
                'A.  interrupted'
            ];

            expect(ListBlockValidator.getListMarkerCandidateLines(lines, settings))
                .toEqual(new Set([4]));
        });

        it('keeps indented line-block continuations out of paragraph state', () => {
            const lines = ['| first', ' continued', '- item'];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set());
        });

        it('never treats an orphan definition marker as a definition list', () => {
            const multilineTerm = ['Term one', 'term two', ': definition'];
            const crossContainerTerm = ['> Term', '', ': definition', '- item'];

            expect(ListBlockValidator.validateListBlocks(multilineTerm, settings))
                .toEqual(new Set([2]));
            expect(ListBlockValidator.validateListBlocks(multilineTerm, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set([2]));
            expect(ListBlockValidator.validateListBlocks(crossContainerTerm, settings))
                .toEqual(new Set([2, 3]));
            expect(ListBlockValidator.validateListBlocks(crossContainerTerm, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set([2]));
        });

        it('leaves paragraph state open after a root orphan definition marker', () => {
            const lines = [
                '- existing list',
                'Term consumed by that item',
                ': orphan definition marker',
                'Paragraph continuation',
                '- extension-controlled item'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([2, 4]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set([2]));
        });

        it('applies the extension independently inside a footnote body', () => {
            const lines = [
                'Text[^note]',
                '',
                '[^note]: Paragraph',
                '    - parent',
                '      - CHILD_MUST_STAY'
            ];
            const strictAnalysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(strictAnalysis.invalidLines).toEqual(new Set([3, 4]));
            expect(strictAnalysis.interruptedParagraphs).toEqual([{
                paragraphStartIndex: 2,
                listStartIndex: 3,
                endIndex: 4
            }]);
            expect(strictAnalysis.sourceLines.slice(2)).toEqual([
                ' Paragraph',
                '- parent',
                '  - CHILD_MUST_STAY'
            ]);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('applies the extension to an unindented lazy footnote-body list', () => {
            const lines = [
                'Use[^n].',
                '',
                '[^n]: note',
                '- CHILD'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings))
                .toEqual(new Set([3]));
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('keeps consecutive footnote bodies as independent parser regions', () => {
            const lines = [
                'Use[^a] and [^b].',
                '',
                '[^a]: first note',
                '[^b]: second note',
                '- CHILD'
            ];
            const analysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(analysis.invalidLines).toEqual(new Set([4]));
            expect(analysis.interruptedParagraphs).toEqual([{
                paragraphStartIndex: 3,
                listStartIndex: 4,
                endIndex: 4
            }]);
            expect(analysis.sourceLines.slice(2)).toEqual([
                ' first note',
                ' second note',
                '- CHILD'
            ]);
        });

        it('allows a footnote-body list after its required blank line', () => {
            const lines = [
                'Use[^n].',
                '',
                '[^n]: note',
                '',
                '    - CHILD'
            ];

            expect(ListBlockValidator.validateListBlocks(lines, settings)).toEqual(new Set());
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('applies the extension in a block-quoted footnote body', () => {
            const lines = [
                '> Use[^n].',
                '>',
                '> [^n]: note',
                '> - CHILD'
            ];
            const analysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(analysis.invalidLines).toEqual(new Set([3]));
            expect(analysis.interruptedParagraphs).toEqual([{
                paragraphStartIndex: 2,
                listStartIndex: 3,
                endIndex: 3
            }]);
            expect(analysis.sourceLines.slice(2)).toEqual([' note', '- CHILD']);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toEqual(new Set());
        });

        it('does not project footnote-looking text out of fenced code', () => {
            const lines = [
                '```',
                '[^not-a-note]: code',
                '- CODE_MUST_STAY',
                '```'
            ];
            const analysis = ListBlockValidator.analyzeListBlocks(lines, settings);

            expect(analysis.invalidLines).toEqual(new Set());
            expect(analysis.interruptedParagraphs).toEqual([]);
            expect(analysis.sourceLines).toEqual(lines);
        });
    });
});
