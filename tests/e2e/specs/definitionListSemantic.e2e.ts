import { browser, expect } from '@wdio/globals';

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
});

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
