import { browser, expect } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

interface ScrollRenderState {
    selectionLine: number;
    viewportFromLine: number;
    viewportToLine: number;
    targetVisible: boolean;
    targetText: string;
    targetSuperscriptCount: number;
    targetSubscriptCount: number;
}

const filePath = 'long-document-scroll-rendering.md';
const content = createLongDocumentContent();

describe('Long document scroll rendering', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await configurePluginForScrollRendering();
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await deleteFileIfExists(filePath);
    });

    it('renders the scrolled viewport while the selection remains near the top', async function () {
        this.timeout(30000);

        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await waitForEditor();
        await moveSelectionToLine(1);

        await scrollToLineWithoutSelecting(900);
        await waitForRenderedLine(900);

        const firstScroll = await getScrollRenderState(900);
        expect(firstScroll.selectionLine).toBe(1);
        expect(firstScroll.viewportFromLine).toBeLessThanOrEqual(900);
        expect(firstScroll.viewportToLine).toBeGreaterThanOrEqual(900);
        expect(firstScroll.targetSuperscriptCount).toBeGreaterThan(0);
        expect(firstScroll.targetSubscriptCount).toBeGreaterThan(0);

        await scrollToLineWithoutSelecting(1000);
        await browser.pause(20);
        await scrollToLineWithoutSelecting(1100);
        await waitForRenderedLine(1100);

        const finalScroll = await getScrollRenderState(1100);
        expect(finalScroll.selectionLine).toBe(1);
        expect(finalScroll.viewportFromLine).toBeLessThanOrEqual(1100);
        expect(finalScroll.viewportToLine).toBeGreaterThanOrEqual(1100);
        expect(finalScroll.targetSuperscriptCount).toBeGreaterThan(0);
        expect(finalScroll.targetSubscriptCount).toBeGreaterThan(0);
    });
});

function createLongDocumentContent(): string {
    return Array.from({ length: 1200 }, (_value, index) => {
        const lineNumber = index + 1;
        if (lineNumber === 1) {
            return 'Cursor anchor line';
        }
        if (lineNumber === 900) {
            return 'Scroll target 900 with ^visible900^ and H~2~O';
        }
        if (lineNumber === 1100) {
            return 'Scroll target 1100 with ^visible1100^ and CO~2~';
        }
        return `Filler paragraph ${lineNumber}`;
    }).join('\n');
}

async function configurePluginForScrollRendering(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        let plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            plugin = app.plugins.plugins['pandoc-extended-markdown'];
        }

        if (plugin?.settings) {
            plugin.settings.enableListsWithoutPrecedingBlankline = true;
            plugin.settings.enableSuperscript = true;
            plugin.settings.enableSubscript = true;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
    await browser.pause(300);
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

async function waitForEditor(): Promise<void> {
    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
}

async function moveSelectionToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLine: number) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) return;

        const line = cm.state.doc.line(targetLine);
        cm.dispatch({
            selection: { anchor: line.from },
            effects: [cm.constructor.scrollIntoView(line.from, { y: 'center' })]
        });
        cm.focus();
    }, lineNumber);
    await waitForEditorFrames();
}

async function scrollToLineWithoutSelecting(lineNumber: number): Promise<void> {
    await browser.execute((targetLine: number) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const line = cm.state.doc.line(targetLine);
        cm.dispatch({
            effects: [cm.constructor.scrollIntoView(line.from, { y: 'center' })]
        });
    }, lineNumber);
    await waitForEditorFrames();
}

async function waitForRenderedLine(lineNumber: number): Promise<void> {
    try {
        await browser.waitUntil(async () => {
            const state = await getScrollRenderState(lineNumber);
            return state.selectionLine === 1 &&
                state.targetVisible &&
                state.targetSuperscriptCount > 0 &&
                state.targetSubscriptCount > 0;
        }, {
            timeout: 2000,
            interval: 25,
            timeoutMsg: `Expected line ${lineNumber} to render plugin syntax after scrolling`
        });
    } catch (error) {
        const state = await getScrollRenderState(lineNumber);
        throw new Error(
            `Expected line ${lineNumber} to render plugin syntax after scrolling: ${JSON.stringify(state)}`,
            { cause: error }
        );
    }
}

async function getScrollRenderState(lineNumber: number): Promise<ScrollRenderState> {
    return browser.execute((targetLine: number): ScrollRenderState => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const targetText = `Scroll target ${targetLine}`;
        const targetElement = Array.from(document.querySelectorAll('.markdown-source-view .cm-line'))
            .find(line => line.textContent?.includes(targetText)) as HTMLElement | undefined;
        const viewportTo = Math.max(cm.viewport.from, cm.viewport.to - 1);

        return {
            selectionLine: cm.state.doc.lineAt(cm.state.selection.main.head).number,
            viewportFromLine: cm.state.doc.lineAt(cm.viewport.from).number,
            viewportToLine: cm.state.doc.lineAt(viewportTo).number,
            targetVisible: Boolean(targetElement),
            targetText: targetElement?.textContent ?? '',
            targetSuperscriptCount: targetElement?.querySelectorAll('sup.pem-superscript').length ?? 0,
            targetSubscriptCount: targetElement?.querySelectorAll('sub.pem-subscript').length ?? 0
        };
    }, lineNumber);
}

async function waitForEditorFrames(): Promise<void> {
    await browser.execute(async () => {
        await new Promise<void>(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
    });
}
