import {
    formatMarkerPrefix,
    StandardListMarkerType
} from '../../../src/editor-extensions/listAutocompletion/utils/standardListStructure';

describe('Pandoc-compatible ordered-list autocompletion formatting', () => {
    it.each([
        ['A.', 'upper-alpha-period'],
        ['Z.', 'upper-alpha-period'],
        ['I.', 'upper-roman-period'],
        ['V.', 'upper-roman-period'],
        ['X.', 'upper-roman-period'],
        ['L.', 'upper-roman-period'],
        ['C.', 'upper-roman-period'],
        ['D.', 'upper-roman-period'],
        ['M.', 'upper-roman-period']
    ] as const)('pads the ambiguous %s marker with two spaces', (marker, style) => {
        const markerType: StandardListMarkerType = {
            kind: 'ordered',
            style,
            taskState: null
        };

        expect(formatMarkerPrefix(marker, markerType)).toBe(`${marker}  `);
    });

    it.each([
        ['II.', 'upper-roman-period'],
        ['a.', 'lower-alpha-period'],
        ['1.', 'decimal-period'],
        ['A)', 'upper-alpha-one-paren'],
        ['I)', 'upper-roman-one-paren']
    ] as const)('keeps one space after the unambiguous %s marker', (marker, style) => {
        const markerType: StandardListMarkerType = {
            kind: 'ordered',
            style,
            taskState: null
        };

        expect(formatMarkerPrefix(marker, markerType)).toBe(`${marker} `);
    });

    it('places Pandoc-required padding before an inserted task checkbox', () => {
        const markerType: StandardListMarkerType = {
            kind: 'ordered',
            style: 'upper-alpha-period',
            taskState: 'unchecked'
        };

        expect(formatMarkerPrefix('A.', markerType)).toBe('A.  [ ] ');
    });
});
