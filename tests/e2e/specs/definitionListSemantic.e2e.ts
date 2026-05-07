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

        const html = await browser.execute(() => {
            const definitionList = document.querySelector('.markdown-preview-view .pem-definition-list');
            return {
                termText: definitionList?.querySelector('dt')?.textContent ?? '',
                hasStrayBreak: Boolean(definitionList?.querySelector(':scope > br'))
            };
        });

        expect(html.termText).toBe('DefinitionTerm');
        expect(html.hasStrayBreak).toBe(false);

        await deleteFileIfExists('definition-list-semantic-e2e.md');
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

        const text = await browser.execute(() =>
            document.querySelector('.markdown-preview-view')?.textContent ?? ''
        );

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

        const text = await browser.execute(() =>
            document.querySelector('.markdown-preview-view')?.textContent ?? ''
        );

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
        const nested = await browser.execute(() => {
            const outer = document.querySelector('.markdown-preview-view .pem-definition-list') as HTMLElement | null;
            const nestedList = outer?.querySelector(':scope > dd ul > li > dl') as HTMLElement | null;

            return {
                nestedTerm: nestedList?.querySelector('dt')?.textContent?.trim() ?? '',
                nestedDefinition: nestedList?.querySelector('dd')?.textContent?.trim() ?? '',
                outerDirectDdCount: Array.from(outer?.children ?? [])
                    .filter(child => child.tagName === 'DD')
                    .length
            };
        });

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
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;

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
            await app.workspace.getLeaf().openFile(file);
        }
    }, path);
}

async function ensureReadingMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        // @ts-ignore
        const state = leaf.getViewState();
        state.state.mode = 'preview';
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () => {
        const hasPreview = await browser.execute(() =>
            Boolean(document.querySelector('.markdown-preview-view'))
        );
        return hasPreview;
    }, { timeout: 5000 });
    await browser.pause(500);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        // @ts-ignore
        const state = leaf.getViewState();
        state.state.mode = 'source';
        state.state.source = false;
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () => {
        const hasLivePreview = await browser.execute(() =>
            Boolean(document.querySelector('.markdown-source-view.mod-cm6 .cm-content'))
        );
        return hasLivePreview;
    }, { timeout: 5000 });
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
        directChildren: Array<{ tag: string, text: string }>;
    }>;
}> {
    return browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const sourceText = activeFile ? await app.vault.cachedRead(activeFile) : '';
        const lists = Array.from(
            document.querySelectorAll('.markdown-preview-view .pem-definition-list')
        ) as HTMLElement[];

        return {
            listCount: lists.length,
            // @ts-ignore
            activePath: activeFile?.path ?? '',
            sourceText,
            previewHtml: document.querySelector('.markdown-preview-view')?.innerHTML.slice(0, 1000) ?? '',
            lists: lists.map(list => ({
                html: list.outerHTML,
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
