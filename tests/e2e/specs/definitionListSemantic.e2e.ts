import { browser, expect } from '@wdio/globals';
import { execFileSync } from 'child_process';

describe('Definition list semantic HTML in reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await browser.execute(() => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                return app.plugins.enablePlugin('pandoc-extended-markdown');
            }
            if (plugin?.settings) {
                plugin.settings.enableDefinitionLists = true;
                plugin.saveSettings();
            }
        });
    });

    it('renders markdown definition list terms inside dt without a stray br', async () => {
        const markdown = `DefinitionTerm
: DefinitionItem`;

        await createOrReplaceFile('definition-list-semantic-e2e.md', markdown);
        await openFileInActiveLeaf('definition-list-semantic-e2e.md');
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, [
            { tag: 'DT', text: 'DefinitionTerm' },
            { tag: 'DD', text: 'DefinitionItem' }
        ]);

        const structure = await getDefinitionListStructure();

        expect(structure.lists[0].directChildren[0]?.text).toBe('DefinitionTerm');
        expect(structure.lists[0].hasStrayBreak).toBe(false);

        await deleteFileIfExists('definition-list-semantic-e2e.md');
    });

    it('does not render a colon after bold text as a definition marker', async () => {
        const path = 'definition-list-bold-colon-paragraph-e2e.md';
        const markdown = '**title**: content';

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await browser.waitUntil(async () => {
            const state = await getPreviewState();
            return state.text.includes('title: content');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected bold-colon paragraph to remain regular text'
        });

        const state = await getPreviewState();

        expect(state.definitionListCount).toBe(0);
        expect(state.html).not.toContain('pem-list-definition-desc');
        expect(state.text).toContain('title: content');
        expect(state.text).not.toContain('title• content');

        await deleteFileIfExists(path);
    });

    it('renders inline and block math inside definition descriptions', async () => {
        const path = 'definition-list-reading-mode-math-e2e.md';
        const markdown = `Math Term
: inline math $x^2 + y^2 = z^2$
: $$\\int_0^1 x\\,dx$$`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        try {
            await browser.waitUntil(async () => {
                const state = await getDefinitionListMathState();
                return state.listCount === 1 &&
                    state.definitionCount === 2 &&
                    state.mathCount >= 2;
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected rendered math inside definition list descriptions'
            });
        } catch (error) {
            const state = await getDefinitionListMathState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getDefinitionListMathState();

        expect(state.inlineMathCount).toBeGreaterThanOrEqual(1);
        expect(state.blockMathCount).toBeGreaterThanOrEqual(1);
        expect(state.textOutsideMath).not.toContain('$x^2 + y^2 = z^2$');
        expect(state.textOutsideMath).not.toContain('$$\\int_0^1 x\\,dx$$');

        await deleteFileIfExists(path);
    });

    it('keeps reading mode stable with mixed math definitions followed by plain text', async () => {
        const path = 'definition-list-reading-mode-mixed-math-e2e.md';
        const markdown = `aaa
: aaa $aaa$
: aaa $$aaa$$
: aaa`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await browser.waitUntil(async () => {
            const state = await getDefinitionListMathState();
            return state.listCount === 1 &&
                state.definitionCount === 3 &&
                state.inlineMathCount >= 1 &&
                state.blockMathCount >= 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected stable rendered math in all definition descriptions'
        });

        const before = await getPreviewState();
        await browser.pause(1500);
        const after = await getPreviewState();

        expect(after.definitionListCount).toBe(1);
        expect(after.text).toContain('aaa');
        expect(after.html).toBe(before.html);

        await deleteFileIfExists(path);
    });

    it('keeps reading mode stable with multiline display math in a definition description', async () => {
        const path = 'definition-list-reading-mode-display-math-e2e.md';
        const markdown = `Math Term
: $$
  \\int_0^1 x\\,dx
  $$`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await browser.waitUntil(async () => {
            const state = await getDefinitionListMathState();
            return state.listCount === 1 &&
                state.definitionCount === 1 &&
                state.mathCount >= 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected rendered display math inside definition list description'
        });

        const before = await getPreviewState();
        await browser.pause(1500);
        const after = await getPreviewState();

        expect(after.definitionListCount).toBe(1);
        expect(after.text).toContain('Math Term');
        expect(after.html).toBe(before.html);

        await deleteFileIfExists(path);
    });

    it('keeps reading mode stable for same-line double-dollar math followed by text', async () => {
        const path = 'definition-list-user-math-repro-e2e.md';
        const markdown = `Defi
: aaa
: aaa $aaa$
: aaa $$aaa$$ : aaa`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await browser.waitUntil(async () => {
            const structure = await getDefinitionListStructure();
            return structure.listCount === 1 &&
                JSON.stringify(structure.lists[0]?.directChildren) === JSON.stringify([
                    { tag: 'DT', text: 'Defi' },
                    { tag: 'DD', text: 'aaa' },
                    { tag: 'DD', text: 'aaa' },
                    { tag: 'DD', text: 'aaa  : aaa' }
                ]);
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected exact user math repro to render as one stable definition list'
        });

        const before = await getPreviewState();
        await browser.pause(1500);
        const after = await getPreviewState();

        expect(after.definitionListCount).toBe(1);
        expect(after.html).toBe(before.html);
        expect(after.text).toContain('Defi');

        await deleteFileIfExists(path);
    });

    it('renders multiple definition lines as sibling dd elements', async () => {
        const path = 'definition-list-multiple-dd-e2e.md';
        const markdown = `Description Term
: details1
: details2
: details3`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, [
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' }
        ]);

        const structure = await getDefinitionListStructure();

        expect(structure.listCount).toBe(1);
        expect(structure.lists[0].directChildren).toEqual([
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' }
        ]);

        await deleteFileIfExists(path);
    });

    it('keeps multiple definition lines rendered after switching through live preview', async () => {
        const path = 'definition-list-mode-switch-multiple-dd-e2e.md';
        const markdown = `Description Term
: details1
: details2
: details3`;
        const expectedChildren = [
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' }
        ];

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, expectedChildren);

        await ensureLivePreviewMode();
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, expectedChildren);

        await deleteFileIfExists(path);
    });

    it('renders a definition-list block before regular trailing text', async () => {
        const path = 'definition-list-with-trailing-text-e2e.md';
        const markdown = `Description Term
: details1
: details2
: details3

random text...`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, [
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' }
        ]);

        const text = (await getPreviewState()).text;

        expect(text).toContain('random text...');

        await deleteFileIfExists(path);
    });

    it('preserves regular text around separate definition-list blocks', async () => {
        const path = 'definition-list-surrounded-blocks-e2e.md';
        const markdown = `before text...

First Term
: first detail1
: first detail2

middle text...

Second Term
: second detail1

after text...`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionLists([
            [
                { tag: 'DT', text: 'First Term' },
                { tag: 'DD', text: 'first detail1' },
                { tag: 'DD', text: 'first detail2' }
            ],
            [
                { tag: 'DT', text: 'Second Term' },
                { tag: 'DD', text: 'second detail1' }
            ]
        ]);

        const text = (await getPreviewState()).text;

        expect(text).toContain('before text...');
        expect(text).toContain('middle text...');
        expect(text).toContain('after text...');

        await deleteFileIfExists(path);
    });

    it('keeps consecutive terms separated by a blank line in one dl', async () => {
        const path = 'definition-list-consecutive-terms-e2e.md';
        const markdown = `Description Term
: details1

Another Term
: another detail1`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(1, [
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DT', text: 'Another Term' },
            { tag: 'DD', text: 'another detail1' }
        ]);

        const structure = await getDefinitionListStructure();

        expect(structure.listCount).toBe(1);
        expect(structure.lists[0].directChildren).toEqual([
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DT', text: 'Another Term' },
            { tag: 'DD', text: 'another detail1' }
        ]);

        await deleteFileIfExists(path);
    });

    it('renders nested definition list content inside a definition dd', async () => {
        const path = 'definition-list-nested-e2e.md';
        const markdown = `Description Term
: details1
: details2
: details3
: - bullet
    : indented`;

        await createOrReplaceFile(path, markdown);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
        await waitForDefinitionDirectChildren(2, [
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' },
            { tag: 'DD', text: 'bulletindented' }
        ]);

        const structure = await getDefinitionListStructure();
        const outerList = structure.lists[0];
        const nested = await getNestedDefinitionState();

        expect(outerList.directChildren).toEqual([
            { tag: 'DT', text: 'Description Term' },
            { tag: 'DD', text: 'details1' },
            { tag: 'DD', text: 'details2' },
            { tag: 'DD', text: 'details3' },
            { tag: 'DD', text: 'bulletindented' }
        ]);
        expect(nested.outerDirectDdCount).toBe(4);
        expect(nested.nestedTerm).toBe('bullet');
        expect(nested.nestedDefinition).toBe('indented');

        await deleteFileIfExists(path);
    });

    it('matches Pandoc HTML structure for representative definition lists', async () => {
        const fixtures = [
            {
                name: 'multiple-dd',
                markdown: `Description Term
: details1
: details2
: details3`
            },
            {
                name: 'blank-separated-terms',
                markdown: `Description Term
: details1

Another Term
: another detail1`
            },
            {
                name: 'alternate-markers',
                markdown: `apple
: red fruit
~ computer`
            },
            {
                name: 'blank-after-term',
                markdown: `Term

: only`
            },
            {
                name: 'continuation-lines',
                markdown: `Term
: first line
  continuation line
: second
  continuation`
            },
            {
                name: 'nested-definition-in-bullet',
                markdown: `Description Term
: details1
: - bullet
    : indented`
            },
            {
                name: 'ordered-and-task-lists',
                markdown: `Term
: 1. ordered
: - [x] checked
: - [ ] unchecked`
            },
            {
                name: 'inline-markdown',
                markdown: `*apple*
: **red** fruit
: \`computer\``
            }
        ];

        for (const fixture of fixtures) {
            const path = `definition-list-pandoc-parity-${fixture.name}.md`;
            await createOrReplaceFile(path, fixture.markdown);
            await openFileInActiveLeaf(path);
            await ensureReadingMode();
            await waitForAnyDefinitionList();

            const parity = await getPandocParity(fixture.markdown);

            expect(parity.actual).toEqual(parity.expected);
            await deleteFileIfExists(path);
        }
    });
});

async function waitForAnyDefinitionList(): Promise<void> {
    await browser.waitUntil(async () => {
        const structure = await getDefinitionListStructure();
        return structure.listCount > 0;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected at least one rendered definition list'
    });
}

async function getPreviewState(): Promise<{
    definitionListCount: number;
    html: string;
    text: string;
}> {
    return browser.execute(() => {
        const getActiveMarkdownPreview = (): HTMLElement | null => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile?.();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            if (preview instanceof HTMLElement) {
                return preview;
            }

            return document.querySelector('.workspace-leaf.mod-active .markdown-preview-view') ??
                document.querySelector('.markdown-preview-view');
        };
        const preview = getActiveMarkdownPreview();
        return {
            definitionListCount: preview?.querySelectorAll('.pem-definition-list').length ?? 0,
            html: preview?.innerHTML ?? '',
            text: preview?.textContent ?? ''
        };
    });
}

async function getDefinitionListMathState(): Promise<{
    listCount: number;
    definitionCount: number;
    mathCount: number;
    inlineMathCount: number;
    blockMathCount: number;
    textOutsideMath: string;
}> {
    return browser.execute(() => {
        const getActiveMarkdownPreview = (): HTMLElement | null => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile?.();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            if (preview instanceof HTMLElement) {
                return preview;
            }

            return document.querySelector('.workspace-leaf.mod-active .markdown-preview-view') ??
                document.querySelector('.markdown-preview-view');
        };
        const preview = getActiveMarkdownPreview();
        const list = preview?.querySelector('.pem-definition-list') as HTMLElement | null;
        const clone = list?.cloneNode(true) as HTMLElement | null;
        clone?.querySelectorAll('.math, mjx-container').forEach(element => element.remove());

        return {
            listCount: preview?.querySelectorAll('.pem-definition-list').length ?? 0,
            definitionCount: list?.querySelectorAll(':scope > dd').length ?? 0,
            mathCount: list?.querySelectorAll('.math, mjx-container').length ?? 0,
            inlineMathCount: list?.querySelectorAll('.math-inline, mjx-container[jax]').length ?? 0,
            blockMathCount: list?.querySelectorAll('.math-block, mjx-container[display="true"]').length ?? 0,
            textOutsideMath: clone?.textContent ?? ''
        };
    });
}

async function getNestedDefinitionState(): Promise<{
    nestedTerm: string;
    nestedDefinition: string;
    outerDirectDdCount: number;
}> {
    return browser.execute(() => {
        const getActiveMarkdownPreview = (): HTMLElement | null => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile?.();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            if (preview instanceof HTMLElement) {
                return preview;
            }

            return document.querySelector('.workspace-leaf.mod-active .markdown-preview-view') ??
                document.querySelector('.markdown-preview-view');
        };
        const preview = getActiveMarkdownPreview();
        const outer = preview?.querySelector('.pem-definition-list') as HTMLElement | null;
        const nestedList = outer?.querySelector(':scope > dd ul > li > dl') as HTMLElement | null;

        return {
            nestedTerm: nestedList?.querySelector('dt')?.textContent?.trim() ?? '',
            nestedDefinition: nestedList?.querySelector('dd')?.textContent?.trim() ?? '',
            outerDirectDdCount: Array.from(outer?.children ?? [])
                .filter(child => child.tagName === 'DD')
                .length
        };
    });
}

async function getPandocParity(markdown: string): Promise<{
    expected: NormalizedDefinitionNode[];
    actual: NormalizedDefinitionNode[];
    pandocHtml: string;
    previewHtml: string;
}> {
    const pandocHtml = execFileSync(
        'pandoc',
        ['-f', 'markdown+task_lists', '-t', 'html'],
        { input: markdown, encoding: 'utf8' }
    );

    return browser.execute((expectedHtml: string) => {
        type BrowserNormalizedNode = {
            tag: string;
            text?: string;
            attrs?: Record<string, string | boolean>;
            children?: BrowserNormalizedNode[];
        };

        const parser = new DOMParser();
        const expectedDoc = parser.parseFromString(`<main>${expectedHtml}</main>`, 'text/html');
        const getActiveMarkdownPreview = (): HTMLElement | null => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile?.();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            if (preview instanceof HTMLElement) {
                return preview;
            }

            return document.querySelector('.workspace-leaf.mod-active .markdown-preview-view') ??
                document.querySelector('.markdown-preview-view');
        };
        const preview = getActiveMarkdownPreview();

        const normalizeTopLevelDefinitionLists = (root: ParentNode, selector: string): BrowserNormalizedNode[] =>
            Array.from(root.querySelectorAll(selector))
                .filter(list => !list.parentElement?.closest('dl'))
                .map(list => normalizeElement(list));

        const normalizeElement = (element: Element): BrowserNormalizedNode => {
            const tag = element.tagName.toLowerCase();
            const attrs = getComparableAttributes(element);
            const children = Array.from(element.childNodes)
                .map(node => normalizeNode(node))
                .filter((node): node is BrowserNormalizedNode => node !== null);

            return {
                tag,
                ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                ...(children.length > 0 ? { children } : {})
            };
        };

        const normalizeNode = (node: Node): BrowserNormalizedNode | null => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = normalizeText(node.textContent ?? '');
                return text ? { tag: '#text', text } : null;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                return normalizeElement(node as Element);
            }

            return null;
        };

        const getComparableAttributes = (element: Element): Record<string, string | boolean> => {
            const attrs: Record<string, string | boolean> = {};
            const tag = element.tagName.toLowerCase();

            if (tag === 'input') {
                const input = element as HTMLInputElement;
                attrs.type = input.type;
                attrs.checked = input.checked;
            }

            if (tag === 'ol' && element.getAttribute('type')) {
                attrs.type = element.getAttribute('type') ?? '';
            }

            if (tag === 'ul' && element.classList.contains('task-list')) {
                attrs.class = 'task-list';
            }

            return attrs;
        };

        const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim();

        return {
            expected: normalizeTopLevelDefinitionLists(expectedDoc, 'dl'),
            actual: preview ? normalizeTopLevelDefinitionLists(preview, 'dl.pem-definition-list') : [],
            pandocHtml: expectedHtml,
            previewHtml: preview?.innerHTML ?? ''
        };
    }, pandocHtml);
}

interface NormalizedDefinitionNode {
    tag: string;
    text?: string;
    attrs?: Record<string, string | boolean>;
    children?: NormalizedDefinitionNode[];
}

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, data);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, data);
    }, path, content);
}

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            // @ts-ignore
            const leaf = leaves[0] ?? app.workspace.getLeaf();
            // @ts-ignore
            await leaf.openFile(file);
            // @ts-ignore
            app.workspace.setActiveLeaf(leaf, { focus: true });
        }
    }, path);
    await browser.waitUntil(async () =>
        browser.execute((filePath: string) => {
            // @ts-ignore
            return app.workspace.getActiveFile()?.path === filePath;
        }, path),
    { timeout: 5000 });
}

async function ensureReadingMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile?.path
        ) ?? leaves[0];
        if (!leaf) {
            return;
        }
        // @ts-ignore
        const state = leaf.getViewState();
        state.state.mode = 'preview';
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () =>
        browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            return Boolean(leaf?.view?.containerEl?.querySelector('.markdown-preview-view'));
        }),
    { timeout: 5000 });
    await browser.pause(500);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile?.path
        ) ?? leaves[0];
        if (!leaf) {
            return;
        }
        // @ts-ignore
        const state = leaf.getViewState();
        state.state.mode = 'source';
        state.state.source = false;
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () =>
        browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            return Boolean(leaf?.view?.containerEl?.querySelector('.markdown-source-view.mod-cm6 .cm-content'));
        }),
    { timeout: 5000 });
    await browser.pause(500);
}

async function waitForDefinitionDirectChildren(
    expectedCount: number,
    expectedChildren: Array<{ tag: string, text: string }>
): Promise<void> {
    try {
        await browser.waitUntil(async () => {
            const structure = await getDefinitionListStructure();
            return structure.listCount === expectedCount &&
                JSON.stringify(structure.lists[0]?.directChildren) === JSON.stringify(expectedChildren);
        }, { timeout: 5000 });
    } catch (error) {
        const structure = await getDefinitionListStructure();
        throw new Error(`${(error as Error).message}\nActual definition list structure: ${JSON.stringify(structure)}`);
    }
}

async function waitForDefinitionLists(
    expectedLists: Array<Array<{ tag: string, text: string }>>,
    expectedCount: number = expectedLists.length
): Promise<void> {
    try {
        await browser.waitUntil(async () => {
            const structure = await getDefinitionListStructure();
            return structure.listCount === expectedCount &&
                JSON.stringify(structure.lists.map(list => list.directChildren)) === JSON.stringify(expectedLists);
        }, { timeout: 5000 });
    } catch (error) {
        const structure = await getDefinitionListStructure();
        throw new Error(`${(error as Error).message}\nActual definition list structure: ${JSON.stringify(structure)}`);
    }
}

async function getDefinitionListStructure(): Promise<{
    listCount: number;
    activePath: string;
    sourceText: string;
    previewHtml: string;
    lists: Array<{
        html: string;
        hasStrayBreak: boolean;
        directChildren: Array<{ tag: string, text: string }>;
    }>;
}> {
    return browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const sourceText = activeFile ? await app.vault.cachedRead(activeFile) : '';
        const getActiveMarkdownPreview = (): HTMLElement | null => {
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            if (preview instanceof HTMLElement) {
                return preview;
            }

            return document.querySelector('.workspace-leaf.mod-active .markdown-preview-view') ??
                document.querySelector('.markdown-preview-view');
        };
        const preview = getActiveMarkdownPreview();
        const lists = Array.from(
            preview?.querySelectorAll('.pem-definition-list') ?? []
        ) as HTMLElement[];

        return {
            listCount: lists.length,
            // @ts-ignore
            activePath: activeFile?.path ?? '',
            sourceText,
            previewHtml: preview?.innerHTML.slice(0, 1000) ?? '',
            lists: lists.map(list => ({
                html: list.outerHTML,
                hasStrayBreak: Boolean(list.querySelector(':scope > br')),
                directChildren: Array.from(list.children).map(child => ({
                    tag: child.tagName,
                    text: child.textContent?.trim() ?? ''
                }))
            }))
        };
    });
}

async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.vault.delete(file);
        }
    }, path);
}
