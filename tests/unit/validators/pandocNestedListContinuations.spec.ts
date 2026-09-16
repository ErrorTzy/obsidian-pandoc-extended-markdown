import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';
import { parsePandocListMarker } from '../../../src/shared/utils/pandocListMarkers';
import { PandocListItemContinuations } from '../../../src/shared/utils/pandocListItemContinuations';

describe('Pandoc list-item subparser marker indentation', () => {
    it.each([
        ['- parent', 2], ['10. parent', 4], ['100. parent', 5],
        ['-    parent', 5], ['-     parent', 2], ['-', 1]
    ])('uses consumed marker spacing for %s', (line, expected) => {
        expect(parsePandocListMarker(line, false)?.contentIndentColumns).toBe(expected);
    });

    it.each([
        ['- parent', 2], ['10. parent', 4], ['100. parent', 5], ['-    parent', 5]
    ])('recognizes zero through three relative indentation columns after %s', (parent, contentIndent) => {
        for (const enabled of [false, true]) {
            for (let relativeIndent = 0; relativeIndent <= 3; relativeIndent++) {
                const lines = [parent, `${' '.repeat(contentIndent + relativeIndent)}- CHILD_MUST_STAY`];
                const analysis = ListBlockValidator.analyzeListBlocks(lines, {
                    enableListsWithoutPrecedingBlankline: enabled
                });
                expect(analysis.invalidLines).toEqual(new Set());
                expect(analyzeItemContinuations(lines)).toEqual([]);
            }
        }
    });

    it.each([
        ['- parent', 2], ['10. parent', 4], ['100. parent', 5], ['-    parent', 5]
    ])('keeps four or more relative columns in the paragraph after %s', (parent, contentIndent) => {
        for (const enabled of [false, true]) {
            for (const relativeIndent of [4, 5, 8]) {
                const lines = [parent, `${' '.repeat(contentIndent + relativeIndent)}- CHILD_MUST_STAY`];
                const analysis = ListBlockValidator.analyzeListBlocks(lines, {
                    enableListsWithoutPrecedingBlankline: enabled
                });
                expect(analysis.invalidLines).toEqual(new Set([1]));
                expect(analyzeItemContinuations(lines)).toEqual([{
                    parentIndex: 0, startIndex: 1, endIndex: 1, markerIndices: [1], kind: 'paragraph'
                }]);
            }
        }
    });

    it('stops literal ownership before a valid nested sibling and preserves the ancestor stack', () => {
        const lines = ['- parent', '      - literal', '  - child', '        - deep literal', '    - grandchild'];
        const analysis = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        });
        expect(analysis.invalidLines).toEqual(new Set([1, 3]));
        expect(analyzeItemContinuations(lines)).toEqual([
            { parentIndex: 0, startIndex: 1, endIndex: 1, markerIndices: [1], kind: 'paragraph' },
            { parentIndex: 2, startIndex: 3, endIndex: 3, markerIndices: [3], kind: 'paragraph' }
        ]);
    });

    it('distinguishes item code blocks from lazy paragraph continuations', () => {
        const lines = ['- parent', '', '      - CODE_MUST_STAY', '  - child'];
        const analysis = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        });
        expect(analysis.invalidLines).toEqual(new Set([2]));
        expect(analyzeItemContinuations(lines)).toEqual([{
            parentIndex: 0, startIndex: 2, endIndex: 2, markerIndices: [2], kind: 'code'
        }]);
    });

    it('requires a nested ordered list to begin at one', () => {
        const lines = ['- parent', '  2. literal', '  1. child'];
        const analysis = ListBlockValidator.analyzeListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: true
        });
        expect(analysis.invalidLines).toEqual(new Set([1]));
        expect(analyzeItemContinuations(lines)).toEqual([{
            parentIndex: 0, startIndex: 1, endIndex: 1, markerIndices: [1], kind: 'paragraph'
        }]);
    });

    it('allows later non-one ordered siblings after a nested list has begun', () => {
        for (const enabled of [false, true]) {
            const lines = ['- parent', '  1. first', '  2. second', '  9. third'];
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(new Set());
        }
    });

    it.each([
        [['> 100. parent', '>          - CHILD'], 1],
        [['See[^n].', '', '[^n]: 10. parent', '             - CHILD'], 3],
        [['<section>', '    - parent', '      - CHILD', '</section>'], 2]
    ])('maps literal markers through source containers %j', (lines, markerIndex) => {
        for (const enabled of [false, true]) {
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(new Set([markerIndex]));
        }
    });

    it('preserves leading note-body spaces when measuring a parent list continuation', () => {
        const lines = ['See[^n].', '', '[^n]: 10. parent', '            - CHILD'];
        expect(ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: false
        })).toEqual(new Set());
    });

    it.each(['- CHILD', '1. CHILD', '2. CHILD'])('does not promote an under-indented child of a wide parent: %s', child => {
        for (const enabled of [false, true]) {
            expect(ListBlockValidator.validateListBlocks(['100. parent', `    ${child}`], {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(new Set([1]));
        }
    });

    it.each([
        [['- parent', '  \t- child', '- tail'], new Set<number>()],
        [['-    parent', ' \t- literal', '- tail'], new Set([1])]
    ])('advances mixed indentation tabs to Pandoc four-column stops: %j', (lines, expected) => {
        for (const enabled of [false, true]) {
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(expected);
        }
    });
});

function analyzeItemContinuations(lines: string[]) {
    const parser = new PandocListItemContinuations();
    parser.startRoot(lines[0], 0, parsePandocListMarker(lines[0], true)!);
    lines.slice(1).forEach((line, offset) => {
        if (!line.trim()) {
            parser.blank();
        } else {
            parser.append(line, offset + 1);
        }
    });
    return parser.ranges;
}
