import { browser, expect } from '@wdio/globals';
describe('Code region detection in live preview', () => {
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
                plugin.settings.enableCustomLabelLists = true;
                plugin.saveSettings();
            }
        });
    });

    it('skips inline and fenced code while processing matching syntax outside code', async () => {
        const filePath = 'syntax-tree-code-nodes.md';
        const content = [
            '{::LABEL} Defined label',
            '',
            'Outside reference {::LABEL}.',
            'Inline code `{::LABEL}` should stay raw.',
            '',
            '```js',
            'inside fenced {::LABEL}',
            '```',
            ''
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureSourceMode();

        const state = await browser.execute(() => {
            const content = document.querySelector('.markdown-source-view.mod-cm6 .cm-content');
            const lines = Array.from(content?.querySelectorAll('.cm-line') ?? []) as HTMLElement[];
            const lineContaining = (text: string): HTMLElement | undefined =>
                lines.find(line => line.textContent?.includes(text));

            const selector = '.pem-custom-label-reference-processed, [data-custom-label-ref]';
            const outsideLine = lineContaining('Outside reference');
            const inlineLine = lineContaining('Inline code');
            const fencedLine = lineContaining('inside fenced');

            return {
                outsideReferenceCount: outsideLine?.querySelectorAll(selector).length ?? 0,
                inlineCodeReferenceCount: inlineLine?.querySelectorAll(selector).length ?? 0,
                fencedReferenceCount: fencedLine?.querySelectorAll(selector).length ?? 0,
                inlineCodeText: inlineLine?.textContent ?? '',
                fencedText: fencedLine?.textContent ?? ''
            };
        });

        expect(state.outsideReferenceCount).toBeGreaterThan(0);
        expect(state.inlineCodeReferenceCount).toBe(0);
        expect(state.fencedReferenceCount).toBe(0);
        expect(state.inlineCodeText).toContain('{::LABEL}');
        expect(state.fencedText).toContain('{::LABEL}');

        await deleteFileIfExists(filePath);
    });
});

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute((filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            app.vault.delete(existing);
        }
        // @ts-ignore
        app.vault.create(filePath, data);
        return true;
    }, path, content);
}

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute((filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            return app.workspace.getLeaf().openFile(file);
        }
        return false;
    }, path);
}

async function ensureSourceMode(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view && view.getMode && view.getMode() !== 'source') {
                // @ts-ignore
                view.setMode('source');
            }
        }
    });
    await browser.pause(500);
}

async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute((filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            app.vault.delete(file);
        }
    }, path);
}
