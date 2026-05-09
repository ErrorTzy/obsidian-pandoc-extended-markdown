import { browser, expect } from '@wdio/globals';

interface ReadingModeFencedDivState {
    strictPandocMode: boolean | null;
    blockCount: number;
    fencedDivInlineMathCount: number;
    fencedDivBlockMathCount: number;
    fencedDivLoadedMathCount: number;
    fencedDivMathHtml: string[];
    nestedInlineMathCount: number;
    nestedBlockMathCount: number;
    nestedLoadedMathCount: number;
    nestedMathDirectText: string;
    nestedTextOutsideMath: string;
    blockWidths: number[];
    blockParentClasses: string[];
    blockParentIndices: number[];
    previewWidth: number;
    headerTexts: string[];
    titleElementCount: number;
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
                enabledPlugin.settings.strictPandocMode = false;
                enabledPlugin.settings.enableFencedDivs = true;
                await enabledPlugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('renders Pandoc fenced div blocks and @id citations in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-e2e.md';
        const content = [
            '::: {.theorem #thm:reading title="Theorem &"}',
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
                    state.headerTexts.includes('Theorem 1') &&
                    state.referenceTexts.includes('Theorem 1');
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
        expect(state.headerTexts).toEqual(['Theorem 1']);
        expect(state.blockLabels).toEqual(['thm:reading']);
        expect(state.blockClasses[0]).toContain('pem-fenced-div-theorem');
        expect(state.blockTexts[0]).toContain('Every compact metric space is complete.');
        expect(state.referenceTexts).toEqual(['Theorem 1']);
        expect(state.referenceLabels).toEqual(['thm:reading']);
        expect(state.rawText).not.toContain('::: {.theorem #thm:reading title="Theorem &"}');
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

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeFencedDivState();
                return state.blockCount === 3 &&
                    state.headerTexts.join('|') === 'Outer|Inner|Warning' &&
                    state.referenceTexts.join('|') === 'Outer|Inner|Warning';
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected adjacent and nested fenced divs in reading mode'
            });
        } catch (error) {
            const state = await getReadingModeFencedDivState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeFencedDivState();

        expect(state.blockCount).toBe(3);
        expect(state.headerTexts).toEqual(['Outer', 'Inner', 'Warning']);
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

    it('keeps strict Pandoc mode from rendering lua-filter fenced div titles or @id references in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-strict-e2e.md';
        const content = [
            '::: {.theorem #thm:strict title="Theorem &"}',
            'Strict-mode content.',
            ':::',
            '',
            'See @thm:strict for the result.'
        ].join('\n');

        await setStrictPandocMode(true);
        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureReadingMode();

            try {
                await browser.waitUntil(async () => {
                    const state = await getReadingModeFencedDivState();
                    return state.strictPandocMode === true &&
                        state.blockCount === 1 &&
                        state.titleElementCount === 0 &&
                        state.referenceTexts.length === 0 &&
                        state.rawText.includes('@thm:strict');
                }, {
                    timeout: 5000,
                    timeoutMsg: 'Expected strict Pandoc reading mode to preserve raw fenced-div citation text'
                });
            } catch (error) {
                const state = await getReadingModeFencedDivState();
                throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
            }

            const state = await getReadingModeFencedDivState();

            expect(state.blockCount).toBe(1);
            expect(state.headerTexts).toEqual(['']);
            expect(state.titleElementCount).toBe(0);
            expect(state.blockLabels).toEqual(['thm:strict']);
            expect(state.blockClasses[0]).toContain('pem-fenced-div-theorem');
            expect(state.blockTexts[0]).toContain('Strict-mode content.');
            expect(state.blockTexts[0]).not.toContain('Theorem 1');
            expect(state.referenceTexts).toEqual([]);
            expect(state.referenceLabels).toEqual([]);
            expect(state.rawText).toContain('@thm:strict');
            expect(state.rawText).not.toContain('::: {.theorem #thm:strict title="Theorem &"}');
        } finally {
            await setStrictPandocMode(false);
            await deleteFileIfExists(filePath);
        }
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
                    state.headerTexts.join('|') === 'Warning|Danger|Warning2' &&
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
        expect(state.headerTexts).toEqual(['Warning', 'Danger', 'Warning2']);
        expect(state.blockTexts[0]).toContain('This is a warning.');
        expect(state.blockTexts[0]).toContain('This is on the 1st level');
        expect(state.blockTexts[1]).toContain('This is a warning within a warning.');
        expect(state.blockTexts[1]).toContain('This is on the 2nd level');
        expect(state.blockTexts[2]).toContain('This is a warning within a warning within a warning.');
        expect(state.rawText).not.toContain(':::');

        await deleteFileIfExists(filePath);
    });

    it('preserves rendered math inside nested fenced divs in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-math-e2e.md';
        const content = [
            '::: title',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{math block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: nested',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            ':::',
            ':::',
            '',
            '::: normal',
            'Normal',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeFencedDivState();
                return state.blockCount === 3 &&
                    state.fencedDivInlineMathCount === 4 &&
                    state.fencedDivBlockMathCount === 2 &&
                    state.fencedDivLoadedMathCount === 6 &&
                    state.nestedInlineMathCount === 2 &&
                    state.nestedBlockMathCount === 1 &&
                    state.nestedLoadedMathCount === 3 &&
                    !state.rawText.includes(':::');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected rendered inline and block math inside reading-mode fenced divs'
            });
        } catch (error) {
            const state = await getReadingModeFencedDivState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeFencedDivState();
        const outerWidth = state.blockWidths[0];
        const normalWidth = state.blockWidths[2];

        expect(state.blockCount).toBe(3);
        expect(state.headerTexts).toEqual(['Title', 'Nested', 'Normal']);
        expect(state.fencedDivInlineMathCount).toBe(4);
        expect(state.fencedDivBlockMathCount).toBe(2);
        expect(state.fencedDivLoadedMathCount).toBe(6);
        expect(state.nestedInlineMathCount).toBe(2);
        expect(state.nestedBlockMathCount).toBe(1);
        expect(state.nestedLoadedMathCount).toBe(3);
        expect(state.nestedTextOutsideMath).not.toContain('\\tt{inline math}');
        expect(state.nestedTextOutsideMath).not.toContain('\\tt{block}');
        expect(state.nestedTextOutsideMath).not.toContain('tt{inline math}');
        expect(state.nestedTextOutsideMath).not.toContain('tt{block}');
        expect(state.nestedMathDirectText).not.toContain('\\tt{inline math}');
        expect(state.nestedMathDirectText).not.toContain('\\tt{block}');
        expect(state.nestedMathDirectText).not.toContain('tt{inline math}');
        expect(state.nestedMathDirectText).not.toContain('tt{block}');
        if (outerWidth < normalWidth * 0.95) {
            throw new Error(`Expected multiline fenced div width to match normal fenced div width\nState: ${JSON.stringify(state, null, 2)}`);
        }
        expect(state.blockTexts[0]).toContain('Plain content and');
        expect(state.rawText).not.toContain(':::');

        await deleteFileIfExists(filePath);
    });

    it('preserves deeply nested fenced div structure around rendered math in reading mode', async () => {
        const filePath = 'fenced-div-reading-mode-deep-math-e2e.md';
        const content = [
            '::: title',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{math block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: nested',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: Nested Again {}',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: Nested Yet Again {}',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            ':::',
            ':::',
            ':::',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeFencedDivState();
                return state.blockCount === 4 &&
                    state.headerTexts.join('|') === 'Title|Nested|Nested Again|Nested Yet Again' &&
                    state.fencedDivInlineMathCount === 8 &&
                    state.fencedDivBlockMathCount === 4 &&
                    !state.rawText.includes(':::');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected deeply nested reading-mode fenced divs around rendered math'
            });
        } catch (error) {
            const state = await getReadingModeFencedDivState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeFencedDivState();

        expect(state.blockCount).toBe(4);
        expect(state.headerTexts).toEqual(['Title', 'Nested', 'Nested Again', 'Nested Yet Again']);
        expect(state.blockClasses.slice(1).every(className =>
            className.includes('pem-fenced-div-inner')
        )).toBe(true);
        expect(state.blockParentIndices).toEqual([-1, 0, 1, 2]);
        expect(state.fencedDivInlineMathCount).toBe(8);
        expect(state.fencedDivBlockMathCount).toBe(4);
        expect(state.fencedDivLoadedMathCount).toBe(12);
        expect(state.nestedTextOutsideMath).not.toContain('\\tt{inline math}');
        expect(state.nestedTextOutsideMath).not.toContain('\\tt{block}');
        expect(state.rawText).not.toContain(':::');

        await deleteFileIfExists(filePath);
    });
});

async function getReadingModeFencedDivState(): Promise<ReadingModeFencedDivState> {
    return browser.execute((): ReadingModeFencedDivState => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const blocks = Array.from(preview?.querySelectorAll('.pem-fenced-div') ?? []) as HTMLElement[];
        const references = Array.from(preview?.querySelectorAll('.pem-fenced-div-reference') ?? []) as HTMLElement[];
        const fencedDivMath = Array.from(preview?.querySelectorAll('.pem-fenced-div .math') ?? []) as HTMLElement[];
        const nestedBlock = preview?.querySelector('.pem-fenced-div-nested') as HTMLElement | null;
        const previewRect = preview?.getBoundingClientRect();

        return {
            strictPandocMode: plugin?.settings?.strictPandocMode ?? null,
            blockCount: blocks.length,
            fencedDivInlineMathCount: preview?.querySelectorAll('.pem-fenced-div .math-inline').length ?? 0,
            fencedDivBlockMathCount: preview?.querySelectorAll('.pem-fenced-div .math-block').length ?? 0,
            fencedDivLoadedMathCount: preview?.querySelectorAll('.pem-fenced-div .math.is-loaded').length ?? 0,
            fencedDivMathHtml: fencedDivMath.map(math => math.outerHTML),
            nestedInlineMathCount: nestedBlock?.querySelectorAll('.math-inline').length ?? 0,
            nestedBlockMathCount: nestedBlock?.querySelectorAll('.math-block').length ?? 0,
            nestedLoadedMathCount: nestedBlock?.querySelectorAll('.math.is-loaded').length ?? 0,
            nestedMathDirectText: getMathDirectText(nestedBlock),
            nestedTextOutsideMath: getTextOutsideMath(nestedBlock),
            blockWidths: blocks.map(block => block.getBoundingClientRect().width),
            blockParentClasses: blocks.map(block => (block.parentElement as HTMLElement | null)?.className ?? ''),
            blockParentIndices: blocks.map(block => {
                const parentBlock = block.parentElement?.closest('.pem-fenced-div') as HTMLElement | null;
                return parentBlock ? blocks.indexOf(parentBlock) : -1;
            }),
            previewWidth: previewRect?.width ?? 0,
            headerTexts: blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent ?? ''),
            titleElementCount: preview?.querySelectorAll('.pem-fenced-div > .pem-fenced-div-title').length ?? 0,
            blockLabels: blocks.map(block => block.dataset.pandocDivId ?? ''),
            blockClasses: blocks.map(block => block.className),
            blockTexts: blocks.map(block => block.textContent ?? ''),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references.map(reference => reference.dataset.pandocDivRef ?? ''),
            rawText: preview?.textContent ?? '',
            paragraphHtml: Array.from(preview?.querySelectorAll('.el-p') ?? [])
                .map(element => element.innerHTML)
        };

        function getTextOutsideMath(root: HTMLElement | null): string {
            if (!root) return '';
            const clone = root.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('.math, mjx-container').forEach(element => element.remove());
            return clone.textContent ?? '';
        }

        function getMathDirectText(root: HTMLElement | null): string {
            if (!root) return '';
            return Array.from(root.querySelectorAll('.math'))
                .flatMap(math => Array.from(math.childNodes))
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent ?? '')
                .join(' ');
        }
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

async function setStrictPandocMode(value: boolean): Promise<void> {
    await browser.execute(async (strictPandocMode: boolean) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.strictPandocMode = strictPandocMode;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, value);
    await browser.pause(250);
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
