import {
    formatStandardMarkerType,
    findLocalChildMarkerOverride,
    findPreviousStandardListItemAtIndent,
    resolveLocalChildMarkerForMove,
    resolvePreviousTargetMarker,
    resolveStandardListItem
} from '../../../src/shared/utils/standardListMarkerResolution';

describe('standardListMarkerResolution', () => {
    it('resolves ordered marker styles and unordered marker types', () => {
        const lines = [
            'a. parent',
            '    - child'
        ];

        expect(resolveStandardListItem(lines, 0)?.markerType).toEqual({
            kind: 'ordered',
            style: 'lower-alpha-period'
        });
        expect(resolveStandardListItem(lines, 1)?.markerType).toEqual({
            kind: 'unordered',
            marker: '-'
        });
    });

    it('finds previous target-level context across nested descendants', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            '        i. grandchild',
            '        ii. '
        ];

        expect(findPreviousStandardListItemAtIndent(lines, 3, 4)?.markerType).toEqual({
            kind: 'unordered',
            marker: '-'
        });
    });

    it('finds same-chunk parent-to-child marker overrides', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            '    - child',
            'c. parent',
            'd. '
        ];

        expect(findLocalChildMarkerOverride({
            lines,
            currentLineIndex: 5,
            parentIndentColumns: 0,
            childIndentColumns: 4,
            parentMarkerType: { kind: 'ordered', style: 'lower-alpha-period' }
        })).toEqual({
            kind: 'unordered',
            marker: '-'
        });
    });

    it('does not carry parent-to-child marker overrides across blank lines', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            '',
            'a. parent',
            'b. '
        ];

        expect(findLocalChildMarkerOverride({
            lines,
            currentLineIndex: 5,
            parentIndentColumns: 0,
            childIndentColumns: 4,
            parentMarkerType: { kind: 'ordered', style: 'lower-alpha-period' }
        })).toBeNull();
    });

    it('continues an ordered target-level marker from previous parent context', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            '    - '
        ];

        expect(resolvePreviousTargetMarker({
            lines,
            startLineIndex: 2,
            targetIndentColumns: 0,
            settings: { enableFancyLists: true }
        })?.marker).toBe('c.');
    });

    it('preserves an unordered target-level marker from previous parent context', () => {
        const lines = [
            '- parent',
            '    1. child',
            '    2. '
        ];

        expect(resolvePreviousTargetMarker({
            lines,
            startLineIndex: 1,
            targetIndentColumns: 0,
            settings: {}
        })?.marker).toBe('-');
    });

    it('formats resolved unordered and ordered marker types', () => {
        expect(formatStandardMarkerType({ kind: 'unordered', marker: '+' })).toBe('+');
        expect(formatStandardMarkerType({ kind: 'ordered', style: 'upper-roman-one-paren' }, 3)).toBe('III)');
    });

    it('only resolves local child marker overrides for deeper target levels', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            'c. '
        ];

        expect(resolveLocalChildMarkerForMove({
            lines,
            currentLineIndex: 3,
            currentIndentColumns: 0,
            targetIndentColumns: 4,
            currentMarkerType: { kind: 'ordered', style: 'lower-alpha-period' }
        })).toEqual({
            kind: 'unordered',
            marker: '-'
        });

        expect(resolveLocalChildMarkerForMove({
            lines,
            currentLineIndex: 3,
            currentIndentColumns: 4,
            targetIndentColumns: 0,
            currentMarkerType: { kind: 'ordered', style: 'lower-alpha-period' }
        })).toBeNull();
    });

    it('keeps marker overrides specific to the parent and child indentation relationship', () => {
        const lines = [
            'a. parent',
            'b. parent',
            '    - child',
            'c. parent',
            '    - child',
            '    - '
        ];

        expect(findLocalChildMarkerOverride({
            lines,
            currentLineIndex: 5,
            parentIndentColumns: 4,
            childIndentColumns: 8,
            parentMarkerType: { kind: 'unordered', marker: '-' }
        })).toBeNull();
    });
});
