import 'obsidian';

import { findLazyBlockQuoteListRelocations, relocateLazyBlockQuoteListItems } from '../../../src/reading-mode/features/native-lists/blockQuoteRelocation';
import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';

describe('Pandoc lazy block-quote list relocation analysis', () => {
    const disabled = { enableListsWithoutPrecedingBlankline: false };

    function analyze(lines: string[]) {
        const invalidLines = ListBlockValidator.validateListBlocks(lines, disabled);
        return findLazyBlockQuoteListRelocations(lines, invalidLines, false)
            .map(relocation => ({
                index: relocation.sourceLine.index,
                kind: relocation.sourceLine.kind,
                targetDepth: relocation.targetBlockQuoteDepth
            }));
    }

    it('captures a shallower list at the active block-quote depth', () => {
        expect(analyze(['> - seed', '- TARGET'])).toEqual([{
            index: 1,
            kind: 'ul',
            targetDepth: 1
        }]);
    });

    it('recursively preserves the deepest lazy block-quote depth', () => {
        expect(analyze(['> > - seed', '> - TARGET'])).toEqual([{
            index: 1,
            kind: 'ul',
            targetDepth: 2
        }]);
    });

    it('does not cross a physical blank-line boundary', () => {
        expect(analyze(['> - seed', '', '- TARGET'])).toEqual([]);
    });

    it('records mixed list kinds without folding them together', () => {
        expect(analyze(['> - seed', '1. TARGET'])).toEqual([{
            index: 1,
            kind: 'ol',
            targetDepth: 1
        }]);
    });

    it('does not relocate list-looking multiline inline-code content', () => {
        expect(analyze([
            '> Paragraph ``',
            '- CODE_MUST_STAY',
            '``',
            '- TARGET'
        ])).toEqual([]);
    });

    it('keeps a target in a lazy quote across paragraph-continuation block shapes', () => {
        expect(analyze(['> - seed', '***', '- TARGET'])).toEqual([{
            index: 2,
            kind: 'ul',
            targetDepth: 1
        }]);
        expect(analyze([
            '> - seed',
            '~~~',
            'code',
            '~~~',
            '- TARGET'
        ])).toEqual([{
            index: 4,
            kind: 'ul',
            targetDepth: 1
        }]);
    });

    it('ends lazy quote capture at Pandoc paragraph-interrupting boundaries', () => {
        expect(analyze([
            '> - seed',
            '```',
            'code',
            '```',
            '- TARGET'
        ])).toEqual([]);
        expect(analyze(['> - seed', '---', '- TARGET'])).toEqual([]);
    });

    it('does nothing when the extension is enabled', () => {
        const lines = ['> - seed', '- TARGET'];
        expect(findLazyBlockQuoteListRelocations(lines, new Set(), true)).toEqual([]);
    });

    it('does not move a list item detached during asynchronous source matching', () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><ul><li>seed</li></ul></blockquote><ul><li>TARGET</li></ul>';
        const list = root.lastElementChild as HTMLElement;
        const item = list.firstElementChild as HTMLLIElement;
        item.remove();
        const html = root.innerHTML;
        expect(relocateLazyBlockQuoteListItems(root, [{
            targetBlockQuoteDepth: 1,
            sourceLine: { index: 1, source: '- TARGET', kind: 'ul', itemText: 'TARGET', indentColumns: 0 },
            match: { list, item }
        }])).toBe(false);
        expect(root.innerHTML).toBe(html);
    });

    it('does not move a list out of a detached source wrapper', () => {
        const root = document.createElement('div');
        root.innerHTML = '<section><blockquote><ul><li>seed</li></ul></blockquote>' +
            '<ul><li>TARGET</li></ul></section>';
        const wrapper = root.firstElementChild as HTMLElement;
        const list = wrapper.lastElementChild as HTMLElement;
        const item = list.firstElementChild as HTMLLIElement;
        wrapper.remove();
        const html = wrapper.innerHTML;
        expect(relocateLazyBlockQuoteListItems(root, [{
            targetBlockQuoteDepth: 1,
            sourceLine: { index: 1, source: '- TARGET', kind: 'ul', itemText: 'TARGET', indentColumns: 0 },
            match: { list, item }
        }])).toBe(false);
        expect(wrapper.innerHTML).toBe(html);
    });
});
