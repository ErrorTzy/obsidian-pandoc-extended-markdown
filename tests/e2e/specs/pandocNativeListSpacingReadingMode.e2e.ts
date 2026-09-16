import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

interface NativeListReadingState {
    rawText: string;
    invalidListItemTexts: string[];
    validListItemTexts: string[];
    listTexts: string[];
}

const filePath = 'pandoc-native-list-spacing-reading-mode.md';
const nestedFilePath = 'pandoc-native-list-spacing-nested-reading-mode.md';
const headingFilePath = 'pandoc-native-list-spacing-heading-reading-mode.md';
const enabledFilePath = 'pandoc-native-list-spacing-enabled-reading-mode.md';
const prefixFilePath = 'pandoc-native-list-spacing-prefix-reading-mode.md';
const boundaryFilePath = 'pandoc-native-list-spacing-boundary-reading-mode.md';
const richTextFilePath = 'pandoc-native-list-spacing-rich-text-reading-mode.md';
const quoteFilePath = 'pandoc-native-list-spacing-quote-reading-mode.md';
const orderedTailFilePath = 'pandoc-native-list-spacing-ordered-tail-reading-mode.md';
const indentedFenceFilePath = 'pandoc-native-list-spacing-indented-fence-reading-mode.md';
const deeperQuoteFilePath = 'pandoc-native-list-spacing-deeper-quote-reading-mode.md';
const wideParentFilePath = 'pandoc-native-list-spacing-wide-parent-reading-mode.md';
const invalidLines = [
    '- invalid dash',
    '* invalid star',
    '+ invalid plus',
    '1. invalid ordered one',
    '2. invalid ordered two'
];
const validListItemTexts = [
    'valid dash',
    'valid star',
    'valid plus',
    'valid ordered one',
    'valid ordered two'
];
const content = [
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

describe('Pandoc native list spacing in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: false });
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: true });
        await deleteFileIfExists(filePath);
        await deleteFileIfExists(nestedFilePath);
        await deleteFileIfExists(headingFilePath);
        await deleteFileIfExists(enabledFilePath);
        await deleteFileIfExists(prefixFilePath);
        await deleteFileIfExists(boundaryFilePath);
        await deleteFileIfExists(richTextFilePath);
        await deleteFileIfExists(quoteFilePath);
        await deleteFileIfExists(orderedTailFilePath);
        await deleteFileIfExists(indentedFenceFilePath);
        await deleteFileIfExists(deeperQuoteFilePath);
        await deleteFileIfExists(wideParentFilePath);
    });

    it('renders invalid native list blocks as plain text while preserving valid native lists', async () => {
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        await browser.waitUntil(async () => {
            const state = await getNativeListReadingState();
            return invalidLines.every(line => state.rawText.includes(line)) &&
                validListItemTexts.every(text => state.validListItemTexts.includes(text));
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected native list spacing state in Reading mode'
        });

        const state = await getNativeListReadingState();

        expect(state.invalidListItemTexts).toEqual([]);
        expect(state.validListItemTexts).toEqual(validListItemTexts);
        invalidLines.forEach(line => expect(state.rawText).toContain(line));
        expect(state.listTexts.some(text => text.includes('invalid dash'))).toBe(false);
        expect(state.listTexts.some(text => text.includes('invalid ordered one'))).toBe(false);
    });

    it('preserves the complete issue 16 hierarchy when the list remains paragraph text', async () => {
        const nestedContent = [
            '# hh',
            'gdhr',
            '- [ ] hgsrg',
            '    1. gsdgr',
            '        a. dhrh',
            '- dgfg',
            '    - sgher'
        ].join('\n');
        await createOrReplaceFile(nestedFilePath, nestedContent);
        await openFileInActiveLeaf(nestedFilePath);
        await ensureReadingMode('gdhr');

        const state = await getActivePreviewState();
        expect(state.invalidParagraphs).toHaveLength(1);
        expect(state.invalidParagraphs[0].replace(/\s+/g, ' ').trim()).toBe(
            'gdhr - [ ] hgsrg 1. gsdgr a. dhrh - dgfg - sgher'
        );
        expect(state.listTexts).toEqual([]);
    });

    it('keeps a nested native list immediately after a heading', async () => {
        const headingContent = [
            '# Heading',
            '- parent',
            '    - child'
        ].join('\n');
        await createOrReplaceFile(headingFilePath, headingContent);
        await openFileInActiveLeaf(headingFilePath);
        await ensureReadingMode('Heading');

        const state = await getActivePreviewState();

        expect(state.invalidParagraphs).toEqual([]);
        expect(state.listTexts).toEqual(['parent child', 'child']);
    });

    it('allows a root list to interrupt a paragraph when the extension is enabled', async () => {
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: true });
        await createOrReplaceFile(enabledFilePath, [
            'Paragraph',
            '- parent',
            '  - child'
        ].join('\n'));
        await openFileInActiveLeaf(enabledFilePath);
        await ensureReadingMode('Paragraph');

        const state = await getActivePreviewState();

        expect(state.invalidParagraphs).toEqual([]);
        expect(state.listTexts).toEqual(['parent child', 'child']);
    });

    it('never replaces an earlier valid item whose text only prefixes the target', async () => {
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: false });
        await createOrReplaceFile(prefixFilePath, [
            'Intro',
            '',
            '- foo extra',
            '',
            'Paragraph',
            '- foo'
        ].join('\n'));
        await openFileInActiveLeaf(prefixFilePath);
        await ensureReadingMode('Intro');

        const state = await getActivePreviewState();
        expect(state.listTexts).toEqual(['foo extra']);
        expect(state.invalidParagraphs.map(text => text.replace(/\s+/g, ' ').trim()))
            .toEqual(['Paragraph - foo']);
    });

    it('does not duplicate a block that follows an interrupted list paragraph', async () => {
        await createOrReplaceFile(boundaryFilePath, [
            'Paragraph',
            '- item',
            '',
            '    content',
            '',
            '- next'
        ].join('\n'));
        await openFileInActiveLeaf(boundaryFilePath);
        await ensureReadingMode('Paragraph');

        const state = await browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaf = app.workspace.getLeavesOfType('markdown').find(
                (candidate: { view?: { file?: { path?: string } } }) =>
                    candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            return {
                codeBlockCount: preview?.querySelectorAll('pre code').length ?? 0,
                codeText: preview?.querySelector('pre code')?.textContent,
                invalidText: preview?.querySelector('.pem-pandoc-invalid-native-list')?.textContent,
                listItems: Array.from(preview?.querySelectorAll('li') ?? [])
                    .map(item => item.textContent?.trim())
            };
        });

        expect(state.codeBlockCount).toBe(1);
        expect(state.codeText).toBe('content\n');
        expect(state.invalidText?.replace(/\s+/g, ' ').trim()).toBe('Paragraph - item');
        expect(state.listItems).toEqual(['next']);
    });

    it('matches rich inline source without losing its rendered semantics', async () => {
        await createOrReplaceFile(richTextFilePath, [
            'Paragraph',
            '- `a_b` &amp; <https://example.com>'
        ].join('\n'));
        await openFileInActiveLeaf(richTextFilePath);
        await ensureReadingMode('Paragraph');

        const state = await browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaf = app.workspace.getLeavesOfType('markdown').find(
                (candidate: { view?: { file?: { path?: string } } }) =>
                    candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            const paragraph = preview?.querySelector('.pem-pandoc-invalid-native-list');
            return {
                code: preview?.querySelector('.pem-pandoc-invalid-native-list code')?.textContent,
                link: preview?.querySelector('.pem-pandoc-invalid-native-list a')?.textContent,
                listCount: preview?.querySelectorAll('ul, ol').length ?? 0,
                text: paragraph?.textContent
            };
        });
        expect(state.listCount).toBe(0);
        expect(state.code).toBe('a_b');
        expect(state.link).toBe('https://example.com');
        expect(state.text).toContain('&');
    });

    it('reuses a materialized block quote around an interrupted list', async () => {
        await createOrReplaceFile(quoteFilePath, [
            '> Paragraph',
            '> - child'
        ].join('\n'));
        await openFileInActiveLeaf(quoteFilePath);
        await ensureReadingMode('Paragraph');

        const state = await browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaf = app.workspace.getLeavesOfType('markdown').find(
                (candidate: { view?: { file?: { path?: string } } }) =>
                    candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            return {
                blockquotes: preview?.querySelectorAll('blockquote').length ?? 0,
                invalidText: preview?.querySelector('.pem-pandoc-invalid-native-list')?.textContent,
                listCount: preview?.querySelectorAll('ul, ol').length ?? 0
            };
        });
        expect(state.blockquotes).toBe(1);
        expect(state.invalidText?.replace(/\s+/g, ' ').trim()).toBe('Paragraph - child');
        expect(state.listCount).toBe(0);
    });

    it('keeps the source number when an Obsidian ordered list has a valid tail', async () => {
        await createOrReplaceFile(orderedTailFilePath, [
            'Paragraph',
            '1. invalid',
            '',
            '3. valid'
        ].join('\n'));
        await openFileInActiveLeaf(orderedTailFilePath);
        await ensureReadingMode('Paragraph');

        const state = await browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaf = app.workspace.getLeavesOfType('markdown').find(
                (candidate: { view?: { file?: { path?: string } } }) =>
                    candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            const list = preview?.querySelector('ol');
            return {
                invalidText: preview?.querySelector('.pem-pandoc-invalid-native-list')?.textContent,
                itemText: list?.querySelector('li')?.textContent?.trim(),
                start: list instanceof HTMLOListElement ? list.start : null
            };
        });
        expect(state.invalidText?.replace(/\s+/g, ' ').trim()).toBe('Paragraph 1. invalid');
        expect(state.itemText).toBe('valid');
        expect(state.start).toBe(3);
    });

    it('preserves an indented inline-code fence inside an interrupted paragraph', async () => {
        await createOrReplaceFile(indentedFenceFilePath, [
            'Paragraph',
            '- first item',
            '  ```',
            '  - CODE_MUST_STAY',
            '  ```',
            '- final item'
        ].join('\n'));
        await openFileInActiveLeaf(indentedFenceFilePath);
        await ensureReadingMode('Paragraph');

        const state = await browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaf = app.workspace.getLeavesOfType('markdown').find(
                (candidate: { view?: { file?: { path?: string } } }) =>
                    candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
            const paragraph = preview?.querySelector('.pem-pandoc-invalid-native-list');
            return {
                inlineCode: paragraph?.querySelector('code:not(pre code)')?.textContent,
                listCount: preview?.querySelectorAll('ul, ol').length ?? 0,
                preCount: preview?.querySelectorAll('pre').length ?? 0,
                text: paragraph?.textContent
            };
        });

        expect(state.listCount).toBe(0);
        expect(state.preCount).toBe(0);
        expect(state.inlineCode).toBe('- CODE_MUST_STAY');
        expect(state.text?.replace(/\s+/g, ' ').trim()).toBe(
            'Paragraph - first item - CODE_MUST_STAY - final item'
        );
    });

    for (const enabled of [false, true]) {
        it(`keeps an under-indented marker literal after a wide ordered parent ` +
            `when the extension is ${enabled ? 'enabled' : 'disabled'}`, async () => {
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(wideParentFilePath, [
                '100. PARENT_TARGET',
                '    - CHILD_MUST_STAY',
                '101. ROOT_TAIL'
            ].join('\n'));
            await openFileInActiveLeaf(wideParentFilePath);
            await ensureReadingMode('PARENT_TARGET');

            const state = await browser.execute(() => {
                // @ts-ignore
                const activeFile = app.workspace.getActiveFile();
                // @ts-ignore
                const leaf = app.workspace.getLeavesOfType('markdown').find(
                    (candidate: { view?: { file?: { path?: string } } }) =>
                        candidate.view?.file?.path === activeFile?.path
                );
                const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
                const root = preview?.querySelector('ol');
                const items = root ? Array.from(root.children)
                    .filter(child => child instanceof HTMLLIElement) : [];
                const firstText = items[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
                return {
                    rootStart: root instanceof HTMLOListElement ? root.start : null,
                    directItemCount: items.length,
                    allItemCount: preview?.querySelectorAll('li').length ?? 0,
                    firstText,
                    literalOccurrences: firstText.split('- CHILD_MUST_STAY').length - 1,
                    nestedListCount: items[0]?.querySelectorAll('ul, ol').length ?? 0,
                    tailText: items[1]?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
                };
            });

            expect(state).toEqual({
                rootStart: 100,
                directItemCount: 2,
                allItemCount: 2,
                firstText: 'PARENT_TARGET - CHILD_MUST_STAY',
                literalOccurrences: 1,
                nestedListCount: 0,
                tailText: 'ROOT_TAIL'
            });
        });

        it(`keeps a deeper block-quote marker inside the outer Pandoc paragraph ` +
            `when the extension is ${enabled ? 'enabled' : 'disabled'}`, async () => {
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(deeperQuoteFilePath, [
                'Paragraph',
                '>',
                '> - CHILD_MUST_STAY'
            ].join('\n'));
            await openFileInActiveLeaf(deeperQuoteFilePath);
            await ensureReadingMode('Paragraph');

            const state = await browser.execute(() => {
                // @ts-ignore
                const activeFile = app.workspace.getActiveFile();
                // @ts-ignore
                const leaf = app.workspace.getLeavesOfType('markdown').find(
                    (candidate: { view?: { file?: { path?: string } } }) =>
                        candidate.view?.file?.path === activeFile?.path
                );
                const preview = leaf?.view?.containerEl?.querySelector(
                    '.markdown-preview-view'
                );
                const paragraph = preview?.querySelector(
                    '.pem-pandoc-invalid-native-list'
                );
                return {
                    blockquoteCount: preview?.querySelectorAll('blockquote').length ?? 0,
                    listCount: preview?.querySelectorAll('ul, ol').length ?? 0,
                    text: paragraph?.textContent
                };
            });

            expect(state.blockquoteCount).toBe(0);
            expect(state.listCount).toBe(0);
            expect(state.text?.replace(/\s+/g, ' ').trim()).toBe(
                'Paragraph > > - CHILD_MUST_STAY'
            );
        });
    }
});

async function getActivePreviewState(): Promise<{
    invalidParagraphs: string[];
    listTexts: string[];
}> {
    return browser.execute(() => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile?.path
        );
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
        const invalidParagraphs = Array.from(
            preview?.querySelectorAll('.pem-pandoc-invalid-native-list') ?? []
        ).map(paragraph => Array.from(paragraph.childNodes)
            .map(node => node.nodeName === 'BR' ? '\n' : node.textContent ?? '')
            .join(''));
        const listTexts = Array.from(preview?.querySelectorAll('li') ?? [])
            .map(item => (item.textContent ?? '').replace(/\s+/g, ' ').trim());

        return { invalidParagraphs, listTexts };
    });
}

async function getNativeListReadingState(): Promise<NativeListReadingState> {
    return browser.execute((
        invalidTargets: string[],
        validTargets: string[]
    ): NativeListReadingState => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile?.path
        );
        const previewRoots = Array.from(document.querySelectorAll('.markdown-preview-view'));
        const activePreview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view');
        const preview = previewRoots.find(root =>
            (root.textContent ?? '').includes('Intro paragraph')
        ) ?? activePreview ?? previewRoots[0] ?? null;
        const listItems = Array.from(preview?.querySelectorAll('li') ?? []);
        const listTexts = listItems
            .map(item => (item.textContent ?? '').trim())
            .filter(Boolean);
        const matchesTarget = (text: string, targets: string[]) =>
            targets.some(target => text === target.replace(/^[-*+]\s+|\d+[.)]\s+/, ''));

        return {
            rawText: preview?.textContent ?? '',
            invalidListItemTexts: listTexts.filter(text => matchesTarget(text, invalidTargets)),
            validListItemTexts: validTargets.filter(target => listTexts.includes(target)),
            listTexts
        };
    }, invalidLines, validListItemTexts);
}

async function setSyntaxSettings(settings: Partial<{
    enableListsWithoutPrecedingBlankline: boolean;
}>): Promise<void> {
    await browser.execute(async (nextSettings) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            Object.assign(plugin.settings, nextSettings);
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, settings);
    await browser.pause(300);
}

async function createOrReplaceFile(path: string, data: string): Promise<void> {
    await browser.execute(async (filePath: string, content: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, content);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, content);
    }, path, data);
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
        }
    }, path);
    await browser.waitUntil(async () =>
        browser.execute((filePath: string) => {
            // @ts-ignore
            return app.workspace.getActiveFile()?.path === filePath;
        }, path),
    { timeout: 5000 });
}

async function ensureReadingMode(expectedText: string = 'Intro paragraph'): Promise<void> {
    await ensureActiveFileReadingMode();
    await browser.waitUntil(async () =>
        browser.execute((text: string) => {
            const preview = document.querySelector('.markdown-preview-view');
            return Boolean(preview?.textContent?.includes(text));
        }, expectedText),
    {
        timeout: 5000,
        timeoutMsg: 'Expected reading mode preview content'
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
