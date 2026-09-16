import { MarkdownPostProcessorContext, MarkdownRenderer } from 'obsidian';

import { NativeListSpacingProcessor } from '../../../src/reading-mode/pipeline/processors/nativeListSpacingProcessor';
import { ReadingModeContext } from '../../../src/reading-mode/pipeline/types';
import { replaceInterruptedListParagraph } from '../../../src/reading-mode/features/native-lists/interruptedParagraphRenderer';
import {
    findFootnoteListRelocations,
    relocateFootnoteListItems
} from '../../../src/reading-mode/features/native-lists/footnoteRelocation';

const source = [
    'Intro paragraph',
    '- invalid dash',
    '* invalid star',
    '+ invalid plus',
    'After unordered paragraph',
    '',
    '- valid dash',
    '* valid star',
    '+ valid plus',
    '',
    'Before ordered paragraph',
    '1. invalid ordered one',
    '2. invalid ordered two',
    'After ordered paragraph',
    '',
    '1. valid ordered one',
    '2. valid ordered two',
    ''
].join('\n');

describe('NativeListSpacingProcessor', () => {
    it('appends only the list-source suffix after a multiline lead in the renderer fallback', () => {
        const source = 'First lead line\nSecond lead line\n- parent\n  - CHILD_MUST_STAY';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>First lead line\nSecond lead line</p>' +
            '<ul><li>parent<ul><li>CHILD_MUST_STAY</li></ul></li></ul>';

        new NativeListSpacingProcessor().process(createContext(section, source));

        expect(section.textContent).toBe(source);
        expect(section.querySelectorAll('ul')).toHaveLength(0);
    });

    it('replaces only the matched lead paragraph in a multi-child preview wrapper', async () => {
        const source = 'UNRELATED\n\nLead\n- parent\n  - CHILD_MUST_STAY';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<div class="el-p"><p>UNRELATED</p><p>Lead</p></div>' +
            '<ul><li>parent<ul><li>CHILD_MUST_STAY</li></ul></li></ul>';
        const unrelated = section.querySelector('p');
        const wrapper = section.querySelector('.el-p');
        const handler = jest.fn();
        unrelated?.addEventListener('click', handler);
        const context = createContext(section, source);
        context.app = {} as ReadingModeContext['app'];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelector('.el-p')).toBe(wrapper);
        expect(section.querySelector('p')).toBe(unrelated);
        expect(section.textContent).toContain('CHILD_MUST_STAY');
        unrelated?.dispatchEvent(new MouseEvent('click'));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelectorAll('ul')).toHaveLength(0);
    });

    it.each([false, true])('preserves backlinks inside removed list items (renderer enabled: %s)', async rendererEnabled => {
        const source = 'Use[^n].\n\n[^n]: Lead\n    - parent\n      - CHILD_MUST_STAY';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Use<sup>1</sup>.</p><section class="footnotes"><ol>' +
            '<li id="fn-n"><p>Lead</p><ul><li>parent<ul><li>CHILD_MUST_STAY' +
            '<a class="footnote-backref" href="#fnref-n">back</a></li></ul></li></ul>' +
            '</li></ol></section>';
        const backlink = section.querySelector('.footnote-backref');
        const handler = jest.fn();
        backlink?.addEventListener('click', handler);
        const context = createContext(section, source);
        if (rendererEnabled) {
            context.app = {} as ReadingModeContext['app'];
        }

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelector('.footnote-backref')).toBe(backlink);
        expect(section.querySelector('#fn-n p')?.contains(backlink)).toBe(true);
        backlink?.dispatchEvent(new MouseEvent('click'));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelector('#fn-n')?.textContent).toContain('CHILD_MUST_STAY');
        expect(section.querySelectorAll('#fn-n ul')).toHaveLength(0);
    });

    it.each(['detached-list', 'reparented-item'])('rejects a whole footnote relocation group with a stale %s', scenario => {
        const source = 'Use[^n].\n\n[^n]: Lead\n- FIRST\n- SECOND';
        const section = document.createElement('div');
        section.innerHTML = '<p><a data-footref="n" href="#fn-n">1</a></p>' +
            '<ul><li>FIRST</li></ul><ul><li>SECOND</li></ul>' +
            '<section class="footnotes"><ol><li id="fn-n"><p>Lead</p></li></ol></section>';
        const sourceLists = Array.from(section.querySelectorAll<HTMLUListElement>(':scope > ul'));
        const matches = findFootnoteListRelocations(source.split('\n')).map((relocation, index) => ({
            ...relocation,
            match: { list: sourceLists[index], item: sourceLists[index].querySelector('li')! }
        }));
        const staleItem = matches[1].match.item;
        if (scenario === 'detached-list') {
            sourceLists[1].remove();
        } else {
            sourceLists[0].appendChild(staleItem);
        }
        const before = section.innerHTML;

        const relocated = relocateFootnoteListItems(section, matches);

        expect(relocated.size).toBe(0);
        expect(section.innerHTML).toBe(before);
        expect(staleItem.parentElement).toBe(scenario === 'detached-list' ? sourceLists[1] : sourceLists[0]);
    });

    it('preserves unmatched nodes beside a consumed list inside its preview wrapper', async () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Lead</p><div class="el-ul"><ul><li>parent</li></ul>' +
            '<aside>UNRELATED</aside></div>';
        const unrelated = section.querySelector('aside');
        const context = createContext(section, 'Lead\n- parent');
        context.app = {} as ReadingModeContext['app'];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelector('aside')).toBe(unrelated);
        expect(section.textContent).toContain('UNRELATED');
        expect(section.querySelectorAll('ul')).toHaveLength(0);
    });

    it('rejects replaced list-item identities after awaiting the paragraph renderer', async () => {
        const section = document.createElement('div');
        section.innerHTML = '<p>Lead</p><ul><li>parent</li></ul>';
        const list = section.querySelector('ul')!;
        const context = createContext(section, 'Lead\n- parent');
        context.app = {} as ReadingModeContext['app'];
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const implementation = renderMock.getMockImplementation();
        let releaseRender: () => void = () => undefined;
        const gate = new Promise<void>(resolve => { releaseRender = resolve; });
        renderMock.mockImplementationOnce(async (...args: unknown[]) => {
            await gate;
            return implementation?.(...args);
        });

        replaceInterruptedListParagraph({
            listSegments: [{ list, itemCount: 1 }],
            sourceLines: ['Lead', '- parent'],
            listStartOffset: 1,
            transformedParagraphSource: 'Lead\n\\- parent',
            root: section,
            context,
            isCurrent: () => true
        });
        const replacementItem = document.createElement('li');
        replacementItem.textContent = 'NEW_RENDER_MUST_STAY';
        list.replaceChildren(replacementItem);
        const before = section.innerHTML;
        releaseRender();
        await waitForAsyncRendering();

        expect(section.innerHTML).toBe(before);
        expect(section.querySelector('li')).toBe(replacementItem);
    });

    it('replaces invalid native reading-mode lists with plain source text', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Intro paragraph</p>',
            '<ul><li>invalid dash</li><li>invalid star</li>',
            '<li>invalid plus<br>After unordered paragraph</li></ul>',
            '<ul><li>valid dash</li><li>valid star</li><li>valid plus</li></ul>',
            '<p>Before ordered paragraph</p>',
            '<ol><li>invalid ordered one</li>',
            '<li>invalid ordered two<br>After ordered paragraph</li>',
            '<li>valid ordered one</li><li>valid ordered two</li></ol>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        processor.process(createContext(section));

        const listTexts = Array.from(section.querySelectorAll('li'))
            .map(item => item.textContent?.trim());

        expect(section.textContent).toContain('- invalid dash');
        expect(section.textContent).toContain('* invalid star');
        expect(section.textContent).toContain('+ invalid plus');
        expect(section.textContent).toContain('1. invalid ordered one');
        expect(section.textContent).toContain('2. invalid ordered two');
        expect(listTexts).toEqual([
            'valid dash',
            'valid star',
            'valid plus',
            'valid ordered one',
            'valid ordered two'
        ]);
    });

    it('preserves every nested source line when replacing an invalid list block', () => {
        const nestedSource = [
            'Before list',
            '- parent one',
            '    1. ordered child',
            '        - grandchild',
            '- parent two',
            '    - unordered child'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Before list</p>',
            '<ul>',
            '<li>parent one<ol><li>ordered child<ul><li>grandchild</li></ul></li></ol></li>',
            '<li>parent two<ul><li>unordered child</li></ul></li>',
            '</ul>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        processor.process(createContext(section, nestedSource));

        const invalidParagraph = section.querySelector('.pem-pandoc-invalid-native-list');
        expect(invalidParagraph?.textContent).toBe([
            'Before list',
            '- parent one',
            '    1. ordered child',
            '        - grandchild',
            '- parent two',
            '    - unordered child'
        ].join('\n'));
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it('matches task-list parents without consuming their nested children', () => {
        const taskSource = [
            'Before list',
            '- [ ] task parent',
            '    - task child'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Before list</p>',
            '<ul class="contains-task-list">',
            '<li class="task-list-item"><input type="checkbox">task parent',
            '<ul><li>task child</li></ul></li>',
            '</ul>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        processor.process(createContext(section, taskSource));

        const invalidParagraph = section.querySelector('.pem-pandoc-invalid-native-list');
        expect(invalidParagraph?.textContent).toBe([
            'Before list',
            '- [ ] task parent',
            '    - task child'
        ].join('\n'));
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it('preserves the complete issue 16 list hierarchy as paragraph text', () => {
        const issueSource = [
            '# hh',
            'gdhr',
            '- [ ] hgsrg',
            '    1. gsdgr',
            '        a. dhrh',
            '- dgfg',
            '    - sgher'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<h1>hh</h1>',
            '<p>gdhr</p>',
            '<ul class="contains-task-list">',
            '<li class="task-list-item"><input type="checkbox">hgsrg',
            '<ol><li>gsdgr<br>a. dhrh</li></ol></li>',
            '<li>dgfg<ul><li>sgher</li></ul></li>',
            '</ul>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        processor.process(createContext(section, issueSource));

        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'gdhr',
            '- [ ] hgsrg',
            '    1. gsdgr',
            '        a. dhrh',
            '- dgfg',
            '    - sgher'
        ].join('\n'));
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it('keeps inline markup and lazy continuation content while demoting a list', async () => {
        const markedUpSource = [
            'Before list',
            '- **bold** [link](target)',
            'continued text',
            '  - _child_'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Before list</p>',
            '<ul><li><strong>bold</strong> <a href="target">link</a>',
            '<br>continued text<ul><li><em>child</em></li></ul></li></ul>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        const context = createContext(section, markedUpSource);
        context.app = {} as ReadingModeContext['app'];
        processor.process(context);
        await waitForAsyncRendering();

        const paragraph = section.querySelector('.pem-pandoc-invalid-native-list');
        expect(paragraph?.textContent).toContain('- bold link');
        expect(paragraph?.textContent).toContain('continued text');
        expect(paragraph?.textContent).toContain('- child');
        expect(paragraph?.querySelector('strong')?.textContent).toBe('bold');
        expect(paragraph?.querySelector('a')?.getAttribute('href')).toBe('target');
        expect(paragraph?.querySelector('em')?.textContent).toBe('child');
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it('does not consume a valid nested marker after the interrupted paragraph ends', async () => {
        const sourceWithInternalBlank = [
            'Before list',
            '- parent becomes paragraph text',
            '',
            '  - CHILD_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Before list</p>',
            '<ul><li><p>parent becomes paragraph text</p>',
            '<ul><li>CHILD_MUST_STAY</li></ul></li></ul>'
        ].join('');
        const context = createContext(section, sourceWithInternalBlank);
        context.app = {} as ReadingModeContext['app'];
        const sourceOwnedList = section.querySelector('li > ul');
        const sourceOwnedItem = sourceOwnedList?.querySelector(':scope > li');
        const clickHandler = jest.fn();
        sourceOwnedItem?.addEventListener('click', clickHandler);

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent)
            .toContain('- parent becomes paragraph text');
        expect(section.querySelector('ul')).toBe(sourceOwnedList);
        expect(section.querySelector('ul > li')).toBe(sourceOwnedItem);
        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent?.trim()))
            .toEqual(['CHILD_MUST_STAY']);
        sourceOwnedItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('promotes every source-owned block after an interrupted parent without consuming siblings', async () => {
        const multiBlockSource = [
            'Paragraph',
            '- parent becomes paragraph text',
            '',
            '  - CHILD_ONE',
            '  1. CHILD_TWO'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li><p>parent becomes paragraph text</p>',
            '<ul><li>CHILD_ONE</li></ul>',
            '<ol><li>CHILD_TWO</li></ol>',
            '</li></ul>'
        ].join('');
        const context = createContext(section, multiBlockSource);
        context.app = {} as ReadingModeContext['app'];
        const childLists = Array.from(section.querySelectorAll<HTMLElement>('li > ul, li > ol'));
        const childItems = childLists.map(list => list.querySelector(':scope > li'));
        const clickHandler = jest.fn();
        childItems[1]?.addEventListener('click', clickHandler);

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(Array.from(section.querySelectorAll(':scope > ul, :scope > ol')))
            .toEqual(childLists);
        expect(Array.from(section.querySelectorAll(':scope > ul > li, :scope > ol > li')))
            .toEqual(childItems);
        expect(section.textContent).toContain('CHILD_ONE');
        expect(section.textContent).toContain('CHILD_TWO');
        childItems[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('promotes a source-owned block quote after an interrupted parent by identity', async () => {
        const quotedTailSource = [
            'Paragraph',
            '- parent becomes paragraph text',
            '',
            '  > QUOTE_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li><p>parent becomes paragraph text</p>',
            '<blockquote><p>QUOTE_MUST_STAY</p></blockquote>',
            '</li></ul>'
        ].join('');
        const context = createContext(section, quotedTailSource);
        context.app = {} as ReadingModeContext['app'];
        const quote = section.querySelector('blockquote');
        const quoteParagraph = quote?.querySelector('p');
        const clickHandler = jest.fn();
        quoteParagraph?.addEventListener('click', clickHandler);

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelector(':scope > blockquote')).toBe(quote);
        expect(section.querySelector(':scope > blockquote > p')).toBe(quoteParagraph);
        expect(section.textContent).toContain('QUOTE_MUST_STAY');
        quoteParagraph?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('keeps incompatible ordered marker groups in separate promoted lists', async () => {
        const orderedBoundarySource = [
            'Paragraph',
            '1. parent becomes paragraph text',
            '',
            '   1) CHILD_MUST_STAY',
            '7. SIBLING_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ol><li><p>parent becomes paragraph text</p>',
            '<ol><li>CHILD_MUST_STAY</li></ol>',
            '</li><li>SIBLING_MUST_STAY</li></ol>'
        ].join('');
        const context = createContext(section, orderedBoundarySource);
        const lists = Array.from(section.querySelectorAll<HTMLOListElement>('ol'));
        const childList = lists[1];
        const siblingItem = lists[0].children[1];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        const rootLists = Array.from(section.querySelectorAll<HTMLOListElement>(':scope > ol'));
        expect(rootLists).toEqual([childList, lists[0]]);
        expect(childList.querySelector(':scope > li')?.textContent).toBe('CHILD_MUST_STAY');
        expect(lists[0].querySelector(':scope > li')).toBe(siblingItem);
        expect(lists[0].start).toBe(7);
    });

    it('merges a promoted ordered tail only when Pandoc keeps the marker group together', () => {
        const orderedTailSource = [
            'Paragraph',
            '1. parent becomes paragraph text',
            '',
            '   1. CHILD_MUST_STAY',
            '7. SIBLING_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ol><li><p>parent becomes paragraph text</p>',
            '<ol><li>CHILD_MUST_STAY</li></ol>',
            '</li><li>SIBLING_MUST_STAY</li></ol>'
        ].join('');
        const childList = section.querySelectorAll<HTMLOListElement>('ol')[1];
        const childItem = childList.querySelector(':scope > li');
        const siblingItem = section.querySelectorAll<HTMLLIElement>('ol > li')[2];

        new NativeListSpacingProcessor().process(createContext(section, orderedTailSource));

        expect(Array.from(section.querySelectorAll(':scope > ol'))).toEqual([childList]);
        expect(Array.from(childList.children)).toEqual([childItem, siblingItem]);
        expect(childList.start).toBe(1);
    });

    it('does not replace an earlier valid list with identical item text', () => {
        const duplicateSource = [
            'Same introduction',
            '',
            '- duplicate item',
            '',
            'Same introduction',
            '- duplicate item'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Same introduction</p>',
            '<ul><li>duplicate item</li></ul>',
            '<p>Same introduction</p>',
            '<ul><li>duplicate item</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, duplicateSource));

        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent?.trim()))
            .toEqual(['duplicate item']);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Same introduction',
            '- duplicate item'
        ].join('\n'));
        expect(section.lastElementChild?.matches('.pem-pandoc-invalid-native-list')).toBe(true);
    });

    it('does not replace an earlier valid item whose text prefixes the interrupted item', () => {
        const prefixSource = [
            'Intro',
            '',
            '- foo extra',
            '',
            'Paragraph',
            '- foo'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Intro</p>',
            '<ul><li>foo extra</li></ul>',
            '<p>Paragraph</p>',
            '<ul><li>foo</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, prefixSource));

        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent?.trim()))
            .toEqual(['foo extra']);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Paragraph',
            '- foo'
        ].join('\n'));
        expect(section.firstElementChild?.textContent).toBe('Intro');
    });

    it('ignores list-looking text inside an HTML comment when matching source order', () => {
        const commentedSource = [
            '<!--',
            '- duplicate item',
            '-->',
            'Paragraph',
            '- duplicate item'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li>duplicate item</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, commentedSource));

        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Paragraph',
            '- duplicate item'
        ].join('\n'));
    });

    it('stops the replacement at a following Pandoc block boundary', () => {
        const boundarySource = [
            'Paragraph',
            '- item',
            '<div>',
            'content',
            '</div>',
            '- next'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li>item</li></ul>',
            '<div class="boundary">content</div>',
            '<ul><li>next</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, boundarySource));

        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Paragraph',
            '- item'
        ].join('\n'));
        expect(section.querySelectorAll('.boundary')).toHaveLength(1);
        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent))
            .toEqual(['next']);
    });

    it('preserves a materialized indented fence inside an interrupted paragraph', () => {
        const fencedSource = [
            'Paragraph',
            '- first item',
            '  ```',
            '  - CODE_MUST_STAY',
            '  ```',
            '- final item'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul>',
            '<li><p>first item</p><pre><code>- CODE_MUST_STAY</code></pre></li>',
            '<li><p>final item</p></li>',
            '</ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, fencedSource));

        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe(
            fencedSource
        );
        expect(section.textContent).toContain('CODE_MUST_STAY');
        expect(section.querySelectorAll('ul, ol, pre')).toHaveLength(0);
    });

    it.each([
        ['an indented paragraph', '  continuation', '<p class="tail">continuation</p>'],
        ['an indented code block', '    code', '<pre class="tail"><code>code</code></pre>']
    ])('does not duplicate %s after a blank line', (_description, tailSource, tailHtml) => {
        const boundarySource = [
            'Paragraph',
            '- item',
            '',
            tailSource,
            '',
            '- next'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li>item</li></ul>',
            tailHtml,
            '<ul><li>next</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, boundarySource));

        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Paragraph',
            '- item'
        ].join('\n'));
        expect(section.querySelectorAll('.tail')).toHaveLength(1);
        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent))
            .toEqual(['next']);
    });

    it('keeps literal punctuation distinct while matching repeated item text', () => {
        const punctuationSource = [
            'Intro',
            '',
            '- a_b',
            '',
            'Paragraph',
            '- ab'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Intro</p>',
            '<ul><li>a_b</li></ul>',
            '<p>Paragraph</p>',
            '<ul><li>ab</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, punctuationSource));

        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent))
            .toEqual(['a_b']);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent).toBe([
            'Paragraph',
            '- ab'
        ].join('\n'));
    });

    it('uses validator fence rules when matching an interrupted source occurrence', () => {
        const malformedFenceSource = [
            'Paragraph',
            '```',
            'code',
            '- item'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph ``` code</p><ul><li>item</li></ul>';

        new NativeListSpacingProcessor().process(
            createContext(section, malformedFenceSource)
        );

        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent)
            .toContain('- item');
    });

    it('matches inline code without treating Markdown characters inside it as formatting', async () => {
        const codeSource = [
            'Paragraph',
            '- `a_b`'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph</p><ul><li><code>a_b</code></li></ul>';
        const context = createContext(section, codeSource);
        context.app = {} as ReadingModeContext['app'];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(section.querySelector('code')?.textContent).toBe('a_b');
    });

    it('preserves a list-looking line inside multiline inline code', async () => {
        const codeSource = [
            'Paragraph ``',
            '- CODE_MUST_STAY',
            '``',
            '- TARGET'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph <code>- CODE_MUST_STAY</code></p>',
            '<ul><li>TARGET</li></ul>'
        ].join('');
        new NativeListSpacingProcessor().process(createContext(section, codeSource));

        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(section.querySelector('code')?.textContent).toContain('- CODE_MUST_STAY');
        expect(section.textContent).toContain('- TARGET');
        expect(section.textContent).not.toContain('\\- CODE_MUST_STAY');
    });

    it('reconciles a nested list after fenced-div rendering without consuming the div', () => {
        const fencedDivSource = [
            '::: note',
            'Paragraph',
            '- parent',
            '  - CHILD_MUST_STAY',
            ':::'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="pem-fenced-div">',
            '<div class="pem-fenced-div-content">',
            '<p>Paragraph</p>',
            '<ul><li>parent<ul><li>CHILD_MUST_STAY</li></ul></li></ul>',
            '</div>',
            '</div>'
        ].join('');
        const fencedDiv = section.querySelector('.pem-fenced-div');

        new NativeListSpacingProcessor().process(createContext(section, fencedDivSource));

        expect(section.querySelector('.pem-fenced-div')).toBe(fencedDiv);
        expect(fencedDiv?.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(fencedDiv?.textContent).toContain([
            'Paragraph',
            '- parent',
            '  - CHILD_MUST_STAY'
        ].join('\n'));
    });

    it('reuses an existing block quote instead of nesting a rendered replacement', async () => {
        const quoteSource = [
            '> Paragraph',
            '> - child'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<blockquote><p>Paragraph</p><ul><li>child</li></ul></blockquote>';
        const context = createContext(section, quoteSource);
        context.app = {} as ReadingModeContext['app'];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        expect(section.querySelectorAll('blockquote')).toHaveLength(1);
        expect(section.querySelector('blockquote > p')?.textContent).toBe('Paragraph\n- child');
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it.each([false, true])(
        'demotes a list in an otherwise empty deeper quote when the extension is %s',
        enableListsWithoutPrecedingBlankline => {
            const quoteSource = [
                'Paragraph',
                '>',
                '> - CHILD_MUST_STAY'
            ].join('\n');
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="el-p"><p>Paragraph</p></div>',
                '<div class="el-blockquote"><blockquote>',
                '<ul><li>CHILD_MUST_STAY</li></ul>',
                '</blockquote></div>',
                '<aside>AFTER_MUST_STAY</aside>'
            ].join('');
            const after = section.querySelector('aside');
            const context = createContext(section, quoteSource);
            context.config.enableListsWithoutPrecedingBlankline =
                enableListsWithoutPrecedingBlankline;

            new NativeListSpacingProcessor().process(context);

            expect(section.querySelectorAll('blockquote, ul, ol')).toHaveLength(0);
            expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent)
                .toBe(quoteSource);
            expect(section.querySelector('aside')).toBe(after);
        }
    );

    it('never consumes an unrelated sibling between matched list segments', async () => {
        const mixedSource = [
            'Paragraph',
            '- first',
            '+ second'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li>first</li></ul>',
            '<aside>UNRELATED_MUST_STAY</aside>',
            '<ul><li>second</li></ul>'
        ].join('');
        const unrelated = section.querySelector('aside');
        const handler = jest.fn();
        unrelated?.addEventListener('click', handler);
        const context = createContext(section, mixedSource);
        context.app = {} as ReadingModeContext['app'];

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        section.querySelector('aside')?.dispatchEvent(new MouseEvent('click'));
        expect(section.querySelector('aside')).toBe(unrelated);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelectorAll('ul, ol')).toHaveLength(0);
    });

    it('moves a lazily captured list into the preceding block quote', () => {
        const quoteSource = [
            '> - seed',
            '- TARGET'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<blockquote><ul><li>seed</li></ul></blockquote>',
            '<ul><li>TARGET</li></ul>'
        ].join('');

        new NativeListSpacingProcessor().process(createContext(section, quoteSource));

        const rootLists = Array.from(section.children)
            .filter(child => child.matches('ul, ol'));
        expect(rootLists).toHaveLength(0);
        expect(Array.from(section.querySelectorAll('blockquote > ul > li'))
            .map(item => item.textContent)).toEqual(['seed', 'TARGET']);
    });

    it.each([
        [false, []],
        [true, ['TARGET']]
    ])('matches a rejected quote-to-root transition when the extension is %s', (
        extensionEnabled,
        expectedListItems
    ) => {
        const transitionSource = [
            'Paragraph',
            '> - seed',
            '- TARGET'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Paragraph</p>',
            '<blockquote><ul><li>seed</li></ul></blockquote>',
            '<ul><li>TARGET</li></ul>'
        ].join('');
        const context = createContext(section, transitionSource);
        context.config.enableListsWithoutPrecedingBlankline = extensionEnabled;

        new NativeListSpacingProcessor().process(context);

        expect(Array.from(section.querySelectorAll('li')).map(item => item.textContent))
            .toEqual(expectedListItems);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')?.textContent)
            .toContain(extensionEnabled ? 'Paragraph\n> - seed' : transitionSource);
    });

    it('moves only the captured prefix and preserves a valid root tail by identity', () => {
        const quoteSource = [
            '> - seed',
            '- CAPTURED',
            '  - CHILD_MUST_STAY',
            '',
            '- OUTSIDE_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<blockquote><ul><li>seed</li></ul></blockquote>',
            '<ul><li>CAPTURED<ul><li>CHILD_MUST_STAY</li></ul></li>',
            '<li>OUTSIDE_MUST_STAY</li></ul>'
        ].join('');
        const outside = section.querySelectorAll('ul > li')[3];
        const handler = jest.fn();
        outside.addEventListener('click', handler);

        new NativeListSpacingProcessor().process(createContext(section, quoteSource));

        const quotedItems = Array.from(section.querySelectorAll('blockquote > ul > li'));
        const rootList = Array.from(section.children)
            .find((child): child is HTMLUListElement => child instanceof HTMLUListElement);
        const retained = rootList?.querySelector(':scope > li');
        retained?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(quotedItems.map(item => item.firstChild?.textContent)).toEqual([
            'seed',
            'CAPTURED',
            'CHILD_MUST_STAY'
        ]);
        expect(quotedItems[1].querySelector('li')).toBeNull();
        expect(retained).toBe(outside);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('preserves ordered-list tail numbering and item listeners', () => {
        const splitSource = [
            'Paragraph',
            '1. invalid',
            '',
            '3. valid'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph</p><ol><li>invalid</li><li>valid</li></ol>';
        const validItem = section.querySelectorAll('li')[1];
        const clickHandler = jest.fn();
        validItem.addEventListener('click', clickHandler);

        new NativeListSpacingProcessor().process(createContext(section, splitSource));

        const remainingList = section.querySelector('ol');
        const remainingItem = remainingList?.querySelector('li');
        remainingItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(remainingList?.start).toBe(3);
        expect(remainingItem).toBe(validItem);
        expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('does not apply stale async work after the extension setting changes', async () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph</p><ul><li>item</li></ul>';
        const disabledContext = createContext(section, 'Paragraph\n- item');
        disabledContext.app = {} as ReadingModeContext['app'];
        const enabledContext = createContext(section, 'Paragraph\n- item');
        enabledContext.app = {} as ReadingModeContext['app'];
        enabledContext.config.enableListsWithoutPrecedingBlankline = true;

        const renderMock = MarkdownRenderer.render as jest.Mock;
        const renderImplementation = renderMock.getMockImplementation();
        const initialRenderCount = renderMock.mock.calls.length;
        let releaseRender: () => void = () => undefined;
        const renderGate = new Promise<void>(resolve => {
            releaseRender = resolve;
        });
        renderMock.mockImplementationOnce(async (...args: unknown[]) => {
            await renderGate;
            return renderImplementation?.(...args);
        });

        const processor = new NativeListSpacingProcessor();
        processor.process(disabledContext);
        await waitUntil(() => renderMock.mock.calls.length > initialRenderCount);
        processor.process(enabledContext);
        await waitForAsyncRendering();
        releaseRender();
        await waitForAsyncRendering();

        expect(section.querySelectorAll('ul')).toHaveLength(1);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')).toBeNull();
    });

    it('reconciles a nested footnote list without consuming the footnote shell', () => {
        const footnoteSource = [
            'Text[^note]',
            '',
            '[^note]: Paragraph',
            '    - parent',
            '      - CHILD_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Text<sup>1</sup></p>',
            '<section class="footnotes"><hr><ol><li id="fn-note">',
            '<p>Paragraph</p>',
            '<ul><li>parent<ul><li>CHILD_MUST_STAY</li></ul></li></ul>',
            '<a class="footnote-back" href="#fnref-note">back</a>',
            '</li></ol></section>'
        ].join('');
        const footnoteItem = section.querySelector('#fn-note');
        const backlink = section.querySelector('.footnote-back');
        const handler = jest.fn();
        backlink?.addEventListener('click', handler);

        new NativeListSpacingProcessor().process(createContext(section, footnoteSource));

        backlink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(section.querySelector('#fn-note')).toBe(footnoteItem);
        expect(section.querySelector('.footnote-back')).toBe(backlink);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelectorAll('.footnotes > ol')).toHaveLength(1);
        expect(section.querySelectorAll('#fn-note ul, #fn-note ol')).toHaveLength(0);
        expect(footnoteItem?.textContent).toContain('Paragraph\n- parent');
        expect(footnoteItem?.textContent).toContain('  - CHILD_MUST_STAY');
    });

    it('preserves rendered footnote content and backlink identity asynchronously', async () => {
        const footnoteSource = 'Use[^n].\n\n[^n]: **Paragraph**\n- *CHILD_MUST_STAY*';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Use<sup>1</sup>.</p>',
            '<section class="footnotes"><ol><li id="fn-n">',
            '<p><strong>Paragraph</strong></p>',
            '<ul><li><em>CHILD_MUST_STAY</em></li></ul>',
            '<a class="footnote-back" href="#fnref-n">back</a>',
            '</li></ol></section>'
        ].join('');
        const context = createContext(section, footnoteSource);
        context.app = {} as ReadingModeContext['app'];
        const footnoteItem = section.querySelector('#fn-n');
        const backlink = section.querySelector('.footnote-back');
        const handler = jest.fn();
        backlink?.addEventListener('click', handler);

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        backlink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(section.querySelector('#fn-n')).toBe(footnoteItem);
        expect(section.querySelector('.footnote-back')).toBe(backlink);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelector('#fn-n strong')?.textContent).toBe('Paragraph');
        expect(section.querySelector('#fn-n em')?.textContent).toBe('CHILD_MUST_STAY');
        expect(section.querySelectorAll('#fn-n ul, #fn-n ol')).toHaveLength(0);
    });

    it.each([
        [false, 0],
        [true, 1]
    ])('matches an unindented lazy footnote list when the extension is %s', (
        extensionEnabled,
        expectedBodyLists
    ) => {
        const footnoteSource = 'Use[^n].\n\n[^n]: note\n- CHILD';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Use<sup>1</sup>.</p>',
            '<section class="footnotes"><ol><li id="fn-n">',
            '<p>note</p><ul><li>CHILD</li></ul>',
            '<a class="footnote-back" href="#fnref-n">back</a>',
            '</li></ol></section>'
        ].join('');
        const context = createContext(section, footnoteSource);
        context.config.enableListsWithoutPrecedingBlankline = extensionEnabled;

        new NativeListSpacingProcessor().process(context);

        expect(section.querySelectorAll('#fn-n > ul')).toHaveLength(expectedBodyLists);
        expect(section.querySelectorAll('.footnotes > ol')).toHaveLength(1);
        expect(section.querySelector('.footnote-back')?.textContent).toBe('back');
        expect(section.querySelector('#fn-n')?.textContent).toContain('CHILD');
    });

    it.each([
        [false, 0],
        [true, 1]
    ])('moves an Obsidian-detached footnote list before applying extension state %s', async (
        extensionEnabled,
        expectedBodyLists
    ) => {
        const footnoteSource = 'Use[^n].\n\n[^n]: note\n- CHILD';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Use<sup><a data-footref="n" href="#fn-generated-n">[1]</a></sup>.</p>',
            '<div class="el-ul"><ul><li>CHILD</li></ul></div>',
            '<section class="footnotes"><hr><ol><li id="fn-generated-n">',
            '<p>note<a class="footnote-backref" href="#fnref-generated-n">back</a></p>',
            '</li></ol></section>'
        ].join('');
        const footnoteIndex = section.querySelector('.footnotes > ol');
        const footnoteItem = section.querySelector('#fn-generated-n');
        const backlink = section.querySelector('.footnote-backref');
        const handler = jest.fn();
        backlink?.addEventListener('click', handler);
        const context = createContext(section, footnoteSource);
        context.app = {} as ReadingModeContext['app'];
        context.config.enableListsWithoutPrecedingBlankline = extensionEnabled;

        new NativeListSpacingProcessor().process(context);
        await waitForAsyncRendering();

        backlink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(section.querySelectorAll(':scope > .el-ul, :scope > ul')).toHaveLength(0);
        expect(section.querySelectorAll('#fn-generated-n > ul')).toHaveLength(expectedBodyLists);
        expect(section.querySelector('.footnotes > ol')).toBe(footnoteIndex);
        expect(section.querySelector('#fn-generated-n')).toBe(footnoteItem);
        expect(section.querySelector('.footnote-backref')).toBe(backlink);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(footnoteItem?.textContent).toContain('CHILD');
        if (!extensionEnabled) {
            expect(footnoteItem?.querySelector('p')?.textContent).toContain('- CHILD');
        }
    });

    it('moves only the labeled footnote item and preserves a shared root-list tail', () => {
        const footnoteSource = [
            'Use[^n].',
            '',
            '[^n]: note',
            '- CHILD',
            '',
            '- OUTSIDE_MUST_STAY'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Use<sup><a data-footref="n" href="#fn-generated-n">[1]</a></sup>.</p>',
            '<div class="el-ul"><ul><li>CHILD</li><li>OUTSIDE_MUST_STAY</li></ul></div>',
            '<section class="footnotes"><ol><li id="fn-generated-n">',
            '<p>note<a class="footnote-backref" href="#fnref-generated-n">back</a></p>',
            '</li></ol></section>'
        ].join('');
        const rootList = section.querySelector(':scope > .el-ul > ul');
        const outsideItem = Array.from(section.querySelectorAll('li'))
            .find(item => item.textContent === 'OUTSIDE_MUST_STAY');
        const outsideHandler = jest.fn();
        outsideItem?.addEventListener('click', outsideHandler);
        const context = createContext(section, footnoteSource);
        context.config.enableListsWithoutPrecedingBlankline = true;

        new NativeListSpacingProcessor().process(context);

        outsideItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(section.querySelector('#fn-generated-n > ul > li')?.textContent).toBe('CHILD');
        expect(section.querySelector(':scope > .el-ul > ul')).toBe(rootList);
        expect(section.querySelector(':scope > .el-ul > ul > li')).toBe(outsideItem);
        expect(outsideHandler).toHaveBeenCalledTimes(1);
    });

    it('uses source labels when repeated list text belongs to different footnotes', () => {
        const footnoteSource = [
            'Use[^a], again[^a], and[^b].',
            '',
            '[^a]: first',
            '- SAME',
            '[^b]: second',
            '- SAME'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p><a data-footref="a" href="#fn-generated-a">[1]</a>',
            '<a data-footref="a" href="#fn-generated-a">[1]</a>',
            '<a data-footref="b" href="#fn-generated-b">[2]</a></p>',
            '<div class="el-ul"><ul><li>SAME</li></ul></div>',
            '<div class="el-ul"><ul><li>SAME</li></ul></div>',
            '<section class="footnotes"><ol>',
            '<li id="fn-generated-a"><p>first<a class="footnote-backref">back-a</a></p></li>',
            '<li id="fn-generated-b"><p>second<a class="footnote-backref">back-b</a></p></li>',
            '</ol></section>'
        ].join('');
        const firstFootnote = section.querySelector('#fn-generated-a');
        const secondFootnote = section.querySelector('#fn-generated-b');
        const context = createContext(section, footnoteSource);
        context.config.enableListsWithoutPrecedingBlankline = true;

        new NativeListSpacingProcessor().process(context);

        expect(section.querySelectorAll(':scope > .el-ul')).toHaveLength(0);
        expect(firstFootnote?.querySelector(':scope > ul > li')?.textContent).toBe('SAME');
        expect(secondFootnote?.querySelector(':scope > ul > li')?.textContent).toBe('SAME');
    });

    it('does nothing when lists_without_preceding_blankline is enabled', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph</p><ul><li>item</li></ul>';
        const context = createContext(section, 'Paragraph\n- item');
        context.config.enableListsWithoutPrecedingBlankline = true;

        const processor = new NativeListSpacingProcessor();
        if (processor.isEnabled(context)) {
            processor.process(context);
        }

        expect(section.querySelectorAll('ul')).toHaveLength(1);
        expect(section.querySelector('.pem-pandoc-invalid-native-list')).toBeNull();
    });
});

function createContext(section: HTMLElement, sourceText: string = source): ReadingModeContext {
    const postProcessorContext = {
        sourcePath: 'native-list-spacing.md',
        getSectionInfo: jest.fn(() => ({
            text: sourceText,
            lineStart: 0,
            lineEnd: sourceText.split('\n').length
        }))
    } as unknown as MarkdownPostProcessorContext;

    return {
        element: section,
        postProcessorContext,
        section,
        sectionInfo: postProcessorContext.getSectionInfo(section),
        sourcePath: 'native-list-spacing.md',
        config: {
            strictLineBreaks: false,
            enableListsWithoutPrecedingBlankline: false,
            enableReadableFencedDivSyntax: true
        },
        counters: {
            exampleCounter: 0,
            exampleMap: new Map(),
            exampleContent: new Map(),
            hashCounter: 0,
            placeholderContext: {} as ReadingModeContext['counters']['placeholderContext'],
            fencedDivLabels: new Map()
        },
        validationLines: sourceText.split('\n'),
        renderContext: {
            strictLineBreaks: false,
            getExampleNumber: () => undefined,
            getExampleContent: () => undefined
        }
    };
}

async function waitForAsyncRendering(): Promise<void> {
    await new Promise(resolve => window.setTimeout(resolve, 50));
}

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt++) {
        if (predicate()) {
            return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for asynchronous native-list processing');
}
