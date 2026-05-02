import { browser, expect } from '@wdio/globals';

interface ActiveLineRenderState {
    error?: string;
    lineClass: string;
    lineText: string;
    headerCount: number;
    closingWidgetCount: number;
    selectionHead: number;
}

describe('Fenced div edit boundary', () => {
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
            if (plugin && plugin.settings) {
                plugin.settings.enableFencedDivs = true;
                plugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('keeps a typed fenced div opener as source text while the cursor remains at line end', async () => {
        const filePath = 'fenced-div-edit-boundary-typing.md';

        await createOrReplaceFile(filePath, '');
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await focusEditorAtDocumentStart();

        await browser.keys('::: exam');

        await browser.waitUntil(async () => {
            const state = await getActiveLineRenderState();
            return !state.error &&
                state.lineText.includes('::: exam') &&
                state.lineClass.includes('cm-pem-fenced-div-open') &&
                state.headerCount === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected typed fenced div opener to remain raw source while active'
        });

        const state = await getActiveLineRenderState();

        if (state.error) {
            throw new Error(state.error);
        }

        expect(state.lineText).toContain('::: exam');
        expect(state.lineClass).toContain('cm-active');
        expect(state.lineClass).toContain('cm-pem-fenced-div-open');
        expect(state.headerCount).toBe(0);
        expect(state.selectionHead).toBe(8);

        await deleteFileIfExists(filePath);
    });

    it('keeps a closing fence as source text while the cursor is at line end', async () => {
        const filePath = 'fenced-div-edit-boundary-closing.md';
        const content = [
            '::: example',
            'This is example 1',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLineEnd(3);

        await browser.waitUntil(async () => {
            const state = await getActiveLineRenderState();
            return !state.error &&
                state.lineText.includes(':::') &&
                state.lineClass.includes('cm-pem-fenced-div-close') &&
                state.closingWidgetCount === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected closing fence to remain raw source while active at line end'
        });

        const state = await getActiveLineRenderState();

        if (state.error) {
            throw new Error(state.error);
        }

        expect(state.lineText).toContain(':::');
        expect(state.lineClass).toContain('cm-active');
        expect(state.lineClass).toContain('cm-pem-fenced-div-close');
        expect(state.closingWidgetCount).toBe(0);

        await deleteFileIfExists(filePath);
    });
});

async function getActiveLineRenderState(): Promise<ActiveLineRenderState> {
    return browser.execute((): ActiveLineRenderState => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return {
                error: 'missing-codemirror',
                lineClass: '',
                lineText: '',
                headerCount: 0,
                closingWidgetCount: 0,
                selectionHead: -1
            };
        }

        const activeLine = document.querySelector('.cm-line.cm-active') as HTMLElement | null;

        return {
            lineClass: activeLine?.className ?? '',
            lineText: activeLine?.textContent ?? '',
            headerCount: activeLine?.querySelectorAll('.pem-fenced-div-header').length ?? 0,
            closingWidgetCount: activeLine?.querySelectorAll('.pem-fenced-div-closing').length ?? 0,
            selectionHead: cm.state.selection.main.head
        };
    });
}

async function moveCursorToLineEnd(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({
            selection: { anchor: line.to }
        });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
}

async function focusEditorAtDocumentStart(): Promise<void> {
    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
    await contentEl.click();

    await browser.execute(() => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        cm.dispatch({
            selection: { anchor: 0 }
        });
        cm.focus();
    });
    await browser.pause(250);
}

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, data);
        } else {
            // @ts-ignore
            await app.vault.create(filePath, data);
        }
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
    await browser.pause(500);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        if (leaf) {
            const state = leaf.getViewState();
            state.state = {
                ...(state.state ?? {}),
                mode: 'source',
                source: false
            };
            await leaf.setViewState(state);
            // @ts-ignore
            app.workspace.updateOptions();
        }
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
