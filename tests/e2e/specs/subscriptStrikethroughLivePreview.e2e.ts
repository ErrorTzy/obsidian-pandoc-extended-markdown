import { browser, expect } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

interface LivePreviewSubscriptState {
    subscriptLineSubscriptCount: number;
    strikethroughLineSubscriptCount: number;
    strikethroughLineText: string;
}

const filePath = 'subscript-strikethrough-live-preview-e2e.md';
const content = [
    'Subscript: H~2~O',
    'Strikethrough: ~~deleted~~',
    'Cursor guard line'
].join('\n');

describe('Live Preview subscript and strikethrough', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSubscriptEnabled();
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await deleteFileIfExists(filePath);
    });

    it('does not render Markdown strikethrough as subscript', async () => {
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(3);

        await browser.waitUntil(async () => {
            const state = await getSubscriptState();
            return state.subscriptLineSubscriptCount === 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected regular subscript to render in Live Preview'
        });

        const state = await getSubscriptState();

        expect(state.subscriptLineSubscriptCount).toBe(1);
        expect(state.strikethroughLineText).toContain('deleted');
        expect(state.strikethroughLineSubscriptCount).toBe(0);
    });
});

async function setSubscriptEnabled(): Promise<void> {
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
            plugin.settings.strictPandocMode = false;
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

async function moveCursorToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const cm = leaf?.view?.editor?.cm;
        if (!cm) return;
        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({ selection: { anchor: line.from } });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
}

async function getSubscriptState(): Promise<LivePreviewSubscriptState> {
    return browser.execute((): LivePreviewSubscriptState => {
        const lines = Array.from(document.querySelectorAll('.cm-line')) as HTMLElement[];
        const subscriptLine = lines.find(line => line.textContent?.includes('Subscript:')) ?? null;
        const strikethroughLine = lines.find(line => line.textContent?.includes('Strikethrough:')) ?? null;

        return {
            subscriptLineSubscriptCount: subscriptLine?.querySelectorAll('sub.pem-subscript').length ?? 0,
            strikethroughLineSubscriptCount: strikethroughLine?.querySelectorAll('sub.pem-subscript').length ?? 0,
            strikethroughLineText: strikethroughLine?.textContent ?? ''
        };
    });
}
