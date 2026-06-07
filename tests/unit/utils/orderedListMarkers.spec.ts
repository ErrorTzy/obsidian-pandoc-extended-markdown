import {
    formatOrderedListMarker,
    getAvailableOrderedMarkerStyles,
    parseOrderedListMarker,
    resolveOrderedListMarkerStyle
} from '../../../src/shared/utils/orderedListMarkers';

describe('orderedListMarkers', () => {
    const settings = {
        enableFancyLists: true,
        enableOrderedListMarkerCycling: true,
        orderedListMarkerOrder: [
            'decimal-period',
            'lower-alpha-period',
            'lower-roman-period',
            'upper-alpha-period'
        ]
    } as const;

    it('parses decimal, alpha, and roman markers with delimiters', () => {
        expect(parseOrderedListMarker('  12) item')).toMatchObject({
            indent: '  ',
            indentColumns: 2,
            style: 'decimal-one-paren',
            ordinal: 12,
            delimiter: ')',
            spaces: ' ',
            content: 'item'
        });
        expect(parseOrderedListMarker('b. item')).toMatchObject({
            style: 'lower-alpha-period',
            ordinal: 2
        });
        expect(parseOrderedListMarker('IV) item')).toMatchObject({
            style: 'upper-roman-one-paren',
            ordinal: 4
        });
    });

    it('formats ordered markers from style and ordinal', () => {
        expect(formatOrderedListMarker('decimal-period', 3)).toBe('3.');
        expect(formatOrderedListMarker('lower-alpha-period', 2)).toBe('b.');
        expect(formatOrderedListMarker('lower-roman-period', 4)).toBe('iv.');
        expect(formatOrderedListMarker('upper-alpha-one-paren', 3)).toBe('C)');
    });

    it('does not parse ordered-looking text without marker spacing', () => {
        expect(parseOrderedListMarker('1.item')).toBeNull();
        expect(parseOrderedListMarker('1.')).toMatchObject({
            style: 'decimal-period',
            ordinal: 1
        });
    });

    it('uses previous same-indent context to disambiguate i as alpha', () => {
        const lines = ['h. eighth', 'i. ninth', 'j. tenth'];

        expect(parseOrderedListMarker(lines[1], lines, 1)).toMatchObject({
            style: 'lower-alpha-period',
            ordinal: 9
        });
        expect(parseOrderedListMarker(lines[2], lines, 2)).toMatchObject({
            style: 'lower-alpha-period',
            ordinal: 10
        });
        expect(parseOrderedListMarker('i. first')).toMatchObject({
            style: 'lower-roman-period',
            ordinal: 1
        });
    });

    it('filters alpha and roman styles when fancy lists are disabled', () => {
        expect(getAvailableOrderedMarkerStyles({
            enableFancyLists: false,
            orderedListMarkerOrder: [
                'decimal-period',
                'lower-alpha-period',
                'decimal-one-paren',
                'lower-roman-period'
            ]
        })).toEqual(['decimal-period', 'decimal-one-paren']);
    });

    it('derives a child style from the nearest ordered parent', () => {
        const lines = ['a. parent', 'b. child'];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 1,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'lower-alpha-period',
            direction: 'indent',
            settings
        });

        expect(style).toBe('lower-roman-period');
    });

    it('honors custom configured order when deriving child style', () => {
        const lines = ['a. parent', 'b. child'];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 1,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'lower-alpha-period',
            direction: 'indent',
            settings: {
                ...settings,
                orderedListMarkerOrder: [
                    'lower-alpha-period',
                    'decimal-period',
                    'upper-alpha-period'
                ]
            }
        });

        expect(style).toBe('decimal-period');
    });

    it('prefers existing same-indent sibling style at the target indent', () => {
        const lines = [
            'a. parent',
            '    A. existing child',
            'b. target'
        ];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 2,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'lower-alpha-period',
            direction: 'indent',
            settings
        });

        expect(style).toBe('upper-alpha-period');
    });
});
