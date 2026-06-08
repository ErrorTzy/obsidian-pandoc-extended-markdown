import { browser, expect } from '@wdio/globals';

describe('Ordered list autocompletion', () => {
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
                enabledPlugin.settings.enableFancyLists = true;
                enabledPlugin.settings.enableOrderedListMarkerCycling = true;
                enabledPlugin.settings.autoRenumberLists = true;
                await enabledPlugin.saveSettings();
            }
        });
    });

    it('removes an auto-created bridge decimal-period marker on the second Enter', async () => {
        await openEditableDocument(
            'ordered-list-bridge-decimal-enter.md',
            'I) parent\n    1. child'
        );
        await placeCursorAtDocumentEnd();

        await browser.keys('Enter');
        await browser.pause(500);
        expect(await getEditorText()).toContain('    2. ');

        await browser.keys('Enter');
        await browser.pause(300);

        const text = await getEditorText();
        expect(text).not.toContain('\n    2. ');
        expect(text.split('\n')).toEqual([
            'I) parent',
            '    1. child',
            '    '
        ]);
    });

    it('keeps a first nested lower-roman marker roman after continuing the child list', async () => {
        await openEditableDocument(
            'ordered-list-roman-renumbering.md',
            [
                'a. earlier parent',
                '    h. unrelated alphabetic child',
                'b. parent'
            ].join('\n')
        );
        await placeCursorAtDocumentEnd();

        await browser.keys('Enter');
        await browser.keys('Tab');

        await browser.waitUntil(async () => {
            const text = await getEditorText();
            return text.endsWith('    i. ');
        }, {
            timeout: 3000,
            timeoutMsg: 'Expected Tab after a lower-alpha item to create a lower-roman child marker'
        });

        await browser.keys('child');
        await browser.keys('Enter');
        await browser.pause(500);

        expect(await getEditorText()).toBe([
            'a. earlier parent',
            '    h. unrelated alphabetic child',
            'b. parent',
            '    i. child',
            '    ii. '
        ].join('\n'));
    });

    it('treats an ambiguous i marker after a blank line as an independent roman list chunk', async () => {
        await openEditableDocument(
            'ordered-list-blank-line-roman.md',
            [
                'a. xxx',
                '',
                'i. xxx'
            ].join('\n')
        );
        await placeCursorAtDocumentEnd();

        await browser.keys('Enter');
        await browser.pause(500);

        expect(await getEditorText()).toBe([
            'a. xxx',
            '',
            'i. xxx',
            'ii. '
        ].join('\n'));
    });
});

async function openEditableDocument(filePath: string, content: string): Promise<void> {
    await browser.execute(async (path, data) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
            // @ts-ignore
            await app.vault.modify(file, data);
        } else {
            // @ts-ignore
            await app.vault.create(path, data);
        }
    }, filePath, content);

    await browser.execute(async (path) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            return;
        }

        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
    }, filePath);

    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
    await contentEl.click();
    await browser.pause(300);
}

async function placeCursorAtDocumentEnd(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        cm.dispatch({
            selection: { anchor: cm.state.doc.length }
        });
        cm.focus();
    });
}

async function getEditorText(): Promise<string> {
    return browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        return cm?.state.doc.toString() ?? '';
    });
}
