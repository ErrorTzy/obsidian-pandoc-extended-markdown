import { browser, expect } from '@wdio/globals';

interface ReadingModeFencedDivState {
    blockCount: number;
    headerTexts: string[];
    blockLabels: string[];
    blockClasses: string[];
    blockTexts: string[];
    referenceTexts: string[];
    referenceLabels: string[];
    rawText: string;
    paragraphHtml: string[];
}

describe('Fenced div reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await browser.execute(async () => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                await app.plugins.enablePlugin('pandoc-extended-markdown');
            }

            // @ts-ignore
            const enabledPlugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (enabledPlugin?.settings) {
                enabledPlugin.settings.enableFencedDivs = true;
                await enabledPlugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('renders Pandoc fenced div blocks and @id references in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-e2e.md';
        const content = [
            '::: {.theorem #thm:reading}',
            'Every compact metric space is complete.',
            ':::',
            '',
            'See @thm:reading for the result.'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeFencedDivState();
                return state.blockCount === 1 &&
                    state.headerTexts.includes('Theorem:') &&
                    state.referenceTexts.includes('Theorem');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected fenced div block and reference in reading mode'
            });
        } catch (error) {
            const state = await getReadingModeFencedDivState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeFencedDivState();

        expect(state.blockCount).toBe(1);
        expect(state.headerTexts).toEqual(['Theorem:']);
        expect(state.blockLabels).toEqual(['thm:reading']);
        expect(state.blockClasses[0]).toContain('pem-fenced-div-theorem');
        expect(state.blockTexts[0]).toContain('Every compact metric space is complete.');
        expect(state.referenceTexts).toEqual(['Theorem']);
        expect(state.referenceLabels).toEqual(['thm:reading']);
        expect(state.rawText).not.toContain('::: {.theorem #thm:reading}');
        expect(state.rawText).not.toContain('@thm:reading');

        await deleteFileIfExists(filePath);
    });

    it('renders adjacent and nested fenced divs in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-nested-e2e.md';
        const content = [
            '::: {.outer #outer}',
            'Outer opening content.',
            '::: {.inner #inner}',
            'Nested content.',
            ':::',
            '::: {.warning #warn}',
            'Sibling warning.',
            ':::',
            ':::',
            '',
            'Refs @outer @inner @warn.'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        await browser.waitUntil(async () => {
            const state = await getReadingModeFencedDivState();
            return state.blockCount === 3 &&
                state.headerTexts.join('|') === 'Outer:|Inner:|Warning:' &&
                state.referenceTexts.join('|') === 'Outer|Inner|Warning';
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected adjacent and nested fenced divs in reading mode'
        });

        const state = await getReadingModeFencedDivState();

        expect(state.blockCount).toBe(3);
        expect(state.headerTexts).toEqual(['Outer:', 'Inner:', 'Warning:']);
        expect(state.blockLabels).toEqual(['outer', 'inner', 'warn']);
        expect(state.blockClasses[1]).toContain('pem-fenced-div-inner');
        expect(state.blockClasses[2]).toContain('pem-fenced-div-inner');
        expect(state.blockTexts[0]).toContain('Outer opening content.');
        expect(state.blockTexts[0]).toContain('Nested content.');
        expect(state.blockTexts[2]).toContain('Sibling warning.');
        expect(state.referenceTexts).toEqual(['Outer', 'Inner', 'Warning']);
        expect(state.referenceLabels).toEqual(['outer', 'inner', 'warn']);
        expect(state.rawText).not.toContain(':::');
        expect(state.rawText).not.toContain('@outer');
        expect(state.rawText).not.toContain('@inner');
        expect(state.rawText).not.toContain('@warn');

        await deleteFileIfExists(filePath);
    });

    it('keeps nested fenced divs open across blank-line reading-mode paragraphs', async () => {
        const filePath = 'fenced-div-reading-mode-blank-nested-e2e.md';
        const content = [
            '::: Warning',
            'This is a warning.',
            '',
            '::: Danger',
            'This is a warning within a warning.',
            '',
            '::: Warning2',
            'This is a warning within a warning within a warning.',
            ':::',
            'This is on the 2nd level',
            ':::',
            'This is on the 1st level',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeFencedDivState();
                return state.blockCount === 3 &&
                    state.headerTexts.join('|') === 'Warning:|Danger:|Warning2:' &&
                    !state.rawText.includes(':::');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected blank-line nested fenced divs in reading mode'
            });
        } catch (error) {
            const state = await getReadingModeFencedDivState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeFencedDivState();

        expect(state.blockCount).toBe(3);
        expect(state.headerTexts).toEqual(['Warning:', 'Danger:', 'Warning2:']);
        expect(state.blockTexts[0]).toContain('This is a warning.');
        expect(state.blockTexts[0]).toContain('This is on the 1st level');
        expect(state.blockTexts[1]).toContain('This is a warning within a warning.');
        expect(state.blockTexts[1]).toContain('This is on the 2nd level');
        expect(state.blockTexts[2]).toContain('This is a warning within a warning within a warning.');
        expect(state.rawText).not.toContain(':::');

        await deleteFileIfExists(filePath);
    });
});

async function getReadingModeFencedDivState(): Promise<ReadingModeFencedDivState> {
    return browser.execute((): ReadingModeFencedDivState => {
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const blocks = Array.from(preview?.querySelectorAll('.pem-fenced-div') ?? []) as HTMLElement[];
        const references = Array.from(preview?.querySelectorAll('.pem-fenced-div-reference') ?? []) as HTMLElement[];

        return {
            blockCount: blocks.length,
            headerTexts: blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent ?? ''),
            blockLabels: blocks.map(block => block.dataset.pandocDivId ?? ''),
            blockClasses: blocks.map(block => block.className),
            blockTexts: blocks.map(block => block.textContent ?? ''),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references.map(reference => reference.dataset.pandocDivRef ?? ''),
            rawText: preview?.textContent ?? '',
            paragraphHtml: Array.from(preview?.querySelectorAll('.el-p') ?? [])
                .map(element => element.innerHTML)
        };
    });
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
        state.state = {
            ...(state.state ?? {}),
            mode: 'preview'
        };
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () => {
        const hasPreview = await browser.execute(() =>
            Boolean(document.querySelector('.markdown-preview-view'))
        );
        return hasPreview;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected reading mode preview to be visible'
    });
    await browser.pause(500);
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
