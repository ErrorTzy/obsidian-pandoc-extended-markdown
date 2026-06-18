import { browser, expect } from '@wdio/globals';

interface EditorScrollState {
    activeLineText: string;
    activeLineTop: number;
    scrollTop: number;
}

const filePath = 'list-tab-scroll-position.md';
const leadingLines = Array.from({ length: 120 }, (_, index) => `Paragraph ${index + 1}`);

const tabContent = [
    ...leadingLines,
    '',
    '+ xxx',
    '    * xxx',
    '',
    '- xxx',
    '- '
].join('\n');

const orderedEnterContent = [
    ...leadingLines,
    '',
    '1. xxx',
    '2. xxx'
].join('\n');

const emptyNestedEnterContent = [
    ...leadingLines,
    '',
    '1. xxx',
    '2. xxx',
    '    a. xxx',
    '    b. '
].join('\n');

describe('List editing scroll position', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setListSettings();
    });

    after(async () => {
        await deleteFileIfExists(filePath);
    });

    it('does not scroll to the top when indenting a list item with Tab', async () => {
        await openContentAtLastLine(tabContent);

        await browser.waitUntil(async () => {
            const state = await getEditorScrollState();
            return state.activeLineText === '- ' && state.scrollTop > 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the target list item to be visible below the top of the editor'
        });

        const before = await getEditorScrollState();
        expect(before.activeLineText).toBe('- ');
        expect(before.scrollTop).toBeGreaterThan(0);

        await browser.keys('Tab');
        await browser.pause(500);

        const after = await getEditorScrollState();
        expect(after.activeLineText.trim()).toBe('+');
        expect(after.scrollTop).toBeGreaterThan(0);
        expect(Math.abs(after.activeLineTop - before.activeLineTop)).toBeLessThan(80);
    });

    it('does not scroll to the top when continuing an ordered list item with Enter', async () => {
        await openContentAtLastLine(orderedEnterContent);

        await browser.waitUntil(async () => {
            const state = await getEditorScrollState();
            return state.activeLineText.includes('xxx') && state.scrollTop > 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the ordered list item to be visible below the top of the editor'
        });

        const before = await getEditorScrollState();
        expect(before.scrollTop).toBeGreaterThan(0);

        await browser.keys('Enter');
        await browser.pause(500);

        const after = await getEditorScrollState();
        expect(after.activeLineText.trim()).toBe('3.');
        expect(after.scrollTop).toBeGreaterThan(0);
        expect(Math.abs(after.activeLineTop - before.activeLineTop)).toBeLessThan(80);
    });

    it('does not scroll to the top when returning an empty ordered child item with Enter', async () => {
        await openContentAtLastLine(emptyNestedEnterContent);

        await browser.waitUntil(async () => {
            const state = await getEditorScrollState();
            return state.activeLineText === '    b. ' && state.scrollTop > 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the empty nested ordered item to be visible below the top of the editor'
        });

        const before = await getEditorScrollState();
        expect(before.activeLineText).toBe('    b. ');
        expect(before.scrollTop).toBeGreaterThan(0);

        await browser.keys('Enter');
        await browser.pause(500);

        const after = await getEditorScrollState();
        expect(after.activeLineText.trim()).toBe('3.');
        expect(after.scrollTop).toBeGreaterThan(0);
        expect(Math.abs(after.activeLineTop - before.activeLineTop)).toBeLessThan(80);
    });
});

async function openContentAtLastLine(content: string): Promise<void> {
    await createOrReplaceFile(filePath, content);
    await openFileInActiveLeaf(filePath);
    await ensureLivePreviewMode();
    await moveCursorToEndOfLastLine();
}

async function setListSettings(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            Object.assign(plugin.settings, {
                enableFancyLists: true,
                enableOrderedListMarkerCycling: true,
                enableUnorderedListMarkerCycling: true,
                autoRenumberLists: true,
                unorderedListMarkerOrder: ['-', '+', '*']
            });
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
    await browser.pause(300);
}

async function createOrReplaceFile(path: string, data: string): Promise<void> {
    await browser.execute(async (filePath: string, fileContent: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, fileContent);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, fileContent);
    }, path, data);
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

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
        // @ts-ignore
        app.workspace.updateOptions();
    });
    await browser.pause(500);
}

async function moveCursorToEndOfLastLine(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) return;

        const line = cm.state.doc.line(cm.state.doc.lines);
        cm.dispatch({
            selection: { anchor: line.to },
            effects: [cm.constructor.scrollIntoView(line.to, { y: 'center' })]
        });
        cm.focus();
    });
    await browser.pause(500);
}

async function getEditorScrollState(): Promise<EditorScrollState> {
    return browser.execute((): EditorScrollState => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        const activeLine = document.querySelector('.markdown-source-view .cm-line.cm-active') as HTMLElement | null;

        return {
            activeLineText: activeLine?.textContent ?? '',
            activeLineTop: activeLine?.getBoundingClientRect().top ?? 0,
            scrollTop: cm?.scrollDOM?.scrollTop ?? 0
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
