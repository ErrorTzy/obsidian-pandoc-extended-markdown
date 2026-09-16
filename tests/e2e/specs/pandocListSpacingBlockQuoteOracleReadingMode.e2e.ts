import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

interface ListTopology {
    tag: string;
    directItemTexts: string[];
    nestedItemTexts: string[][];
}

interface BlockQuoteTopology {
    paragraphTexts: string[];
    lists: ListTopology[];
}

interface OracleState {
    blockQuotes: BlockQuoteTopology[];
    rootParagraphTexts: string[];
    rootLists: ListTopology[];
    quotedCodeTexts: string[];
    rootCodeTexts: string[];
    thematicBreakCount: number;
    previewHtml: string;
}

const indentedQuotePath = 'pandoc-list-spacing-oracle-indented-quote.md';
const quoteTailPath = 'pandoc-list-spacing-oracle-quote-tail.md';
const lazyListPath = 'pandoc-list-spacing-oracle-lazy-list.md';
const continuationPath = 'pandoc-list-spacing-oracle-quote-block-continuation.md';
const quoteToRootPath = 'pandoc-list-spacing-oracle-quote-to-root.md';
const fixturePaths = [
    indentedQuotePath,
    quoteTailPath,
    lazyListPath,
    continuationPath,
    quoteToRootPath
];

const indentedQuoteMarkdown = [
    '> Paragraph',
    '    - TARGET'
].join('\n');
const quoteTailMarkdown = [
    '> - seed',
    '',
    '  continuation',
    '- TARGET'
].join('\n');
const lazyListMarkdown = [
    '- seed',
    '>',
    'continuation',
    '- TARGET'
].join('\n');

describe('Pandoc block-quote list-spacing oracles in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setListExtension(true);
    });

    after(async () => {
        try {
            await setListExtension(true);
        } finally {
            await deleteFilesIfExist(fixturePaths);
        }
    });

    it('changes an indented lazy quote marker from literal text to a quoted list', async () => {
        const disabled = await renderFixture(
            indentedQuotePath,
            indentedQuoteMarkdown,
            false,
            state => state.blockQuotes[0]?.paragraphTexts.join('|') ===
                'Paragraph - TARGET' && state.blockQuotes[0]?.lists.length === 0
        );

        expect(disabled.blockQuotes).toEqual([{
            paragraphTexts: ['Paragraph - TARGET'],
            lists: []
        }]);
        expect(disabled.rootParagraphTexts).toEqual([]);
        expect(disabled.rootLists).toEqual([]);

        const enabled = await renderFixture(
            indentedQuotePath,
            indentedQuoteMarkdown,
            true,
            state => state.blockQuotes[0]?.paragraphTexts.join('|') === 'Paragraph' &&
                state.blockQuotes[0]?.lists[0]?.directItemTexts.join('|') === 'TARGET'
        );

        expect(enabled.blockQuotes).toEqual([{
            paragraphTexts: ['Paragraph'],
            lists: [{
                tag: 'ul',
                directItemTexts: ['TARGET'],
                nestedItemTexts: [[]]
            }]
        }]);
        expect(enabled.rootParagraphTexts).toEqual([]);
        expect(enabled.rootLists).toEqual([]);
    });

    it('changes a post-quote target from root paragraph text to a root list', async () => {
        const disabled = await renderFixture(
            quoteTailPath,
            quoteTailMarkdown,
            false,
            state => state.rootParagraphTexts.join('|') === 'continuation - TARGET' &&
                state.rootLists.length === 0
        );

        expect(disabled.blockQuotes).toEqual([{
            paragraphTexts: [],
            lists: [{
                tag: 'ul',
                directItemTexts: ['seed'],
                nestedItemTexts: [[]]
            }]
        }]);
        expect(disabled.rootParagraphTexts).toEqual(['continuation - TARGET']);
        expect(disabled.rootLists).toEqual([]);

        const enabled = await renderFixture(
            quoteTailPath,
            quoteTailMarkdown,
            true,
            state => state.rootParagraphTexts.join('|') === 'continuation' &&
                state.rootLists[0]?.directItemTexts.join('|') === 'TARGET'
        );

        expect(enabled.blockQuotes).toEqual([{
            paragraphTexts: [],
            lists: [{
                tag: 'ul',
                directItemTexts: ['seed'],
                nestedItemTexts: [[]]
            }]
        }]);
        expect(enabled.rootParagraphTexts).toEqual(['continuation']);
        expect(enabled.rootLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['TARGET'],
            nestedItemTexts: [[]]
        }]);
    });

    it('reconsiders a marker that leaves a rejected deeper quote only when enabled', async () => {
        const markdown = 'Paragraph\n> - seed\n- TARGET';
        const disabled = await renderFixture(
            quoteToRootPath,
            markdown,
            false,
            state => state.rootParagraphTexts.join('|') ===
                'Paragraph > - seed - TARGET' && state.rootLists.length === 0
        );
        expect(disabled.blockQuotes).toEqual([]);
        expect(disabled.rootParagraphTexts).toEqual(['Paragraph > - seed - TARGET']);
        expect(disabled.rootLists).toEqual([]);

        const enabled = await renderFixture(
            quoteToRootPath,
            markdown,
            true,
            state => state.rootParagraphTexts.join('|') === 'Paragraph > - seed' &&
                state.rootLists[0]?.directItemTexts.join('|') === 'TARGET'
        );
        expect(enabled.blockQuotes).toEqual([]);
        expect(enabled.rootParagraphTexts).toEqual(['Paragraph > - seed']);
        expect(enabled.rootLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['TARGET'],
            nestedItemTexts: [[]]
        }]);
    });

    it('keeps a quote-like lazy continuation in one two-item root list in both modes', async () => {
        for (const extensionEnabled of [false, true]) {
            const state = await renderFixture(
                lazyListPath,
                lazyListMarkdown,
                extensionEnabled,
                next => next.blockQuotes.length === 0 &&
                    next.rootLists[0]?.directItemTexts.join('|') ===
                        'seed > continuation|TARGET'
            );

            expect(state.blockQuotes).toEqual([]);
            expect(state.rootParagraphTexts).toEqual([]);
            expect(state.rootLists).toEqual([{
                tag: 'ul',
                directItemTexts: ['seed > continuation', 'TARGET'],
                nestedItemTexts: [[], []]
            }]);
        }
    });

    it('keeps indented lazy text in its paragraph before a list boundary', async () => {
        for (const extensionEnabled of [false, true]) {
            const state = await renderFixture(continuationPath,
                '> Paragraph\n    text\n    - TARGET', extensionEnabled,
                next => next.blockQuotes[0]?.paragraphTexts.join('|') ===
                    (extensionEnabled ? 'Paragraph text' : 'Paragraph text - TARGET'));
            expect(state.blockQuotes[0].lists.map(list => list.directItemTexts)).toEqual(
                extensionEnabled ? [['TARGET']] : []
            );
        }
    });

    it('matches a multiline host quote paragraph before its indented list boundary', async () => {
        for (const extensionEnabled of [false, true]) {
            const state = await renderFixture(continuationPath,
                '> Paragraph\ncontinuation\n    - TARGET', extensionEnabled,
                next => next.blockQuotes[0]?.paragraphTexts.join('|') ===
                    (extensionEnabled ? 'Paragraph continuation' : 'Paragraph continuation - TARGET'));
            expect(state.blockQuotes[0].lists.map(list => list.directItemTexts)).toEqual(
                extensionEnabled ? [['TARGET']] : []
            );
            expect(state.rootCodeTexts).toEqual([]);
        }
    });

    it('does not turn valid list continuations into literal markers when disabled', async () => {
        for (const extensionEnabled of [false, true]) {
            const state = await renderFixture(continuationPath,
                '> - seed\n    - TARGET\n      - CHILD', extensionEnabled,
                next => next.blockQuotes[0]?.lists[0]?.directItemTexts.join('|') === 'seed|TARGET|CHILD');
            expect(state.blockQuotes[0].lists).toHaveLength(1);
            expect(state.blockQuotes[0].lists[0].nestedItemTexts).toEqual([[], [], []]);
            expect(state.rootLists).toEqual([]);
        }
    });

    it('keeps over-indented child markers as literal list-item continuation text', async () => {
        for (const indent of [6, 8]) {
            for (const extensionEnabled of [false, true]) {
                const state = await renderFixture(continuationPath,
                    `- parent\n${' '.repeat(indent)}- CHILD_MUST_STAY\n- TAIL`, extensionEnabled,
                    next => next.rootLists[0]?.directItemTexts.join('|') ===
                        'parent - CHILD_MUST_STAY|TAIL');
                expect(state.rootLists).toEqual([{
                    tag: 'ul', directItemTexts: ['parent - CHILD_MUST_STAY', 'TAIL'],
                    nestedItemTexts: [[], []]
                }]);
                expect(state.previewHtml.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
            }
        }
    });

    for (const continuation of ['***', '~~~\ncode\n~~~']) {
        it(`retains quote ownership across ${JSON.stringify(continuation)}`, async () => {
            for (const extensionEnabled of [false, true]) {
                const state = await renderFixture(
                    continuationPath,
                    `> - seed\n${continuation}\n- TARGET`,
                    extensionEnabled,
                    next => extensionEnabled
                        ? next.rootLists[0]?.directItemTexts.join('|') === 'TARGET'
                        : next.blockQuotes[0]?.lists.some(list =>
                            list.directItemTexts.includes('TARGET')) === true
                );
                expect(state.blockQuotes).toHaveLength(1);
                expect(state.rootLists).toHaveLength(extensionEnabled ? 1 : 0);
                expect(state.previewHtml.match(/TARGET/g)).toHaveLength(1);
                expect(state.rootCodeTexts).toEqual([]);
                expect(state.thematicBreakCount).toBe(0);
                if (continuation === '***') {
                    expect(state.blockQuotes[0].lists[0].directItemTexts).toEqual(
                        extensionEnabled ? ['seed ***'] : ['seed ***', 'TARGET']
                    );
                } else {
                    expect(state.quotedCodeTexts).toEqual(['code']);
                    expect(state.blockQuotes[0].lists).toHaveLength(extensionEnabled ? 1 : 2);
                    expect(state.blockQuotes[0].lists[0].directItemTexts).toEqual(['seed']);
                    if (!extensionEnabled) {
                        expect(state.blockQuotes[0].lists[1].directItemTexts).toEqual(['TARGET']);
                    }
                }
            }
        });
    }
});

async function renderFixture(
    path: string,
    markdown: string,
    extensionEnabled: boolean,
    predicate: (state: OracleState) => boolean
): Promise<OracleState> {
    await setListExtension(extensionEnabled);
    await createOrReplaceFile(path, markdown);
    await openFileInActiveLeaf(path);
    await ensureActiveFileReadingMode();

    try {
        await browser.waitUntil(async () => predicate(await getOracleState()), {
            timeout: 8000,
            timeoutMsg: `Expected ${path} with extension ${
                extensionEnabled ? 'enabled' : 'disabled'
            }`
        });
    } catch (error) {
        const state = await getOracleState();
        throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
    }

    return getOracleState();
}

async function getOracleState(): Promise<OracleState> {
    return browser.execute(() => {
        const preview = getActivePreview();
        const blockQuotes = Array.from(
            preview?.querySelectorAll<HTMLElement>('blockquote') ?? []
        ).filter(quote => !quote.parentElement?.closest('blockquote'));
        const topLists = Array.from(preview?.querySelectorAll<HTMLElement>('ul, ol') ?? [])
            .filter(list => !list.parentElement?.closest('ul, ol'));

        return {
            blockQuotes: blockQuotes.map(quote => ({
                paragraphTexts: Array.from(quote.querySelectorAll('p'))
                    .filter(paragraph => paragraph.closest('blockquote') === quote &&
                        !paragraph.closest('li'))
                    .map(paragraph => normalizeText(paragraph.textContent ?? ''))
                    .filter(Boolean),
                lists: topLists
                    .filter(list => list.closest('blockquote') === quote)
                    .map(getListTopology)
            })),
            rootParagraphTexts: Array.from(preview?.querySelectorAll('p') ?? [])
                .filter(paragraph => !paragraph.closest(
                    'blockquote, li, section.footnotes, .pem-fenced-div'
                ))
                .map(paragraph => normalizeText(paragraph.textContent ?? ''))
                .filter(Boolean),
            rootLists: topLists
                .filter(list => !list.closest(
                    'blockquote, section.footnotes, .pem-fenced-div'
                ))
                .map(getListTopology),
            quotedCodeTexts: Array.from(preview?.querySelectorAll('blockquote pre code') ?? [])
                .map(code => normalizeText(code.textContent ?? '')),
            rootCodeTexts: Array.from(preview?.querySelectorAll('pre code') ?? [])
                .filter(code => !code.closest('blockquote'))
                .map(code => normalizeText(code.textContent ?? '')),
            thematicBreakCount: preview?.querySelectorAll('hr').length ?? 0,
            previewHtml: preview?.innerHTML ?? ''
        };

        function getActivePreview(): HTMLElement | null {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const leaf = leaves.find((candidate: {
                view?: { file?: { path?: string }, containerEl?: HTMLElement }
            }) => candidate.view?.file?.path === activeFile?.path);
            return leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ?? null;
        }

        function getListTopology(list: HTMLElement): ListTopology {
            const items = Array.from(list.children)
                .filter((child): child is HTMLLIElement => child.tagName === 'LI');
            return {
                tag: list.tagName.toLowerCase(),
                directItemTexts: items.map(getDirectItemText),
                nestedItemTexts: items.map(item => Array.from(item.querySelectorAll('li'))
                    .map(getDirectItemText))
            };
        }

        function getDirectItemText(item: HTMLLIElement): string {
            const clone = item.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('ul, ol').forEach(list => list.remove());
            return normalizeText(clone.textContent ?? '');
        }

        function normalizeText(text: string): string {
            return text.replace(/\s+/g, ' ').trim();
        }
    });
}

async function setListExtension(enabled: boolean): Promise<void> {
    const pluginFound = await browser.execute(async extensionEnabled => {
        // @ts-ignore
        let plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            plugin = app.plugins.plugins['pandoc-extended-markdown'];
        }
        if (!plugin?.settings) {
            return false;
        }

        plugin.settings.enableListsWithoutPrecedingBlankline = extensionEnabled;
        await plugin.saveSettings();
        // @ts-ignore
        app.workspace.updateOptions();
        return true;
    }, enabled);

    expect(pluginFound).toBe(true);
    await browser.pause(300);
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
        if (!file) {
            return;
        }

        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        // @ts-ignore
        const leaf = leaves[0] ?? app.workspace.getLeaf();
        await leaf.setViewState({
            type: 'markdown',
            state: {
                file: filePath,
                mode: 'source',
                source: false
            }
        });
        // @ts-ignore
        app.workspace.setActiveLeaf(leaf, { focus: true });
    }, path);

    await browser.waitUntil(async () => browser.execute((filePath: string) => {
        // @ts-ignore
        return app.workspace.getActiveFile()?.path === filePath;
    }, path), {
        timeout: 5000,
        timeoutMsg: `Expected ${path} to be active`
    });
}

async function deleteFilesIfExist(paths: string[]): Promise<void> {
    await browser.execute(async filePaths => {
        for (const filePath of filePaths) {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(filePath);
            if (file) {
                // @ts-ignore
                await app.vault.delete(file);
            }
        }
    }, paths);
}
