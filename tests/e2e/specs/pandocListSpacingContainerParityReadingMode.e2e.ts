import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

interface ListTopology {
    tag: string;
    directItemTexts: string[];
    nestedItemTexts: string[][];
}

interface QuoteState {
    blockQuoteCount: number;
    quotedLists: ListTopology[];
    rootLists: ListTopology[];
    previewHtml: string;
}

interface FootnoteState {
    footnoteSectionCount: number;
    indexListCount: number;
    noteItemCount: number;
    paragraphTexts: string[];
    bodyLists: ListTopology[];
    backlinkCount: number;
    previewHtml: string;
}

interface FencedDivState {
    blockCount: number;
    paragraphTexts: string[];
    bodyLists: ListTopology[];
    previewHtml: string;
}

interface DefinitionListState {
    blockQuoteCount: number;
    quotedDefinitionListCount: number;
    quotedTermTexts: string[];
    quotedDefinitionTexts: string[];
    quotedParagraphTexts: string[];
    rootParagraphTexts: string[];
    previewHtml: string;
}

const quoteFilePath = 'pandoc-list-spacing-container-quote-reading-mode.md';
const footnoteFilePath = 'pandoc-list-spacing-container-footnote-reading-mode.md';
const fencedDivFilePath = 'pandoc-list-spacing-container-fenced-div-reading-mode.md';
const definitionFilePath = 'pandoc-list-spacing-container-definition-reading-mode.md';
const fixturePaths = [quoteFilePath, footnoteFilePath, fencedDivFilePath, definitionFilePath];

const quoteMarkdown = [
    '> - seed',
    '- TARGET',
    '  - CHILD',
    '    continuation'
].join('\n');
const footnoteMarkdown = [
    'Use[^n].',
    '',
    '[^n]: note',
    '- CHILD'
].join('\n');
const fencedDivMarkdown = [
    '::: note',
    'paragraph',
    '- parent',
    '  - CHILD',
    ':::'
].join('\n');

describe('Pandoc list-spacing container parity in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSyntaxSettings({
            enableListsWithoutPrecedingBlankline: true,
            enableReadableFencedDivSyntax: true,
            enableFencedDivs: true,
            enableDefinitionLists: true
        });
    });

    after(async () => {
        try {
            await setSyntaxSettings({
                enableListsWithoutPrecedingBlankline: true,
                enableReadableFencedDivSyntax: true,
                enableFencedDivs: true,
                enableDefinitionLists: true
            });
        } finally {
            await deleteFilesIfExist(fixturePaths);
        }
    });

    it('keeps a lazy list in its quote only when the extension is disabled', async () => {
        const disabled = await renderQuoteFixture(false);

        expect(disabled.blockQuoteCount).toBe(1);
        expect(disabled.rootLists).toEqual([]);
        expect(disabled.quotedLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['seed', 'TARGET', 'CHILD continuation'],
            nestedItemTexts: [[], [], []]
        }]);

        const enabled = await renderQuoteFixture(true);

        expect(enabled.blockQuoteCount).toBe(1);
        expect(enabled.quotedLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['seed'],
            nestedItemTexts: [[]]
        }]);
        expect(enabled.rootLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['TARGET'],
            nestedItemTexts: [['CHILD continuation']]
        }]);
    });

    it('keeps a lazy footnote marker literal only when the extension is disabled', async () => {
        const disabled = await renderFootnoteFixture(false);

        expect(disabled.footnoteSectionCount).toBe(1);
        expect(disabled.indexListCount).toBe(1);
        expect(disabled.noteItemCount).toBe(1);
        expect(disabled.paragraphTexts).toEqual(['note - CHILD']);
        expect(disabled.bodyLists).toEqual([]);
        expect(disabled.backlinkCount).toBe(1);

        const enabled = await renderFootnoteFixture(true);

        expect(enabled.footnoteSectionCount).toBe(1);
        expect(enabled.indexListCount).toBe(1);
        expect(enabled.noteItemCount).toBe(1);
        expect(enabled.paragraphTexts).toEqual(['note']);
        expect(enabled.bodyLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['CHILD'],
            nestedItemTexts: [[]]
        }]);
        expect(enabled.backlinkCount).toBe(1);
    });

    it('keeps a fenced-div list literal only when the extension is disabled', async () => {
        const disabled = await renderFencedDivFixture(false);

        expect(disabled.blockCount).toBe(1);
        expect(disabled.paragraphTexts).toEqual(['paragraph - parent - CHILD']);
        expect(disabled.bodyLists).toEqual([]);

        const enabled = await renderFencedDivFixture(true);

        expect(enabled.blockCount).toBe(1);
        expect(enabled.paragraphTexts).toEqual(['paragraph']);
        expect(enabled.bodyLists).toEqual([{
            tag: 'ul',
            directItemTexts: ['parent'],
            nestedItemTexts: [['CHILD']]
        }]);
    });

    it('preserves literal over-indented markers beside a valid fenced-div child list', async () => {
        for (const indent of [6, 8]) {
            for (const extensionEnabled of [false, true]) {
                await prepareFixture(fencedDivFilePath,
                    `::: note\n- parent\n${' '.repeat(indent)}- CHILD_MUST_STAY\n  - NEXT\n:::\n\nTAIL`,
                    extensionEnabled);
                const state = await waitForState(getFencedDivState,
                    next => next.bodyLists[0]?.directItemTexts.join('|') === 'parent - CHILD_MUST_STAY',
                    `literal ${indent}-column continuation in a fenced div`);
                expect(state.bodyLists).toEqual([{
                    tag: 'ul', directItemTexts: ['parent - CHILD_MUST_STAY'], nestedItemTexts: [['NEXT']]
                }]);
                expect(state.previewHtml.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
                expect(state.previewHtml).toContain('TAIL');
            }
        }
    });

    it('matches Pandoc lazy block-quote definition placement in both extension modes', async () => {
        const disabled = await renderDefinitionFixture(false);
        expect(disabled.blockQuoteCount).toBe(1);
        expect(disabled.quotedDefinitionListCount).toBe(1);
        expect(disabled.quotedTermTexts).toEqual(['Term']);
        expect(disabled.quotedDefinitionTexts).toEqual(['def']);
        expect(disabled.quotedParagraphTexts).toEqual([]);
        expect(disabled.rootParagraphTexts).toEqual([]);

        const enabled = await renderDefinitionFixture(true);
        expect(enabled.blockQuoteCount).toBe(1);
        expect(enabled.quotedDefinitionListCount).toBe(0);
        expect(enabled.quotedTermTexts).toEqual([]);
        expect(enabled.quotedDefinitionTexts).toEqual([]);
        expect(enabled.quotedParagraphTexts).toEqual(['Term']);
        expect(enabled.rootParagraphTexts).toEqual([': def']);
    });
});

async function renderQuoteFixture(extensionEnabled: boolean): Promise<QuoteState> {
    await prepareFixture(quoteFilePath, quoteMarkdown, extensionEnabled);
    return waitForState(
        getQuoteState,
        state => extensionEnabled
            ? state.quotedLists[0]?.directItemTexts.join('|') === 'seed' &&
                state.rootLists[0]?.directItemTexts.join('|') === 'TARGET'
            : state.quotedLists[0]?.directItemTexts.join('|') ===
                'seed|TARGET|CHILD continuation' && state.rootLists.length === 0,
        `quote topology with extension ${extensionEnabled ? 'enabled' : 'disabled'}`
    );
}

async function renderFootnoteFixture(extensionEnabled: boolean): Promise<FootnoteState> {
    await prepareFixture(footnoteFilePath, footnoteMarkdown, extensionEnabled);
    return waitForState(
        getFootnoteState,
        state => extensionEnabled
            ? state.paragraphTexts.join('|') === 'note' && state.bodyLists.length === 1
            : state.paragraphTexts.join('|') === 'note - CHILD' &&
                state.bodyLists.length === 0,
        `footnote topology with extension ${extensionEnabled ? 'enabled' : 'disabled'}`
    );
}

async function renderFencedDivFixture(extensionEnabled: boolean): Promise<FencedDivState> {
    await prepareFixture(fencedDivFilePath, fencedDivMarkdown, extensionEnabled);
    return waitForState(
        getFencedDivState,
        state => extensionEnabled
            ? state.paragraphTexts.join('|') === 'paragraph' && state.bodyLists.length === 1
            : state.paragraphTexts.join('|') === 'paragraph - parent - CHILD' &&
                state.bodyLists.length === 0,
        `fenced-div topology with extension ${extensionEnabled ? 'enabled' : 'disabled'}`
    );
}

async function renderDefinitionFixture(extensionEnabled: boolean): Promise<DefinitionListState> {
    await setSyntaxSettings({
        enableListsWithoutPrecedingBlankline: extensionEnabled,
        enableDefinitionLists: true
    });
    await createOrReplaceFile(definitionFilePath, '> Term\n: def');
    await openFileInActiveLeaf(definitionFilePath);
    await ensureActiveFileReadingMode();
    return waitForState(
        getDefinitionListState,
        state => extensionEnabled
            ? state.quotedParagraphTexts.join('|') === 'Term' &&
                state.rootParagraphTexts.join('|') === ': def' &&
                state.quotedDefinitionListCount === 0
            : state.quotedTermTexts.join('|') === 'Term' &&
                state.quotedDefinitionTexts.join('|') === 'def' &&
                state.rootParagraphTexts.length === 0,
        `definition-list quote topology with extension ${extensionEnabled ? 'enabled' : 'disabled'}`
    );
}

async function prepareFixture(
    path: string,
    markdown: string,
    extensionEnabled: boolean
): Promise<void> {
    await setSyntaxSettings({
        enableListsWithoutPrecedingBlankline: extensionEnabled,
        enableReadableFencedDivSyntax: true,
        enableFencedDivs: true
    });
    await createOrReplaceFile(path, markdown);
    await openFileInActiveLeaf(path);
    await ensureActiveFileReadingMode();
}

async function waitForState<T>(
    readState: () => Promise<T>,
    predicate: (state: T) => boolean,
    label: string
): Promise<T> {
    try {
        await browser.waitUntil(async () => predicate(await readState()), {
            timeout: 8000,
            timeoutMsg: `Expected ${label}`
        });
    } catch (error) {
        const state = await readState();
        throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
    }

    return readState();
}

async function getQuoteState(): Promise<QuoteState> {
    return browser.execute(() => {
        const preview = getActivePreview();
        const topLists = Array.from(preview?.querySelectorAll<HTMLElement>('ul, ol') ?? [])
            .filter(list => !list.parentElement?.closest('ul, ol'));
        const quotedLists = topLists.filter(list => Boolean(list.closest('blockquote')));
        const rootLists = topLists.filter(list => !list.closest(
            'blockquote, section.footnotes, .pem-fenced-div'
        ));

        return {
            blockQuoteCount: preview?.querySelectorAll('blockquote').length ?? 0,
            quotedLists: quotedLists.map(getListTopology),
            rootLists: rootLists.map(getListTopology),
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

async function getFootnoteState(): Promise<FootnoteState> {
    return browser.execute(() => {
        const preview = getActivePreview();
        const footnoteSections = Array.from(
            preview?.querySelectorAll<HTMLElement>('section.footnotes') ?? []
        );
        const footnote = footnoteSections[0] ?? null;
        const indexLists = footnote
            ? Array.from(footnote.children)
                .filter((child): child is HTMLOListElement => child.tagName === 'OL')
            : [];
        const indexList = indexLists[0] ?? null;
        const noteItems = indexList
            ? Array.from(indexList.children)
                .filter((child): child is HTMLLIElement => child.tagName === 'LI')
            : [];
        const noteItem = noteItems[0] ?? null;
        const bodyLists = noteItem
            ? Array.from(noteItem.querySelectorAll<HTMLElement>('ul, ol'))
                .filter(list => list.parentElement?.closest('ul, ol') === indexList)
            : [];

        return {
            footnoteSectionCount: footnoteSections.length,
            indexListCount: indexLists.length,
            noteItemCount: noteItems.length,
            paragraphTexts: noteItem
                ? Array.from(noteItem.querySelectorAll(':scope > p')).map(paragraphText)
                : [],
            bodyLists: bodyLists.map(getListTopology),
            backlinkCount: noteItem?.querySelectorAll(
                'a.footnote-back, a.footnote-backref'
            ).length ?? 0,
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

        function paragraphText(paragraph: Element): string {
            const clone = paragraph.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('a.footnote-back, a.footnote-backref')
                .forEach(link => link.remove());
            return normalizeText(clone.textContent ?? '');
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
            clone.querySelectorAll('a.footnote-back, a.footnote-backref')
                .forEach(link => link.remove());
            return normalizeText(clone.textContent ?? '');
        }

        function normalizeText(text: string): string {
            return text.replace(/\s+/g, ' ').trim();
        }
    });
}

async function getFencedDivState(): Promise<FencedDivState> {
    return browser.execute(() => {
        const preview = getActivePreview();
        const blocks = Array.from(
            preview?.querySelectorAll<HTMLElement>('.pem-fenced-div') ?? []
        ).filter(block => !block.parentElement?.closest('.pem-fenced-div'));
        const content = blocks[0]?.querySelector<HTMLElement>(
            ':scope > .pem-fenced-div-content'
        ) ?? null;
        const bodyLists = Array.from(content?.querySelectorAll<HTMLElement>('ul, ol') ?? [])
            .filter(list => !list.parentElement?.closest('ul, ol'));

        return {
            blockCount: blocks.length,
            paragraphTexts: Array.from(content?.querySelectorAll(':scope > p') ?? [])
                .map(paragraph => normalizeText(paragraph.textContent ?? ''))
                .filter(Boolean),
            bodyLists: bodyLists.map(getListTopology),
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

async function getDefinitionListState(): Promise<DefinitionListState> {
    return browser.execute(() => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector<HTMLElement>(
            '.markdown-preview-view'
        ) ?? null;
        const quote = preview?.querySelector<HTMLElement>('blockquote') ?? null;
        const lists = Array.from(
            quote?.querySelectorAll<HTMLElement>('dl.pem-definition-list') ?? []
        );
        return {
            blockQuoteCount: preview?.querySelectorAll('blockquote').length ?? 0,
            quotedDefinitionListCount: lists.length,
            quotedTermTexts: lists.flatMap(list => Array.from(list.querySelectorAll('dt'))
                .map(term => (term.textContent ?? '').replace(/\s+/g, ' ').trim())),
            quotedDefinitionTexts: lists.flatMap(list => Array.from(list.querySelectorAll('dd'))
                .map(definition => (definition.textContent ?? '').replace(/\s+/g, ' ').trim())),
            quotedParagraphTexts: Array.from(quote?.querySelectorAll(':scope > p') ?? [])
                .map(paragraph => (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim()),
            rootParagraphTexts: Array.from(
                preview?.querySelectorAll(':scope > .markdown-preview-sizer > .el-p > p') ?? []
            ).map(paragraph => (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim()),
            previewHtml: preview?.innerHTML ?? ''
        };
    });
}

async function setSyntaxSettings(settings: Partial<{
    enableListsWithoutPrecedingBlankline: boolean;
    enableReadableFencedDivSyntax: boolean;
    enableFencedDivs: boolean;
    enableDefinitionLists: boolean;
}>): Promise<void> {
    const pluginFound = await browser.execute(async nextSettings => {
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

        Object.assign(plugin.settings, nextSettings);
        await plugin.saveSettings();
        // @ts-ignore
        app.workspace.updateOptions();
        // Match the settings UI, which explicitly rebuilds Reading-mode DOM.
        // @ts-ignore
        app.workspace.getLeavesOfType('markdown').forEach(leaf => {
            leaf.view?.previewMode?.rerender?.(true);
        });
        return true;
    }, settings);

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
