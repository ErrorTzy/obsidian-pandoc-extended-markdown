import {
    formatOrderedListMarker,
    getAvailableOrderedMarkerStyles,
    parseOrderedListMarker,
    resolveOrderedListItem,
    resolveOrderedListItems
} from '../../../src/shared/utils/orderedListMarkers';
import { PandocExtendedMarkdownSettings } from '../../../src/shared/types/settingsTypes';

describe('orderedListMarkers', () => {
    const settings: Partial<PandocExtendedMarkdownSettings> = {
        enableFancyLists: true,
        enableOrderedListMarkerCycling: true,
        orderedListMarkerOrder: [
            'decimal-period',
            'lower-alpha-period',
            'lower-roman-period',
            'upper-alpha-period'
        ]
    };

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

    it('marks decimal-period items under plugin-managed unordered ancestors as bridge items', () => {
        const items = resolveOrderedListItems([
            '- parent',
            '    1. child',
            '    2. child',
            '        a. grandchild',
            '        b. grandchild',
            '    3. child'
        ], settings);

        expect(items.map(item => ({
            lineIndex: item.lineIndex,
            style: item.style,
            ownership: item.ownership,
            parentLineIndex: item.parentLineIndex
        }))).toEqual([
            { lineIndex: 1, style: 'decimal-period', ownership: 'bridge', parentLineIndex: 0 },
            { lineIndex: 2, style: 'decimal-period', ownership: 'bridge', parentLineIndex: 0 },
            { lineIndex: 3, style: 'lower-alpha-period', ownership: 'extended', parentLineIndex: 2 },
            { lineIndex: 4, style: 'lower-alpha-period', ownership: 'extended', parentLineIndex: 2 },
            { lineIndex: 5, style: 'decimal-period', ownership: 'bridge', parentLineIndex: 0 }
        ]);
    });

});
