import {
    formatOrderedListMarker,
    getAvailableOrderedMarkerStyles,
    parseOrderedListMarker,
    resolveOrderedListItem,
    resolveOrderedListItems,
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

    it('treats first same-group i markers as roman even when unrelated previous children are alphabetic', () => {
        const lines = [
            'a. earlier parent',
            '    h. unrelated alphabetic child',
            'b. parent',
            '    i. first child'
        ];

        expect(parseOrderedListMarker(lines[3], lines, 3)).toMatchObject({
            style: 'lower-roman-period',
            ordinal: 1
        });
    });

    it('treats ambiguous i markers after blank lines as roman starts of independent list chunks', () => {
        const lines = [
            'a. previous chunk',
            '',
            'i. independent roman chunk'
        ];

        expect(parseOrderedListMarker(lines[2], lines, 2)).toMatchObject({
            style: 'lower-roman-period',
            ordinal: 1
        });
    });

    it('treats first same-group I parenthesis markers as roman even when unrelated previous children are alphabetic', () => {
        const lines = [
            'A. earlier parent',
            '    H) unrelated alphabetic child',
            'B. parent',
            '    I) first child'
        ];

        expect(parseOrderedListMarker(lines[3], lines, 3)).toMatchObject({
            style: 'upper-roman-one-paren',
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

    it('marks standalone decimal-period lists as native', () => {
        expect(resolveOrderedListItem(['1. item'], 0, settings)).toMatchObject({
            style: 'decimal-period',
            ownership: 'native'
        });
    });

    it('marks nested decimal-period items under fancy ordered ancestors as bridge items', () => {
        const items = resolveOrderedListItems(['I) parent', '    1. child'], {
            ...settings,
            orderedListMarkerOrder: [
                'decimal-period',
                'upper-roman-one-paren'
            ]
        });

        expect(items[0]).toMatchObject({
            style: 'upper-roman-one-paren',
            ownership: 'extended'
        });
        expect(items[1]).toMatchObject({
            style: 'decimal-period',
            ownership: 'bridge',
            parentLineIndex: 0
        });
    });

    it('wraps upper-roman-one-paren children to decimal-period in the configured order', () => {
        const lines = ['I) parent', 'II) target'];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 1,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'upper-roman-one-paren',
            direction: 'indent',
            settings: {
                ...settings,
                orderedListMarkerOrder: [
                    'decimal-period',
                    'upper-roman-one-paren'
                ]
            }
        });

        expect(style).toBe('decimal-period');
    });

    it('does not reuse same-indent siblings from a previous ordered-list group', () => {
        const lines = [
            'a. parent',
            '    A. unrelated child',
            'b. sibling',
            'c. target'
        ];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 3,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'lower-alpha-period',
            direction: 'indent',
            settings
        });

        expect(style).toBe('lower-roman-period');
    });

    it('ignores unrelated previous decimal lists when cycling under an extended list', () => {
        const lines = [
            '1. native',
            '    A. unrelated child',
            '',
            'I) parent',
            'II) target'
        ];

        const style = resolveOrderedListMarkerStyle({
            lines,
            currentLineIndex: 4,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentStyle: 'upper-roman-one-paren',
            direction: 'indent',
            settings: {
                ...settings,
                orderedListMarkerOrder: [
                    'decimal-period',
                    'upper-roman-one-paren'
                ]
            }
        });

        expect(style).toBe('decimal-period');
    });
});
