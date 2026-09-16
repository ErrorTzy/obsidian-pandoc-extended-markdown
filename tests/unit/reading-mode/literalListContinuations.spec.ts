import { NativeListSpacingProcessor } from '../../../src/reading-mode/pipeline/processors/nativeListSpacingProcessor';
import { ReadingModeContext } from '../../../src/reading-mode/pipeline/types';
import { reconcileLiteralListContinuations } from '../../../src/reading-mode/features/native-lists/literalContinuationReconciler';
import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';

describe('source-owned literal list-item continuations', () => {
    function process(root: HTMLElement, source: string, enabled = false): void {
        new NativeListSpacingProcessor().process({
            element: root,
            section: root,
            sourcePath: 'nested.md',
            sectionInfo: { text: source, lineStart: 0, lineEnd: source.split('\n').length - 1 },
            config: { enableListsWithoutPrecedingBlankline: enabled },
            postProcessorContext: { getSectionInfo: () => null }
        } as unknown as ReadingModeContext);
    }

    // Real Obsidian matches Pandoc for this indentation. The processor must not
    // mistake the source marker for another rendered nested list to consume.
    it.each([false, true])('preserves native literal continuation DOM and its tail (extension=%s)', enabled => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>parent\n- <a href="child">CHILD</a></li><li>TAIL</li></ul>';
        const parent = root.querySelector('li');
        const tail = root.querySelector('ul')?.lastElementChild;
        const link = root.querySelector('a');
        const html = root.innerHTML;
        process(root, '- parent\n      - [CHILD](child)\n- TAIL', enabled);
        expect(root.innerHTML).toBe(html);
        expect(root.querySelectorAll('li')).toHaveLength(2);
        expect(root.querySelector('li')).toBe(parent);
        expect(root.querySelector('ul')?.lastElementChild).toBe(tail);
        expect(root.querySelector('a')).toBe(link);
        expect(parent?.textContent?.replace(/\s+/g, ' ').trim()).toBe('parent - CHILD');
    });

    it('retains a valid nested tail after literal continuation text', () => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>parent\n- CHILD<ul><li>NEXT<ul><li>GRANDCHILD</li></ul></li></ul></li></ul>';
        const next = root.querySelectorAll('li')[1];
        const grandchild = root.querySelectorAll('li')[2];
        const html = root.innerHTML;
        process(root, '- parent\n      - CHILD\n  - NEXT\n      - GRANDCHILD');
        expect(root.innerHTML).toBe(html);
        expect(root.querySelectorAll('li')).toHaveLength(3);
        expect(root.querySelectorAll('li')[1]).toBe(next);
        expect(root.querySelectorAll('li')[2]).toBe(grandchild);
        expect(root.querySelector('li')?.childNodes[0].textContent).toContain('parent');
        expect(root.textContent).toContain('- CHILD');
    });

    it('atomically rejoins a host-split wide-marker item without replacing its tail', async () => {
        const source = '-    PARENT\n    - CHILD_MUST_STAY\n- ROOT_TAIL';
        const root = document.createElement('div');
        root.innerHTML = [
            '<div class="el-ul"><ul><li>PARENT</li></ul></div>',
            '<div class="el-pre"><pre><code>- CHILD_MUST_STAY\n</code></pre></div>',
            '<div class="el-ul"><ul><li>ROOT_TAIL</li></ul></div>'
        ].join('');
        const parent = root.querySelector<HTMLLIElement>('li');
        const tail = root.querySelectorAll<HTMLLIElement>('li')[1];
        const analysis = ListBlockValidator.analyzeListBlocks(source.split('\n'), {
            enableListsWithoutPrecedingBlankline: false
        });
        const context = {
            app: {},
            element: root,
            section: root,
            sourcePath: 'wide.md',
            fullSource: source,
            sectionInfo: { text: source, lineStart: 0, lineEnd: 2 },
            config: { enableListsWithoutPrecedingBlankline: false },
            postProcessorContext: { addChild: jest.fn() },
            validationLines: source.split('\n')
        } as unknown as ReadingModeContext;

        await reconcileLiteralListContinuations(
            analysis.sourceLines,
            analysis.literalListContinuations,
            context,
            root,
            () => true
        );

        expect(root.querySelectorAll('ul')).toHaveLength(1);
        expect(root.querySelectorAll('li')).toHaveLength(2);
        expect(root.querySelector('li')).toBe(parent);
        expect(root.querySelectorAll('li')[1]).toBe(tail);
        expect(root.querySelector('pre')).toBeNull();
        expect(parent?.textContent?.replace(/\s+/g, ' ').trim())
            .toBe('PARENT - CHILD_MUST_STAY');
        expect(root.textContent?.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
    });
});
