import {
    parseStandardListItem,
    parseTaskCheckboxPrefix,
    stripTaskCheckboxFromContent
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

    it('exposes task prefix geometry without treating task state as content', () => {
        expect(parseTaskCheckboxPrefix('  ', '[X]   content')).toEqual({
            spaces: '  [x]   ',
            content: 'content',
            taskState: 'checked',
            leadingSpaces: '  ',
            trailingSpaces: '   ',
            checkboxOffset: 2,
            contentOffset: 8,
            sourceCharacter: 'X'
        });
        expect(stripTaskCheckboxFromContent('[ ] content')).toBe('content');
        expect(stripTaskCheckboxFromContent('[x]content')).toBe('[x]content');
    });
});
