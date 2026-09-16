import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';

describe('Pandoc quote-container list spacing', () => {
    // Expected classifications verified with Pandoc 3.10.2's Markdown reader,
    // with lists_without_preceding_blankline explicitly disabled/enabled.
    it.each([4, 5, 8, 9])('recognizes a %i-column lazy quote marker', indent => {
        const lines = ['> Paragraph', `${' '.repeat(indent)}- TARGET`];
        expect(ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        })).toMatchObject({
            invalidLines: new Set([1]),
            interruptedParagraphs: [{ paragraphStartIndex: 0, listStartIndex: 1, endIndex: 1 }]
        });
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        })).toEqual(new Set());
    });

    it.each([
        ['bullet', '- ', '- '],
        ['alternate bullet', '* ', '+ '],
        ['decimal', '1. ', '2. '],
        ['one-parenthesis decimal', '1) ', '2) '],
        ['two-parentheses decimal', '(1) ', '(2) '],
        ['upper alpha', 'A.  ', 'B.  '],
        ['default ordered', '#. ', '#. '],
        ['example ordered', '(@quoted) ', '(@target) ']
    ])(
        'reconsiders a shallower %s marker after a rejected quoted marker',
        (_name, quotedMarker, rootMarker) => {
            const lines = [
                'Paragraph',
                `> ${quotedMarker}QUOTED_SEED`,
                `${rootMarker}ROOT_TARGET`
            ];

            expect(ListBlockValidator.analyzeListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: false
            })).toMatchObject({
                invalidLines: new Set([1, 2]),
                interruptedParagraphs: [{ paragraphStartIndex: 0, listStartIndex: 1, endIndex: 2 }]
            });
            expect(ListBlockValidator.analyzeListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: true
            })).toMatchObject({
                invalidLines: new Set([1]),
                interruptedParagraphs: [{ paragraphStartIndex: 0, listStartIndex: 1, endIndex: 1 }]
            });
        }
    );

    it.each([false, true])('ends quoted list state at a physical blank (extension=%s)', enabled => {
        const lines = ['> - seed', '', '  continuation', '- TARGET'];
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: enabled
        })).toEqual(new Set(enabled ? [] : [3]));
    });

    it.each([false, true])('keeps a deeper bare quote marker in the list item (extension=%s)', enabled => {
        const lines = ['- seed', '>', 'continuation', '- TARGET'];
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: enabled
        })).toEqual(new Set());
    });

    it('rescans a rejected lazy definition marker as the next root term', () => {
        const lines = ['> Term', ': one', ': two'];

        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        })).toEqual(new Set());
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        })).toEqual(new Set([1]));
    });

    it.each([
        [false, new Set<number>()],
        [true, new Set([2])]
    ])(
        'ends a quoted definition before a shallower later marker (extension=%s)',
        (enabled, expectedInvalidLines) => {
            expect(ListBlockValidator.validateListBlocks(
                ['> Term', '> : one', ': two'],
                { enableListsWithoutPrecedingBlankline: enabled }
            )).toEqual(expectedInvalidLines);
        }
    );

    it.each([
        [['> Term', '>', ': definition'], 2],
        [['> > Term', '> >', '> : definition'], 2]
    ])('retains a lazy definition across a quote-owned blank: %j', (lines, markerIndex) => {
        expect(ListBlockValidator.validateListBlocks(lines as string[], {
            enableListsWithoutPrecedingBlankline: false
        })).toEqual(new Set());
        expect(ListBlockValidator.validateListBlocks(lines as string[], {
            enableListsWithoutPrecedingBlankline: true
        })).toEqual(new Set([markerIndex as number]));
    });

    it.each([
        ['- NATIVE_TERM', ' : one', ' : two', '- NATIVE_TAIL'],
        ['10. NATIVE_TERM', '   : one', '   : two', '11. NATIVE_TAIL']
    ])('rescans an under-indented native definition marker: %j', (...lines) => {
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        })).toEqual(new Set([1]));
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        })).toEqual(new Set([1]));
    });

    it.each([
        ['> - seed', '>', 'continuation', '- TARGET'],
        ['> - seed', '>', '> continuation', '> - TARGET']
    ])('retains same-container quoted blank-line semantics: %j', (...lines) => {
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        })).toEqual(new Set([3]));
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        })).toEqual(new Set());
    });
});
