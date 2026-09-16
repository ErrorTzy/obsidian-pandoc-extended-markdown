import { MarkdownPostProcessorContext, MarkdownRenderer } from 'obsidian';

import { processReadingMode } from '../../../src/reading-mode/processor';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { normalizeExistingDefinitionLists } from '../../../src/reading-mode/features/definition-lists/normalizer';
import { renderDefinitionBlockWithHost } from '../../../src/reading-mode/features/definition-lists/hostRenderer';
import { findPandocDefinitionListBlocks } from '../../../src/reading-mode/features/definition-lists/sourceParser';
import { renderPandocDefinitionListBlock } from '../../../src/reading-mode/features/definition-lists/sourceRenderer';
import { createReadingModeContext } from '../../../src/reading-mode/pipeline/registry';

describe('definition list reading mode rendering', () => {
    const docPath = 'definition-list-test.md';
    let config: ProcessorConfig;

    const createContext = (text: string): MarkdownPostProcessorContext => ({
        sourcePath: docPath,
        docId: 'test',
        frontmatter: null,
        addChild: jest.fn(),
        getSectionInfo: jest.fn(() => ({
            text,
            lineStart: 0,
            lineEnd: text.split('\n').length - 1
        }))
    } as unknown as MarkdownPostProcessorContext);

    const directChildren = (element: HTMLElement, tagName: string): HTMLElement[] =>
        Array.from(element.children)
            .filter(child => child.tagName === tagName)
            .map(child => child as HTMLElement);

    const countOccurrences = (text: string, search: string): number =>
        text.split(search).length - 1;

    const createApp = (source: string) => ({
        workspace: {
            getActiveFile: jest.fn(() => ({ path: docPath }))
        },
        vault: {
            cachedRead: jest.fn(async () => source)
        }
    });

    const waitForAsyncReconciliation = async (): Promise<void> => {
        for (let index = 0; index < 8; index++) {
            await Promise.resolve();
        }
        await new Promise(resolve => window.setTimeout(resolve, 0));
    };

    beforeEach(() => {
        pluginStateManager.resetDocumentCounters(docPath);
        config = {
            strictLineBreaks: false,
            enableListsWithoutPrecedingBlankline: true,
            enableDefinitionLists: true,
            enableFencedDivs: false,
            enableSuperSubscripts: false,
            enableUnorderedListMarkerStyles: false
        };
    });

    afterEach(() => {
        pluginStateManager.clearAllStates();
        jest.useRealTimers();
    });

    it('renders each same-term definition line as its own dd', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br>: details2<br>: details3</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n: details2\n: details3'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const terms = directChildren(list, 'DT');
        const definitions = directChildren(list, 'DD');

        expect(terms.map(term => term.textContent)).toEqual(['Description Term']);
        expect(definitions.map(def => def.textContent)).toEqual(['details1', 'details2', 'details3']);
        expect(definitions[0].textContent).toBe('details1');
    });

    it.each([false, true])(
        'renders recursively nested definition descriptions with Pandoc topology, extension=%s',
        extensionEnabled => {
            const source = 'Term\n: one\n  : two\n    : three';
            const block = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: extensionEnabled
            })[0];
            const list = renderPandocDefinitionListBlock(
                block,
                { strictLineBreaks: false },
                (target, content) => target.append(content)
            );

            expect(directChildren(list, 'DD')).toHaveLength(1);
            expect(list.querySelector(':scope > dt')?.textContent).toBe('Term');
            expect(list.querySelector(':scope > dd > dl > dt')?.textContent).toBe('one');
            expect(list.querySelector(':scope > dd > dl > dd > dl > dt')?.textContent)
                .toBe('two');
            expect(list.querySelector(':scope > dd > dl > dd > dl > dd')?.textContent)
                .toBe('three');
        }
    );

    it.each([false, true])(
        'retains a same-depth block quote around a standalone definition list, extension=%s',
        extensionEnabled => {
            const source = '> Term\n> : def';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="el-blockquote"><blockquote>',
                '<p>Term<br>: def</p>',
                '</blockquote><button>DO_NOT_CONSUME</button></div>'
            ].join('');
            const quoteWrapper = section.querySelector('.el-blockquote');
            const quote = section.querySelector('blockquote');
            const sentinel = section.querySelector('button');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
            expect(section.querySelector('blockquote')).toBe(quote);
            expect(section.querySelector('blockquote > dl.pem-definition-list dt')?.textContent)
                .toBe('Term');
            expect(section.querySelector('blockquote > dl.pem-definition-list dd')?.textContent)
                .toBe('def');
            expect(section.querySelector('button')).toBe(sentinel);
            expect(section.textContent).toContain('DO_NOT_CONSUME');
        }
    );

    it.each([false, true])(
        'retains every quote ancestor around a nested standalone definition list, extension=%s',
        extensionEnabled => {
            const source = '> > Term\n> > : def';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="el-blockquote"><blockquote><blockquote>',
                '<p>Term<br>: def</p>',
                '</blockquote></blockquote><button>DO_NOT_CONSUME</button></div>'
            ].join('');
            const quoteWrapper = section.querySelector('.el-blockquote');
            const quotes = Array.from(section.querySelectorAll('blockquote'));
            const sentinel = section.querySelector('button');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
            expect(Array.from(section.querySelectorAll('blockquote'))).toEqual(quotes);
            expect(section.querySelector('blockquote > blockquote > dl.pem-definition-list dt')?.textContent)
                .toBe('Term');
            expect(section.querySelector('blockquote > blockquote > dl.pem-definition-list dd')?.textContent)
                .toBe('def');
            expect(section.querySelector('button')).toBe(sentinel);
            expect(section.textContent).toContain('DO_NOT_CONSUME');
        }
    );

    it.each([false, true])(
        'keeps duplicate definitions in separate quote containers, extension=%s',
        extensionEnabled => {
            const source = '> Term\n> : def\n\nmiddle\n\n> Term\n> : def';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="first-quote"><blockquote><p>Term<br>: def</p></blockquote></div>',
                '<div class="middle"><p>middle</p></div>',
                '<div class="second-quote"><blockquote><p>Term<br>: def</p></blockquote></div>'
            ].join('');
            const quotes = Array.from(section.querySelectorAll('blockquote'));
            const middle = section.querySelector('.middle');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            expect(Array.from(section.querySelectorAll('blockquote'))).toEqual(quotes);
            expect(section.querySelector('.middle')).toBe(middle);
            expect(section.querySelectorAll('blockquote > dl.pem-definition-list')).toHaveLength(2);
            expect(section.querySelectorAll('blockquote > dl.pem-definition-list dt'))
                .toHaveLength(2);
            expect(countOccurrences(section.textContent ?? '', 'Term')).toBe(2);
            expect(countOccurrences(section.textContent ?? '', 'def')).toBe(2);
            expect(section.textContent).toContain('middle');
        }
    );

    it('does not let an invalid native-list candidate steal a quoted definition', () => {
        const source = 'Paragraph\n- Term\n  : def\n\n> Term\n> : def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="paragraph"><p>Paragraph</p></div>',
            '<div class="native"><ul><li>Term<br>: def</li></ul></div>',
            '<div class="quoted"><blockquote><p>Term<br>: def</p></blockquote></div>'
        ].join('');
        const nativeItem = section.querySelector('.native li');
        const quote = section.querySelector('blockquote');
        config.enableListsWithoutPrecedingBlankline = false;

        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.native li')).toBe(nativeItem);
        expect(nativeItem?.querySelector('dl.pem-definition-list')).toBeNull();
        expect(nativeItem?.textContent).toContain(': def');
        expect(section.querySelector('blockquote')).toBe(quote);
        expect(quote?.querySelector(':scope > dl.pem-definition-list dt')?.textContent)
            .toBe('Term');
        expect(quote?.querySelector(':scope > dl.pem-definition-list dd')?.textContent)
            .toBe('def');
    });

    it.each([false, true])(
        'preserves inline code and a child list when normalizing a native definition, extension=%s',
        async extensionEnabled => {
            const source = '- `Term`\n  : `def`\n  - CHILD';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="native"><ul><li class="native-item" data-line="0">',
                '<code>Term</code><br><span>: </span><code>def</code>',
                '<ul class="child-list"><li class="child">CHILD</li></ul>',
                '</li></ul></div>'
            ].join('');
            const item = section.querySelector('.native-item');
            const childList = section.querySelector('.child-list');
            const child = section.querySelector('.child');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            processReadingMode(
                section,
                createContext(source),
                config,
                createApp(source) as any
            );
            await waitForAsyncReconciliation();

            const definition = item?.querySelector(':scope > dl.pem-definition-list');
            expect(section.querySelector('.native-item')).toBe(item);
            expect(item?.querySelector(':scope > ul.child-list')).toBe(childList);
            expect(childList?.querySelector(':scope > li')).toBe(child);
            expect(definition?.nextElementSibling).toBe(childList);
            expect(definition?.querySelector('dt > code')?.textContent).toBe('Term');
            expect(definition?.querySelector('dd > code')?.textContent).toBe('def');
            expect(countOccurrences(section.textContent ?? '', 'CHILD')).toBe(1);
        }
    );

    it.each([false, true])(
        'preserves inline code in a quoted definition, extension=%s',
        async extensionEnabled => {
            const source = '> `Term`\n> : `def`';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="quoted"><blockquote>',
                '<p><code>Term</code><br><span>: </span><code>def</code></p>',
                '</blockquote></div>'
            ].join('');
            const quote = section.querySelector('blockquote');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            processReadingMode(
                section,
                createContext(source),
                config,
                createApp(source) as any
            );
            await waitForAsyncReconciliation();

            expect(section.querySelector('blockquote')).toBe(quote);
            expect(quote?.querySelector(':scope > dl.pem-definition-list dt > code')?.textContent)
                .toBe('Term');
            expect(quote?.querySelector(':scope > dl.pem-definition-list dd > code')?.textContent)
                .toBe('def');
        }
    );

    it('delegates a complete mixed-block definition body to the host renderer', async () => {
        const source = 'Term\n: one\n    - CHILD';
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown === 'Term') {
                target.innerHTML = '<p>Term</p>';
                return;
            }
            if (markdown === '- one\n    - CHILD') {
                target.innerHTML = '<ul><li>one<ul><li>CHILD</li></ul></li></ul>';
                return;
            }
            await originalRender?.(...args);
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const definition = list?.querySelector('dd');
        expect(Array.from(definition?.children ?? []).map(child => child.tagName))
            .toEqual(['UL']);
        expect(Array.from(definition?.childNodes ?? [])[0]?.textContent).toBe('one');
        expect(definition?.querySelector(':scope > ul > li')?.textContent).toBe('CHILD');
        expect(definition?.textContent).toBe('oneCHILD');
    });

    it('preserves nested definition topology while host-rendering leaf fragments', async () => {
        const source = 'Term\n: one\n  : two';
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown.startsWith('- ')) {
                target.innerHTML = `<ul><li>${markdown.slice(2)}</li></ul>`;
                return;
            }
            target.innerHTML = `<p>${markdown}</p>`;
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        expect(directChildren(list as HTMLElement, 'DD')).toHaveLength(1);
        expect(list?.querySelector(':scope > dt')?.textContent).toBe('Term');
        expect(list?.querySelector(':scope > dd > dl > dt')?.textContent).toBe('one');
        expect(list?.querySelector(':scope > dd > dl > dd')?.textContent).toBe('two');
    });

    it('host-renders a definition nested in a description-body list with Pandoc topology', async () => {
        const source = [
            'Description Term',
            ': details1',
            ': details2',
            ': details3',
            ': - bullet',
            '    : indented'
        ].join('\n');
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown.startsWith('- ')) {
                target.innerHTML = `<ul><li>${markdown.slice(2)}</li></ul>`;
                return;
            }
            target.innerHTML = `<p>${markdown}</p>`;
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const descriptions = directChildren(list as HTMLElement, 'DD');
        const nested = descriptions[3]?.querySelector(':scope > ul > li > dl');
        expect(descriptions).toHaveLength(4);
        expect(nested?.querySelector(':scope > dt')?.textContent).toBe('bullet');
        expect(nested?.querySelector(':scope > dd')?.textContent).toBe('indented');
        expect(descriptions[3]?.textContent).toBe('bulletindented');
        expect(descriptions[3]?.querySelector('br')).toBeNull();
    });

    it('turns definition soft line breaks into spaces while retaining inline rendering', async () => {
        const source = [
            'Term',
            ': first line',
            '  continuation line',
            ': second',
            '  continuation'
        ].join('\n');
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown === '-\n first line\n continuation line') {
                target.innerHTML = '<ul><li>first line<br>continuation line</li></ul>';
                return;
            }
            if (markdown === '-\n second\n continuation') {
                target.innerHTML = '<ul><li>second<br>continuation</li></ul>';
                return;
            }
            if (markdown.startsWith('- ')) {
                const body = markdown.slice(2).replace(/\n {2}/g, '<br>');
                target.innerHTML = `<ul><li>${body}</li></ul>`;
                return;
            }
            target.innerHTML = `<p>${markdown}</p>`;
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const descriptions = directChildren(list as HTMLElement, 'DD');
        expect(descriptions.map(description => description.textContent)).toEqual([
            'first line continuation line',
            'second continuation'
        ]);
        expect(list?.querySelector('dd br')).toBeNull();
    });

    it('keeps explicit Markdown line breaks while removing host-only soft breaks', async () => {
        const source = [
            'Term',
            ': first  ',
            '  second',
            ': third\\',
            '  fourth'
        ].join('\n');
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown.startsWith('- ')) {
                const body = markdown.slice(2).replace(/\n {2}/g, '<br>');
                target.innerHTML = `<ul><li>${body}</li></ul>`;
                return;
            }
            target.innerHTML = `<p>${markdown}</p>`;
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const descriptions = directChildren(list as HTMLElement, 'DD');
        expect(descriptions.map(description => description.querySelectorAll('br').length))
            .toEqual([1, 1]);
        expect(descriptions.map(description => description.textContent)).toEqual([
            'firstsecond',
            'thirdfourth'
        ]);
    });

    it('normalizes host-rendered ordered and task lists to Pandoc HTML structure', async () => {
        const source = [
            'Term',
            ': 1. ordered',
            ': - [x] checked',
            ': - [ ] unchecked'
        ].join('\n');
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown === 'Term') {
                target.innerHTML = '<p>Term</p>';
                return;
            }
            if (markdown === '- 1. ordered') {
                target.innerHTML = '<ul><li><ol><li>ordered</li></ol></li></ul>';
                return;
            }
            if (markdown === '- - [x] checked') {
                target.innerHTML = [
                    '<ul><li><ul class="contains-task-list">',
                    '<li class="task-list-item"><input type="checkbox" checked> checked</li>',
                    '</ul></li></ul>'
                ].join('');
                return;
            }
            if (markdown === '- - [ ] unchecked') {
                target.innerHTML = [
                    '<ul><li><ul class="contains-task-list">',
                    '<li class="task-list-item"><input type="checkbox"> unchecked</li>',
                    '</ul></li></ul>'
                ].join('');
                return;
            }
            target.innerHTML = `<p>${markdown}</p>`;
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const descriptions = directChildren(list as HTMLElement, 'DD');
        expect(descriptions[0].querySelector('ol')?.getAttribute('type')).toBe('1');
        for (const description of descriptions.slice(1)) {
            const taskList = description.querySelector('ul');
            expect(taskList?.classList.contains('task-list')).toBe(true);
            expect(taskList?.querySelector(':scope > li > label > input[type="checkbox"]'))
                .not.toBeNull();
        }
        expect(descriptions[1].querySelector('input')?.hasAttribute('checked')).toBe(true);
        expect(descriptions[2].querySelector('input')?.hasAttribute('checked')).toBe(false);
    });

    it('host-renders excess definition-marker padding as code with a literal continuation', async () => {
        const source = 'Term\n:     one\n  : two';
        const block = findPandocDefinitionListBlocks(source)[0];
        const section = document.createElement('div');
        const context = createReadingModeContext(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        context.fullSource = source;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown === 'Term') {
                target.innerHTML = '<p>Term</p>';
                return;
            }
            if (markdown === '-     one\n  : two') {
                target.innerHTML = '<ul><li><pre><code>one</code></pre>\n: two</li></ul>';
                return;
            }
            await originalRender?.(...args);
        });

        let list: HTMLElement | null = null;
        try {
            list = await renderDefinitionBlockWithHost(block, context);
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const definition = list?.querySelector('dd');
        expect(definition?.querySelector(':scope > pre > code')?.textContent).toBe('one');
        expect(definition?.textContent?.replace(/\s+/g, ' ').trim()).toBe('one : two');
        expect(definition?.querySelector('dl.pem-definition-list')).toBeNull();
    });

    it('does not normalize a fenced div opener as a definition term', () => {
        jest.useFakeTimers();
        config.enableFencedDivs = true;
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>::: title</p></div>
            <div class="el-p"><p>: text</p></div>
            <div class="el-p"><p>:::</p></div>
        `;

        processReadingMode(
            section,
            createContext('::: title\n: text\n:::'),
            config
        );
        jest.runOnlyPendingTimers();

        expect(section.querySelector('dl.pem-definition-list')).toBeNull();
        expect(section.textContent).toContain(': text');
        expect(section.textContent).not.toContain('• text');
    });

    it.each([
        [false, true],
        [true, false]
    ])(
        'matches Pandoc lazy block-quote definition placement when the list extension is %s',
        (extensionEnabled, expectsDefinitionList) => {
            const source = '> Term\n: def';
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="el-blockquote"><blockquote><p>Term</p></blockquote></div>',
                '<div class="el-p"><p>: def</p></div>'
            ].join('');
            config.enableListsWithoutPrecedingBlankline = extensionEnabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            const quote = section.querySelector('blockquote');
            const list = quote?.querySelector('dl.pem-definition-list');
            expect(Boolean(list)).toBe(expectsDefinitionList);
            if (expectsDefinitionList) {
                expect(list?.querySelector('dt')?.textContent).toBe('Term');
                expect(list?.querySelector('dd')?.textContent).toBe('def');
                expect(section.querySelector(':scope > .el-p')).toBeNull();
            } else {
                expect(quote?.querySelector('p')?.textContent).toBe('Term');
                expect(section.querySelector(':scope > .el-p > p')?.textContent).toBe(': def');
            }
        }
    );

    it('restores the source-owned quote and marker nodes when the extension is toggled on', () => {
        const source = '> Term\n: def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote><p>Term</p></blockquote></div>',
            '<div class="el-p"><p>: def</p></div>'
        ].join('');
        const term = section.querySelector('blockquote > p');
        const markerBlock = section.querySelector(':scope > .el-p');
        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );
        expect(section.querySelector('blockquote > dl.pem-definition-list')).not.toBeNull();

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('blockquote > p')).toBe(term);
        expect(section.querySelector(':scope > .el-p')).toBe(markerBlock);
        expect(section.querySelector('dl.pem-definition-list')).toBeNull();
    });

    it('preserves inline node identities while toggling Obsidian\'s combined lazy quote paragraph', () => {
        const source = '> Term\n: def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<p><strong>Term</strong><br>\n: <em>def</em></p>',
            '</blockquote></div>'
        ].join('');
        const termParagraph = section.querySelector('blockquote > p');
        const strong = section.querySelector('strong');
        const emphasis = section.querySelector('em');

        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );
        expect(section.querySelector('blockquote > dl.pem-definition-list')).not.toBeNull();

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('blockquote > p')).toBe(termParagraph);
        expect(section.querySelector('blockquote > p > strong')).toBe(strong);
        expect(section.querySelector(':scope > .el-p > p > em')).toBe(emphasis);
        expect(section.querySelector(':scope > .el-p > p')?.textContent?.trim()).toBe(': def');
        expect(countOccurrences(section.textContent ?? '', 'Term')).toBe(1);
        expect(countOccurrences(section.textContent ?? '', 'def')).toBe(1);
    });

    it('restores an inactive lazy quote definition when ordinary definition blocks remain active', () => {
        const source = '> Quote Term\n: quote def\n\nOrdinary Term\n: ordinary def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote><p>Quote Term</p></blockquote></div>',
            '<div class="el-p source-marker"><p>: quote def</p></div>',
            '<div class="el-p ordinary"><p>Ordinary Term<br>: ordinary def</p></div>'
        ].join('');
        const quoteTerm = section.querySelector('blockquote > p');
        const quoteMarker = section.querySelector('.source-marker');

        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );
        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(2);

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('blockquote > p')).toBe(quoteTerm);
        expect(section.querySelector('.source-marker')).toBe(quoteMarker);
        expect(section.querySelector('.ordinary dl.pem-definition-list')).not.toBeNull();
        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
    });

    it('preserves an unrelated duplicate term while joining and restoring a lazy quote definition', () => {
        const source = 'Term\n\n> Term\n: def\n\nTail';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-p unrelated-term"><p>Term</p></div>',
            '<div class="el-blockquote"><blockquote><p>Term</p></blockquote></div>',
            '<div class="el-p source-marker"><p>: def</p></div>',
            '<div class="el-p tail"><p>Tail</p></div>'
        ].join('');
        const unrelatedBlock = section.querySelector('.unrelated-term') as HTMLElement;
        const unrelatedParagraph = unrelatedBlock.querySelector('p');
        const quoteWrapper = section.querySelector('.el-blockquote');
        const quoteTerm = section.querySelector('blockquote > p');
        const markerBlock = section.querySelector('.source-marker') as HTMLElement;
        const markerParagraph = markerBlock.querySelector('p');
        const tailBlock = section.querySelector('.tail');

        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.unrelated-term')).toBe(unrelatedBlock);
        expect(unrelatedBlock.querySelector('p')).toBe(unrelatedParagraph);
        expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
        expect(section.querySelector('blockquote > dl.pem-definition-list dt')?.textContent).toBe('Term');
        expect(section.querySelector('blockquote > dl.pem-definition-list dd')?.textContent).toBe('def');
        expect(section.querySelector('.source-marker')).toBeNull();
        expect(section.querySelector('.tail')).toBe(tailBlock);
        expect(countOccurrences(section.textContent ?? '', 'Term')).toBe(2);

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.unrelated-term')).toBe(unrelatedBlock);
        expect(unrelatedBlock.querySelector('p')).toBe(unrelatedParagraph);
        expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
        expect(section.querySelector('blockquote > p')).toBe(quoteTerm);
        expect(section.querySelector('.source-marker')).toBe(markerBlock);
        expect(markerBlock.querySelector('p')).toBe(markerParagraph);
        expect(section.querySelector('.tail')).toBe(tailBlock);
        expect(Array.from(section.children)).toEqual([
            unrelatedBlock,
            quoteWrapper,
            markerBlock,
            tailBlock
        ]);
    });

    it('preserves an unrelated duplicate marker while joining and restoring a lazy quote definition', () => {
        const source = ': def\n\n> Term\n: def\n\nTail';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-p unrelated-marker"><p>: def</p></div>',
            '<div class="el-blockquote"><blockquote><p>Term</p></blockquote></div>',
            '<div class="el-p source-marker"><p>: def</p></div>',
            '<div class="el-p tail"><p>Tail</p></div>'
        ].join('');
        const unrelatedBlock = section.querySelector('.unrelated-marker') as HTMLElement;
        const unrelatedParagraph = unrelatedBlock.querySelector('p');
        const quoteWrapper = section.querySelector('.el-blockquote');
        const quoteTerm = section.querySelector('blockquote > p');
        const markerBlock = section.querySelector('.source-marker') as HTMLElement;
        const markerParagraph = markerBlock.querySelector('p');
        const tailBlock = section.querySelector('.tail');

        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.unrelated-marker')).toBe(unrelatedBlock);
        expect(unrelatedBlock.querySelector('p')).toBe(unrelatedParagraph);
        expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
        expect(section.querySelector('blockquote > dl.pem-definition-list dt')?.textContent).toBe('Term');
        expect(section.querySelector('blockquote > dl.pem-definition-list dd')?.textContent).toBe('def');
        expect(section.querySelector('.source-marker')).toBeNull();
        expect(section.querySelector('.tail')).toBe(tailBlock);

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.unrelated-marker')).toBe(unrelatedBlock);
        expect(unrelatedBlock.querySelector('p')).toBe(unrelatedParagraph);
        expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
        expect(section.querySelector('blockquote > p')).toBe(quoteTerm);
        expect(section.querySelector('.source-marker')).toBe(markerBlock);
        expect(markerBlock.querySelector('p')).toBe(markerParagraph);
        expect(section.querySelector('.tail')).toBe(tailBlock);
        expect(Array.from(section.children)).toEqual([
            unrelatedBlock,
            quoteWrapper,
            markerBlock,
            tailBlock
        ]);
    });

    it('does not consume an intervening rendered paragraph from a stale lazy quote fragment', () => {
        const source = '> Term\n: def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote><p>Term</p></blockquote></div>',
            '<div class="el-p unrelated"><p>DO_NOT_CONSUME</p></div>',
            '<div class="el-p source-marker"><p>: def</p></div>'
        ].join('');
        const quoteWrapper = section.querySelector('.el-blockquote');
        const quoteTerm = section.querySelector('blockquote > p');
        const unrelatedBlock = section.querySelector('.unrelated');
        const unrelatedParagraph = unrelatedBlock?.querySelector('p');
        const markerBlock = section.querySelector('.source-marker');
        const markerParagraph = markerBlock?.querySelector('p');

        config.enableListsWithoutPrecedingBlankline = false;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('dl.pem-definition-list')).toBeNull();
        expect(section.querySelector('.el-blockquote')).toBe(quoteWrapper);
        expect(section.querySelector('blockquote > p')).toBe(quoteTerm);
        expect(section.querySelector('.unrelated')).toBe(unrelatedBlock);
        expect(unrelatedBlock?.querySelector('p')).toBe(unrelatedParagraph);
        expect(section.querySelector('.source-marker')).toBe(markerBlock);
        expect(markerBlock?.querySelector('p')).toBe(markerParagraph);
        expect(section.textContent).toContain('DO_NOT_CONSUME');
    });

    it('recovers a nested canonical lazy list after reload without replacing inline or softbreak nodes', () => {
        const source = [
            '> > *Term*',
            '> : **first**',
            '>   continued',
            '> : `second`'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<blockquote><dl class="pem-definition-list pem-lazy-container-definition">',
            '<dt><em>Term</em></dt>',
            '<dd><p><strong>first</strong><br><span>continued</span></p></dd>',
            '<dd><code>second</code></dd>',
            '</dl></blockquote>',
            '</blockquote></div>',
            '<div class="el-p tail"><p>Tail</p></div>'
        ].join('');
        const list = section.querySelector('dl');
        const emphasis = section.querySelector('dt > em');
        const strong = section.querySelector('dd strong');
        const softbreak = section.querySelector('dd br');
        const continuation = section.querySelector('dd span');
        const code = section.querySelector('dd code');
        const tail = section.querySelector('.tail');

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        const outerQuote = section.querySelector('.el-blockquote > blockquote') as HTMLElement;
        const term = outerQuote.querySelector(':scope > blockquote > p');
        const markerParagraphs = directChildren(outerQuote, 'P');
        expect(section.querySelector('dl')).toBeNull();
        expect(list?.isConnected).toBe(false);
        expect(term?.querySelector('em')).toBe(emphasis);
        expect(markerParagraphs).toHaveLength(2);
        expect(markerParagraphs[0].textContent).toBe(': firstcontinued');
        expect(markerParagraphs[0].querySelector('strong')).toBe(strong);
        expect(markerParagraphs[0].querySelector('br')).toBe(softbreak);
        expect(markerParagraphs[0].querySelector('span')).toBe(continuation);
        expect(markerParagraphs[1].textContent).toBe(': second');
        expect(markerParagraphs[1].querySelector('code')).toBe(code);
        expect(section.querySelector('.tail')).toBe(tail);
    });

    it('rebuilds cold block definition content as source-derived literal inline content', () => {
        const source = '> Term\n: - **child**';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<dl class="pem-definition-list pem-lazy-container-definition">',
            '<dt>Term</dt><dd><ul><li><strong>child</strong></li></ul></dd>',
            '</dl></blockquote></div>',
            '<div class="el-p tail"><p>Tail</p></div>'
        ].join('');
        const list = section.querySelector('dl');
        const child = section.querySelector('dd li > strong');
        const tail = section.querySelector('.tail');

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('dl')).toBeNull();
        expect(list?.isConnected).toBe(false);
        expect(section.querySelector('blockquote > p')?.textContent).toBe('Term');
        expect(section.querySelector(':scope > .el-p:not(.tail) > p')?.textContent)
            .toBe(': - child');
        expect(section.querySelector(':scope > .el-p:not(.tail) strong')?.textContent)
            .toBe(child?.textContent);
        expect(section.querySelector('p > ul')).toBeNull();
        expect(section.querySelector('.tail')).toBe(tail);
    });

    it('does not consume siblings owned by a cold canonical lazy-list wrapper', () => {
        const source = '> Term\n: def';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<div class="el-p canonical-owner">',
            '<dl class="pem-definition-list"><dt>Term</dt><dd>def</dd></dl>',
            '<button>DO_NOT_CONSUME</button>',
            '</div></blockquote></div>'
        ].join('');
        const owner = section.querySelector('.canonical-owner');
        const list = section.querySelector('dl');
        const button = section.querySelector('button');

        config.enableListsWithoutPrecedingBlankline = true;
        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('.canonical-owner')).toBe(owner);
        expect(section.querySelector('dl')).toBeNull();
        expect(list?.isConnected).toBe(false);
        expect(owner?.querySelector('p')?.textContent).toBe('Term');
        expect(section.querySelector('button')).toBe(button);
        expect(section.querySelector(':scope > .el-p > p')?.textContent).toBe(': def');
        expect(section.textContent).toContain('DO_NOT_CONSUME');
    });

    it('uses host inline semantics when demoting a cold lazy definition list', async () => {
        const source = [
            '> [Term](https://example.test)',
            ': \\*literal\\* and **outer *inner***'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<dl class="pem-definition-list pem-lazy-container-definition">',
            '<dt><a href="https://example.test">Term</a></dt>',
            '<dd>*literal* and <strong>outer <em>inner</em></strong></dd>',
            '</dl></blockquote></div>',
            '<div class="el-p tail"><p>DO_NOT_CONSUME</p></div>'
        ].join('');
        const link = section.querySelector('dt > a');
        const strong = section.querySelector('dd > strong');
        const emphasis = section.querySelector('dd em');
        const tail = section.querySelector('.tail');
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const originalRender = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (...args: unknown[]) => {
            const markdown = args[1] as string;
            const target = args[2] as HTMLElement;
            if (markdown === '[Term](https://example.test)') {
                target.innerHTML = '<p><a href="https://example.test">Term</a></p>';
                return;
            }
            if (markdown === '\\*literal\\* and **outer *inner***') {
                target.innerHTML = '<p>*literal* and <strong>outer <em>inner</em></strong></p>';
                return;
            }
            await originalRender?.(...args);
        });

        try {
            config.enableListsWithoutPrecedingBlankline = true;
            processReadingMode(
                section,
                createContext(source),
                config,
                createApp(source) as any
            );
            await waitForAsyncReconciliation();
        } finally {
            renderMock.mockImplementation(originalRender);
        }

        const term = section.querySelector('blockquote > p');
        const marker = section.querySelector(':scope > .el-p:not(.tail) > p');
        expect(section.querySelector('dl.pem-definition-list')).toBeNull();
        expect(term?.querySelector('a')).toBe(link);
        expect(marker?.textContent).toBe(': *literal* and outer inner');
        expect(marker?.querySelector('strong')).toBe(strong);
        expect(marker?.querySelector('em')).toBe(emphasis);
        expect(section.querySelector('.tail')).toBe(tail);
        expect(section.textContent).toContain('DO_NOT_CONSUME');
    });

    it('converges a cold consecutive-marker topology change in one reconciliation', async () => {
        const source = '> Term\n: one\n: two';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-blockquote"><blockquote>',
            '<dl class="pem-definition-list pem-lazy-container-definition">',
            '<dt>Term</dt><dd>one</dd><dd>two</dd>',
            '</dl></blockquote></div>'
        ].join('');

        config.enableListsWithoutPrecedingBlankline = true;
        processReadingMode(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        await waitForAsyncReconciliation();

        expect(section.querySelector('blockquote > p')?.textContent).toBe('Term');
        const list = section.querySelector(':scope > .el-p > dl.pem-definition-list');
        expect(list?.querySelector('dt')?.textContent).toBe(': one');
        expect(list?.querySelector('dd')?.textContent).toBe('two');
        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
        expect(section.querySelectorAll(':scope > .el-p')).toHaveLength(1);
    });

    it('keeps blank-line-separated terms in one definition list', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br><br>Another Term<br>: another detail1</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n\nAnother Term\n: another detail1'),
            config
        );

        const lists = element.querySelectorAll('dl.pem-definition-list');
        const list = lists[0] as HTMLElement;

        expect(lists).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term', 'Another Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'another detail1']);
    });

    it('renders nested list content inside a definition description', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br>: - bullet<br>    : indented</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n: - bullet\n    : indented'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');
        const nestedList = definitions[1].querySelector('ul > li > dl') as HTMLElement;

        expect(definitions).toHaveLength(2);
        expect(definitions[0].textContent).toBe('details1');
        expect(nestedList.querySelector('dt')?.textContent).toBe('bullet');
        expect(nestedList.querySelector('dd')?.textContent).toBe('indented');
    });

    it.each([
        { marker: '- ', indent: '  ', tag: 'ul', start: null },
        { marker: '1. ', indent: '   ', tag: 'ol', start: '1' },
        { marker: '100. ', indent: '     ', tag: 'ol', start: '100' }
    ])(
        'normalizes a definition nested under $marker without replacing its native list item',
        ({ marker, indent, tag, start }) => {
            const source = [
                `${marker}Native Term`,
                `${indent}: native definition`,
                '',
                'Root Term',
                ': root definition',
                '',
                'Trailing paragraph'
            ].join('\n');
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            const startAttribute = start ? ` start="${start}"` : '';
            section.innerHTML = [
                `<div class="el-list"><${tag}${startAttribute}>`,
                '<li class="native-item">Native Term<br>: native definition</li>',
                `</${tag}></div>`,
                '<div class="el-p root-definition"><p>Root Term<br>: root definition</p></div>',
                '<div class="el-p trailing"><p>Trailing paragraph</p></div>'
            ].join('');
            const list = section.querySelector(tag) as HTMLElement;
            const item = section.querySelector('.native-item') as HTMLElement;
            const trailing = section.querySelector('.trailing') as HTMLElement;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            const nestedDefinition = item.querySelector(':scope > dl.pem-definition-list');
            const rootDefinition = section.querySelector(
                ':scope > .root-definition > dl.pem-definition-list'
            );
            expect(section.querySelector(tag)).toBe(list);
            expect(list.querySelector(':scope > li')).toBe(item);
            expect(nestedDefinition?.querySelector('dt')?.textContent).toBe('Native Term');
            expect(nestedDefinition?.querySelector('dd')?.textContent).toBe('native definition');
            expect(rootDefinition?.querySelector('dt')?.textContent).toBe('Root Term');
            expect(rootDefinition?.querySelector('dd')?.textContent).toBe('root definition');
            expect(section.querySelector('.trailing')).toBe(trailing);
            expect(trailing.textContent).toBe('Trailing paragraph');

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );
            expect(item.querySelector(':scope > dl.pem-definition-list'))
                .toBe(nestedDefinition);
            expect(section.querySelector(tag)).toBe(list);
            expect(list.querySelector(':scope > li')).toBe(item);
        }
    );

    it('normalizes the bullet-marker DOM Obsidian emits below a wide decimal item', () => {
        const source = [
            '100. Native Term',
            '     : native definition',
            '101. Native tail',
            '',
            'Trailing paragraph'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-ol"><ol start="100">',
            '<li class="native-item">Native Term<br>\n',
            '<span>• </span>native definition</li>',
            '<li class="native-tail">Native tail</li>',
            '</ol></div>',
            '<div class="el-p trailing"><p>Trailing paragraph</p></div>'
        ].join('');
        const list = section.querySelector('ol');
        const item = section.querySelector('.native-item');
        const tail = section.querySelector('.native-tail');
        const trailing = section.querySelector('.trailing');

        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('ol')).toBe(list);
        expect(section.querySelector('.native-item')).toBe(item);
        expect(section.querySelector('.native-tail')).toBe(tail);
        expect(section.querySelector('.trailing')).toBe(trailing);
        expect(item?.querySelector(':scope > dl.pem-definition-list dt')?.textContent)
            .toBe('Native Term');
        expect(item?.querySelector(':scope > dl.pem-definition-list dd')?.textContent)
            .toBe('native definition');
    });

    it.each([false, true].flatMap(enabled => [
        { marker: '- ', indent: '  ', tag: 'ul', start: null, enabled },
        { marker: '1. ', indent: '   ', tag: 'ol', start: '1', enabled },
        { marker: '100. ', indent: '     ', tag: 'ol', start: '100', enabled }
    ]))(
        'inserts a native $marker definition before its nested list without consuming either list, extension=$enabled',
        ({ marker, indent, tag, start, enabled }) => {
            const source = [
                `${marker}Native Term`,
                `${indent}: native definition`,
                `${indent}- CHILD_MUST_STAY`,
                `${start === null ? '- ' : `${Number(start) + 1}. `}Native tail`
            ].join('\n');
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            const startAttribute = start ? ` start="${start}"` : '';
            section.innerHTML = [
                `<div class="el-list"><${tag}${startAttribute}>`,
                '<li class="native-item" data-line="0">',
                '<span class="term-node">Native Term</span><br>',
                '<span class="definition-node">: native definition</span>',
                '<ul class="nested-list"><li class="nested-child">',
                '<strong class="child-content">CHILD_MUST_STAY</strong>',
                '</li></ul></li>',
                '<li class="native-tail">Native tail</li>',
                `</${tag}></div>`
            ].join('');
            const outerList = section.querySelector(`:scope > .el-list > ${tag}`);
            const item = section.querySelector('.native-item');
            const nestedList = section.querySelector('.nested-list');
            const nestedChild = section.querySelector('.nested-child');
            const childContent = section.querySelector('.child-content');
            const tail = section.querySelector('.native-tail');
            config.enableListsWithoutPrecedingBlankline = enabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            const definition = item?.querySelector(':scope > dl.pem-definition-list');
            expect(section.querySelector(`:scope > .el-list > ${tag}`)).toBe(outerList);
            expect(outerList?.querySelector(':scope > li')).toBe(item);
            expect(item?.querySelector(':scope > ul.nested-list')).toBe(nestedList);
            expect(nestedList?.querySelector(':scope > li')).toBe(nestedChild);
            expect(nestedChild?.querySelector(':scope > strong')).toBe(childContent);
            expect(outerList?.querySelector(':scope > li.native-tail')).toBe(tail);
            expect(definition?.nextElementSibling).toBe(nestedList);
            expect(definition?.querySelector('dt')?.textContent).toBe('Native Term');
            expect(definition?.querySelector('dd')?.textContent).toBe('native definition');
            expect(countOccurrences(section.textContent ?? '', 'CHILD_MUST_STAY')).toBe(1);
            expect(countOccurrences(section.textContent ?? '', 'Native tail')).toBe(1);

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );
            expect(item?.querySelector(':scope > dl.pem-definition-list')).toBe(definition);
            expect(item?.querySelector(':scope > ul.nested-list')).toBe(nestedList);
            expect(nestedList?.querySelector(':scope > li')).toBe(nestedChild);
        }
    );

    it('uses the source line to select a native item without consuming a duplicate sibling', () => {
        const source = [
            '- Unrelated source item',
            '- Native Term',
            '  : native definition',
            '- Native tail'
        ].join('\n');
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<div class="el-ul"><ul>',
            '<li class="unrelated" data-line="0">Native Term<br>: native definition</li>',
            '<li class="native-item" data-line="1">Native Term<br>: native definition</li>',
            '<li class="native-tail" data-line="3">Native tail</li>',
            '</ul></div>'
        ].join('');
        const list = section.querySelector('ul');
        const unrelated = section.querySelector('.unrelated');
        const item = section.querySelector('.native-item');
        const tail = section.querySelector('.native-tail');

        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        expect(section.querySelector('ul')).toBe(list);
        expect(section.querySelector('.unrelated')).toBe(unrelated);
        expect(section.querySelector('.native-item')).toBe(item);
        expect(section.querySelector('.native-tail')).toBe(tail);
        expect(unrelated?.querySelector('dl')).toBeNull();
        expect(unrelated?.textContent).toContain(': native definition');
        expect(item?.querySelector(':scope > dl.pem-definition-list dt')?.textContent)
            .toBe('Native Term');
        expect(item?.querySelector(':scope > dl.pem-definition-list dd')?.textContent)
            .toBe('native definition');
    });

    it.each([
        { enabled: false, expectsDefinition: false },
        { enabled: true, expectsDefinition: true }
    ])(
        'does not outrun validation when the containing native list is mode-dependent, extension=$enabled',
        ({ enabled, expectsDefinition }) => {
            const source = [
                'Paragraph',
                '- Native Term',
                '  : native definition',
                '- Native tail'
            ].join('\n');
            const section = document.createElement('div');
            section.className = 'markdown-preview-section';
            section.innerHTML = [
                '<div class="el-p"><p>Paragraph</p></div>',
                '<div class="el-ul"><ul>',
                '<li class="native-item">Native Term<br>: native definition</li>',
                '<li class="native-tail">Native tail</li>',
                '</ul></div>'
            ].join('');
            const list = section.querySelector('ul');
            const item = section.querySelector('.native-item');
            const tail = section.querySelector('.native-tail');
            config.enableListsWithoutPrecedingBlankline = enabled;

            normalizeExistingDefinitionLists(
                section,
                createContext(source),
                config,
                { strictLineBreaks: false },
                source
            );

            const definition = section.querySelector('.native-item > dl.pem-definition-list');
            expect(Boolean(definition)).toBe(expectsDefinition);
            expect(section.querySelector('ul')).toBe(list);
            expect(section.querySelector('.native-item')).toBe(item);
            expect(section.querySelector('.native-tail')).toBe(tail);
            if (!expectsDefinition) {
                expect(item?.textContent).toContain(': native definition');
            }
        }
    );

    it('renders ordered and checked list descriptions as list content', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: 1. ordered<br>: - [x] checked</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: 1. ordered\n: - [x] checked'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');
        const checkbox = definitions[1].querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(definitions[0].querySelector('ol > li')?.textContent).toBe('ordered');
        expect(checkbox.checked).toBe(true);
        expect(checkbox.disabled).toBe(true);
        expect(definitions[1].querySelector('ul > li')?.textContent).toBe(' checked');
    });

    it('rebuilds standalone source-backed definition lists even when preview dropped math content', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        const source = [
            'Math Term',
            ': inline math $x^2 + y^2 = z^2$',
            ': $$\\int_0^1 x\\,dx$$'
        ].join('\n');
        section.innerHTML = `
            <div class="el-p">
                <dl class="pem-definition-list">
                    <dt>Math Term</dt>
                    <dd>inline math</dd>
                </dl>
            </div>
        `;

        normalizeExistingDefinitionLists(
            section,
            createContext(source),
            config,
            { strictLineBreaks: false },
            source
        );

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');

        expect(definitions).toHaveLength(2);
        expect(definitions[0].querySelector('.math-inline')?.textContent).toBe('x^2 + y^2 = z^2');
        expect(definitions[1].querySelector('.math-block')?.textContent).toBe('\\int_0^1 x\\,dx');
    });

    it('rebuilds standalone source-backed definition lists with host-rendered inline markdown', async () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        const source = [
            '*apple*',
            ': **red** fruit',
            ': `computer`'
        ].join('\n');
        section.innerHTML = `
            <div class="el-p">
                <dl class="pem-definition-list">
                    <dt>apple</dt>
                    <dd><p>red fruit</p></dd>
                </dl>
            </div>
        `;

        processReadingMode(
            section,
            createContext(source),
            config,
            createApp(source) as any
        );
        await waitForAsyncReconciliation();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');

        expect(list.querySelector('dt > em')?.textContent).toBe('apple');
        expect(definitions[0].querySelector('strong')?.textContent).toBe('red');
        expect(definitions[0].textContent).toBe('red fruit');
        expect(definitions[1].querySelector('code')?.textContent).toBe('computer');
        expect(list.querySelector('[data-pem-internal-markdown-fragment]')).toBeNull();
    });

    it('rebuilds malformed existing definition list markup from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p>
                    <dl class="pem-definition-list">
                        <dt class="pem-definition-term">Description Termdetails1details2</dt>
                        <dd class="pem-list-definition-desc">details3</dd>
                    </dl>
                </p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2\n: details3'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2', 'details3']);
    });

    it('preserves Obsidian block wrappers when rebuilding a definition list', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p>
                    <dl class="pem-definition-list">
                        <dt class="pem-definition-term">Description Termdetails1</dt>
                        <dd class="pem-list-definition-desc">details2</dd>
                    </dl>
                </p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2'),
            config
        );
        jest.runOnlyPendingTimers();

        const wrapper = section.querySelector('.el-p') as HTMLElement;
        const list = wrapper.querySelector(':scope > dl.pem-definition-list') as HTMLElement;

        expect(wrapper).not.toBeNull();
        expect(list).not.toBeNull();
        expect(Array.from(section.children).map(child => child.className)).toEqual(['el-p']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2']);
    });

    it('rebuilds consecutive malformed definition lists as one dl from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Term</dt><dd>details1</dd></dl></p>
            </div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Another Term</dt><dd>another detail1</dd></dl></p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n\nAnother Term\n: another detail1'),
            config
        );
        jest.runOnlyPendingTimers();

        const lists = section.querySelectorAll('dl.pem-definition-list');
        const list = lists[0] as HTMLElement;

        expect(lists).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term', 'Another Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'another detail1']);
    });

    it('rebuilds a partial heading-embed definition list with later raw definition text', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-h2"><h2>SubHeading1</h2></div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Term</dt><dd>Sub-category 1</dd></dl></p>
            </div>
            <div class="el-p">
                <p>Top-Level Category<br>~ Sub-category 1<br>~ Sub-category 2</p>
            </div>
        `;
        const sectionSource = [
            'Term',
            '~ Sub-category 1',
            '',
            'Top-Level Category',
            '~ Sub-category 1',
            '~ Sub-category 2'
        ].join('\n');

        normalizeExistingDefinitionLists(
            section,
            createContext(sectionSource),
            config,
            { strictLineBreaks: false }
        );

        const lists = Array.from(section.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];
        const text = section.textContent ?? '';

        expect(lists).toHaveLength(1);
        expect(directChildren(lists[0], 'DT').map(term => term.textContent))
            .toEqual(['Term', 'Top-Level Category']);
        expect(directChildren(lists[0], 'DD').map(def => def.textContent))
            .toEqual(['Sub-category 1', 'Sub-category 1', 'Sub-category 2']);
        expect(countOccurrences(text, 'Top-Level Category')).toBe(1);
        expect(text).not.toContain('~ Sub-category 2');
    });

    it('removes duplicate rendered definition fragments left by live-preview embed refresh', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-h2"><h2>SubHeading1</h2></div>
            <div class="el-p">
                <dl class="pem-definition-list">
                    <dt class="pem-definition-term">Term</dt>
                    <dd class="pem-list-definition-desc pem-definition-desc-item">Sub-category 1</dd>
                    <dt class="pem-definition-term">Top-Level Category</dt>
                    <dd class="pem-list-definition-desc pem-definition-desc-item">Sub-category 1</dd>
                    <dd class="pem-list-definition-desc pem-definition-desc-item">Sub-category 2</dd>
                </dl>
            </div>
            <div class="el-p">
                <dl class="pem-definition-list">
                    <dt class="pem-definition-term">Top-Level Category</dt>
                    <dd class="pem-list-definition-desc pem-definition-desc-item"><p>Sub-category 1</p></dd>
                </dl>
                <p>~ Sub-category 2</p>
            </div>
        `;

        normalizeExistingDefinitionLists(
            section,
            createContext([
                'Term',
                '~ Sub-category 1',
                '',
                'Top-Level Category',
                '~ Sub-category 1',
                '~ Sub-category 2'
            ].join('\n')),
            config,
            { strictLineBreaks: false }
        );

        const lists = Array.from(section.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];
        const text = section.textContent ?? '';

        expect(lists).toHaveLength(1);
        expect(directChildren(lists[0], 'DT').map(term => term.textContent))
            .toEqual(['Term', 'Top-Level Category']);
        expect(countOccurrences(text, 'Top-Level Category')).toBe(1);
        expect(text).not.toContain('~ Sub-category 2');
    });

    it('releases stale embedded preview minimum height after normalizing source-backed lists', async () => {
        jest.useFakeTimers();
        const embed = document.createElement('div');
        embed.className = 'markdown-embed';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.style.minHeight = '300px';
        section.innerHTML = `
            <div class="el-h2"><h2>SubHeading1</h2></div>
            <div class="el-p">
                <dl class="pem-definition-list">
                    <dt class="pem-definition-term">Term</dt>
                    <dd class="pem-list-definition-desc pem-definition-desc-item">Sub-category 1</dd>
                </dl>
            </div>
            <div class="el-p">
                <p>Top-Level Category<br>~ Sub-category 1<br>~ Sub-category 2</p>
            </div>
        `;
        embed.appendChild(section);
        document.body.appendChild(embed);
        const source = [
            'Term',
            '~ Sub-category 1',
            '',
            'Top-Level Category',
            '~ Sub-category 1',
            '~ Sub-category 2'
        ].join('\n');
        const file = { path: docPath };
        const app = {
            workspace: {
                getActiveFile: jest.fn(() => file)
            },
            vault: {
                cachedRead: jest.fn(() => Promise.resolve(source))
            }
        };

        processReadingMode(
            section,
            createContext(source),
            config,
            app as any
        );
        jest.runOnlyPendingTimers();
        for (let index = 0; index < 12; index++) {
            await Promise.resolve();
        }

        expect(section.style.minHeight).toBe('0px');
    });

    it('preserves unrelated rendered siblings when rebuilding from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>Before paragraph</p></div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Termdetails1</dt><dd>details2</dd></dl></p>
            </div>
            <div class="el-p"><p>After paragraph</p></div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.textContent).toContain('Before paragraph');
        expect(section.textContent).toContain('After paragraph');
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2']);
    });

    it('rebuilds a definition-list block without removing trailing text', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Term</dt><dd>details1</dd></dl></p>
            </div>
            <div class="el-p"><p>: details2</p></div>
            <div class="el-p"><p>: details3</p></div>
            <div class="el-p"><p>random text...</p></div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2\n: details3\n\nrandom text...'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.textContent).toContain('random text...');
        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2', 'details3']);
    });

    it('rebuilds separate definition-list blocks without consuming intervening text', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>before text...</p></div>
            <div class="el-p"><p><dl class="pem-definition-list"><dt>First Term</dt><dd>first detail1</dd></dl></p></div>
            <div class="el-p"><p>: first detail2</p></div>
            <div class="el-p"><p>middle text...</p></div>
            <div class="el-p"><p><dl class="pem-definition-list"><dt>Second Term</dt><dd>second detail1</dd></dl></p></div>
            <div class="el-p"><p>after text...</p></div>
        `;

        processReadingMode(
            section,
            createContext(
                'before text...\n\nFirst Term\n: first detail1\n: first detail2\n\n' +
                'middle text...\n\nSecond Term\n: second detail1\n\nafter text...'
            ),
            config
        );
        jest.runOnlyPendingTimers();

        const lists = Array.from(section.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];

        expect(section.textContent).toContain('before text...');
        expect(section.textContent).toContain('middle text...');
        expect(section.textContent).toContain('after text...');
        expect(lists).toHaveLength(2);
        expect(directChildren(lists[0], 'DD').map(def => def.textContent))
            .toEqual(['first detail1', 'first detail2']);
        expect(directChildren(lists[1], 'DD').map(def => def.textContent))
            .toEqual(['second detail1']);
    });

    it('does not multiply definition lists when a subheading embed reads full source', async () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Term</dt><dd>Definition 1</dd><dd>Definition 2</dd><dd>Definition 3</dd></dl></p>
            </div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Top-Level Category</dt><dd>Sub-category 1</dd><dd>Sub-category 2</dd></dl></p>
            </div>
        `;
        const sectionSource = [
            'Term',
            ': Definition 1',
            ': Definition 2',
            ': Definition 3',
            '',
            'Top-Level Category',
            ': Sub-category 1',
            ': Sub-category 2'
        ].join('\n');
        const fullSource = [
            '# Note-1',
            '',
            '## SubHeading',
            '',
            sectionSource
        ].join('\n');
        const file = { path: docPath };
        const app = {
            workspace: {
                getActiveFile: jest.fn(() => file)
            },
            vault: {
                cachedRead: jest.fn(() => Promise.resolve(fullSource))
            }
        };

        processReadingMode(
            section,
            createContext(sectionSource),
            config,
            app as any
        );
        jest.runOnlyPendingTimers();
        for (let index = 0; index < 12; index++) {
            await Promise.resolve();
        }

        const lists = Array.from(section.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];
        const terms = lists.flatMap(list => directChildren(list, 'DT').map(term => term.textContent));
        const definitions = lists.flatMap(list => directChildren(list, 'DD').map(def => def.textContent));

        expect(lists).toHaveLength(1);
        expect(terms).toEqual(['Term', 'Top-Level Category']);
        expect(definitions).toEqual([
            'Definition 1',
            'Definition 2',
            'Definition 3',
            'Sub-category 1',
            'Sub-category 2'
        ]);
    });

    it('does not expand each rendered block to the full source definition list', () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Term</dt><dd>Definition 1</dd><dd>Definition 2</dd><dd>Definition 3</dd></dl></p>
            </div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Top-Level Category</dt><dd>Sub-category 1</dd><dd>Sub-category 2</dd></dl></p>
            </div>
        `;
        const sectionSource = [
            'Term',
            ': Definition 1',
            ': Definition 2',
            ': Definition 3',
            '',
            'Top-Level Category',
            ': Sub-category 1',
            ': Sub-category 2'
        ].join('\n');
        const blocks = Array.from(container.querySelectorAll<HTMLElement>('.el-p'));

        blocks.forEach(block => {
            processReadingMode(
                block,
                createContext(sectionSource),
                config
            );
        });
        jest.runOnlyPendingTimers();

        const lists = Array.from(container.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];
        const terms = lists.flatMap(list => directChildren(list, 'DT').map(term => term.textContent));
        const definitions = lists.flatMap(list => directChildren(list, 'DD').map(def => def.textContent));

        expect(terms).toEqual(['Term', 'Top-Level Category']);
        expect(definitions).toEqual([
            'Definition 1',
            'Definition 2',
            'Definition 3',
            'Sub-category 1',
            'Sub-category 2'
        ]);
    });
});
