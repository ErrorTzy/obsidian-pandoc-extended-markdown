import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';
import { getReferenceDefinitionEndIndex } from '../../../src/shared/utils/pandocReferenceDefinitions';

// These block/paragraph decisions were checked against Pandoc 3.10.2 with
// markdown±lists_without_preceding_blankline, retaining all other defaults.
describe('Pandoc list spacing at raw and reference block boundaries', () => {
    it.each([
        ['a metadata command', ['\\title{x}']],
        ['an unknown command', ['\\arbitraryCommand{x}']],
        ['an unknown command without arguments', ['\\arbitraryCommand']],
        ['balanced nested arguments', ['\\arbitraryCommand[option]{a {nested} value}']],
        ['a sequence of commands', ['\\arbitraryCommand{x} \\anotherCommand{y}']],
        ['a multiline command argument', ['\\arbitraryCommand{', 'a {nested} value}']],
        ['a macro definition', ['\\def\\myCommand{value}']],
        ['a macro alias', ['\\let\\myCommand=\\otherCommand']],
        ['a dimension argument', ['\\arbitraryCommand=-2.5em']],
        ['a TeX comment inside an argument', ['\\arbitraryCommand{a % } is a comment', 'b}']],
        ['an unknown math command', ['\\alpha{x}']],
        ['a reference destination on the next line', ['[ref]:', '  /url']],
        ['a reference title on the next line', ['[ref]: /url', '  "the title"']],
        ['a reference attribute on the next line', ['[ref]: /url', '  {.reference}']],
        ['a comment', ['<!-- comment -->']],
        ['a processing instruction', ['<?php x?>']],
        ['indented code following a comment', ['<!-- comment -->', '    code']],
        ['indented code following verbatim HTML', ['<pre>x</pre>', '    code']],
        ['indented code following a closed HTML container', ['<section>x</section>', '    code']],
        ['indented code following a reference', ['[ref]: /url', '    code']],
        ['indented code inside a native div', ['<div>', '    code']],
        ['indented code after a raw TeX blank', ['\\foo{x}', '', '    code']],
        ['indented code after a processing-instruction blank', ['<?pi?>', '', '    code']]
    ])('allows lists after %s in both modes', (_name, prefix) => {
        const lines = [...prefix, '- parent', '  - CHILD_MUST_STAY'];
        for (const enabled of [false, true]) {
            expect(ListBlockValidator.analyzeListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            }).invalidLines).toEqual(new Set());
        }
    });

    it.each([
        ['an inline TeX command', ['\\textbf{x}']],
        ['an inline citation command', ['\\cite{x}']],
        ['an inline language command', ['\\textgerman{x}']],
        ['an indented TeX command', [' \\arbitraryCommand{x}']],
        ['text after an unknown command', ['\\arbitraryCommand{x} trailing text']],
        ['text after a known block command', ['\\title{x} trailing text']],
        ['an incomplete TeX argument', ['\\arbitraryCommand{']],
        ['a non-overlay angle argument', ['\\arbitraryCommand<word>']],
        ['a command in an open paragraph', ['Paragraph', '\\title{x}']],
        ['an unresolved reference candidate', ['[ref]:', '[r]: /url']],
        ['a DOCTYPE declaration', ['<!DOCTYPE html>']],
        ['a CDATA declaration', ['<![CDATA[content]]>']],
        ['a raw TeX whitespace continuation', ['\\foo{x}', '    continuation']],
        ['a processing-instruction whitespace continuation', ['<?pi?>', '    continuation']],
        ['a multiline processing-instruction whitespace continuation', ['<?pi', '?>', '    continuation']],
        ['a raw HTML container whitespace continuation', ['<section>', '    continuation']],
        ['a subsequent block in a raw HTML container', ['<?pi?>', '    first', '', '    continuation']]
    ])('applies the extension after %s', (_name, prefix) => {
        const lines = [...prefix, '- parent', '  - CHILD_MUST_STAY'];
        const strict = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        });
        expect(strict.invalidLines).toEqual(new Set([prefix.length, prefix.length + 1]));
        expect(strict.interruptedParagraphs).toHaveLength(1);
        expect(strict.interruptedParagraphs[0].endIndex).toBe(lines.length - 1);
        expect(ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        }).invalidLines).toEqual(new Set());
    });

    it('normalizes raw container block entries without dedenting literal child markers', () => {
        const lines = ['<section>', '    - parent', '      - CHILD_MUST_STAY', '</section>', '    code', '- tail'];
        for (const enabled of [false, true]) {
            const analysis = ListBlockValidator.analyzeListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            });
            expect(analysis.invalidLines).toEqual(new Set([2]));
            expect(analysis.sourceLines).toEqual([
                '<section>', '- parent', '      - CHILD_MUST_STAY', '</section>', '    code', '- tail'
            ]);
        }
    });

    it('keeps later indented code lines opaque after normalizing an HTML block entry', () => {
        const lines = ['<?pi?>', '    first', '', '        code', '    - CODE_NOT_A_LIST', '- tail'];
        const analysis = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        });
        expect(analysis.invalidLines).toEqual(new Set());
        expect(analysis.sourceLines[3]).toBe('    code');
        expect(analysis.sourceLines[4]).toBe('    - CODE_NOT_A_LIST');
    });

    it.each([
        [['[ref]: /url', '- target'], 0],
        [['[ref]:', '  /url', '- target'], 1],
        [['[ref]: /url', '  "title"', '- target'], 1],
        [['[ref]: /url', '  {.reference}', '- target'], 1],
        [['[ref]: /url', '(1)', '- target'], 1],
        [['[ref]: /url', '(1) text', '- target'], null],
        [['[ref]:', '[r]: /url', '- target'], null],
        [['[ref]: /url "title" trailing', '- target'], null],
        [['[nested [label]]: /url', '- target'], 0]
    ])('recognizes a complete reference source range %j', (lines, expected) => {
        expect(getReferenceDefinitionEndIndex(lines, 0)).toBe(expected);
    });

    it('exports only reference definitions recognized at block boundaries', () => {
        const lines = ['[valid]: /target', '', 'Paragraph', '[not-a-definition]: /other', '- literal'];
        expect(ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        }).referenceDefinitionRanges).toEqual([{ startIndex: 0, endIndex: 0 }]);
    });

    it('maps and orders reference ranges in quoted and footnote source regions', () => {
        const lines = [
            '> [quoted]:', '>   /quote', '', 'Note[^n]', '',
            '[^n]: [note]:', '    /note', '', '[root]: /root'
        ];
        const analysis = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        });
        expect(analysis.referenceDefinitionRanges).toEqual([
            { startIndex: 0, endIndex: 1 },
            { startIndex: 5, endIndex: 6 },
            { startIndex: 8, endIndex: 8 }
        ]);
        expect(analysis.sourceLines.slice(5, 7)).toEqual([' [note]:', '/note']);
    });
});
