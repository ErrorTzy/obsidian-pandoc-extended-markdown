import {
    parseStandardListItem
} from '../../../src/shared/utils/listContext';

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
});
