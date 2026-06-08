import {
    findPreviousListItemAtIndent,
    parseStandardListItem
} from '../../../src/shared/utils/listContext';
import { getNextListMarker } from '../../../src/shared/utils/listMarkerDetector';

describe('listContext', () => {
    it('parses ordered and unordered standard list items', () => {
        expect(parseStandardListItem('    - child')).toMatchObject({
            kind: 'unordered',
            indentColumns: 4,
            marker: '-',
            spaces: ' ',
            content: 'child'
        });

        expect(parseStandardListItem('        iii. ')).toMatchObject({
            kind: 'ordered',
            indentColumns: 8,
            marker: 'iii.',
            spaces: ' ',
            content: ''
        });
    });

    it('finds the nearest previous list item that owns the target indent', () => {
        const lines = [
            'a. xxx',
            'b. xxx',
            '    - xxx',
            '    - xxx',
            '        i. xxx',
            '        ii. xxx',
            '        iii. '
        ];

        expect(findPreviousListItemAtIndent(lines, 5, 4)).toMatchObject({
            kind: 'unordered',
            lineIndex: 3,
            marker: '-'
        });
    });

    it('continues unordered list markers without entering ordered cycling', () => {
        expect(getNextListMarker('    - xxx')).toEqual({
            marker: '-',
            indent: '    ',
            spaces: ' '
        });
    });
});
