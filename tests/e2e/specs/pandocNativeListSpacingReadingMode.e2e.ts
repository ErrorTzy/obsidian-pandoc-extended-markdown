import { browser, expect } from '@wdio/globals';

interface NativeListReadingState {
    rawText: string;
    invalidListItemTexts: string[];
    validListItemTexts: string[];
    listTexts: string[];
}

const filePath = 'pandoc-native-list-spacing-reading-mode.md';
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
        await setSyntaxSettings({ enforcePandocListSpacing: true });
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await setSyntaxSettings({ enforcePandocListSpacing: false });
        await deleteFileIfExists(filePath);
    });

    it('renders invalid native list blocks as plain text while preserving valid native lists', async () => {
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getNativeListReadingState();
                return invalidLines.every(line => state.rawText.includes(line)) &&
                    validListItemTexts.every(text => state.validListItemTexts.includes(text));
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected native list spacing state in Reading mode'
            });
        } catch (error) {
            const state = await getNativeListReadingState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getNativeListReadingState();

        expect(state.invalidListItemTexts).toEqual([]);
        expect(state.validListItemTexts).toEqual(validListItemTexts);
        invalidLines.forEach(line => expect(state.rawText).toContain(line));
        expect(state.listTexts.some(text => text.includes('invalid dash'))).toBe(false);
        expect(state.listTexts.some(text => text.includes('invalid ordered one'))).toBe(false);
    });
});

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
    enforcePandocListSpacing: boolean;
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
        await leaf.setViewState({
            type: 'markdown',
            state: {
                file: activeFile.path,
                mode: 'preview',
                source: false
            }
        });
        leaf.view?.previewMode?.rerender?.(true);
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
    {
        timeout: 5000,
        timeoutMsg: 'Expected reading mode preview'
    });
    await browser.waitUntil(async () =>
        browser.execute(() => {
            const preview = document.querySelector('.markdown-preview-view');
            return Boolean(preview?.textContent?.includes('Intro paragraph'));
        }),
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
