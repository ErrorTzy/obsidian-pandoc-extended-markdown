import { browser, expect } from '@wdio/globals';

describe('Definition list autocompletion behavior', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await configureDefinitionListSettings();
    });

    beforeEach(async () => {
        await configureDefinitionListSettings();
    });

    it('removes an empty definition marker with a trailing marker space after a term line', async () => {
        await openEditableDocument('definition-list-autocompletion-empty-with-space.md', 'Term 1\n: ');
        await placeCursorAtDocumentEnd();

        await pressKey('Enter');

        expect(await getEditorTextWithSelectionMarkers()).toBe('Term 1\n|');
        expect(await getListAutocompletionFailureNotices()).toEqual([]);
    });

    it('removes an empty definition marker without a trailing marker space after a term line', async () => {
        await openEditableDocument('definition-list-autocompletion-empty-without-space.md', 'Term 1\n:');
        await placeCursorAtDocumentEnd();

        await pressKey('Enter');

        expect(await getEditorTextWithSelectionMarkers()).toBe('Term 1\n|');
        expect(await getListAutocompletionFailureNotices()).toEqual([]);
    });
});

async function configureDefinitionListSettings(): Promise<void> {
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
            Object.assign(enabledPlugin.settings, {
                enableDefinitionLists: true,
                enableFancyLists: true,
                enableExampleLists: true,
                enableHashAutoNumber: true,
                enableOrderedListMarkerCycling: true,
                enableUnorderedListMarkerCycling: true,
                autoRenumberLists: true,
                enforcePandocListSpacing: false
            });
            await enabledPlugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
}

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

async function getEditorTextWithSelectionMarkers(): Promise<string> {
    return browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return '';
        }

        const text = cm.state.doc.toString();
        const selection = cm.state.selection.main;
        const from = Math.min(selection.anchor, selection.head);
        const to = Math.max(selection.anchor, selection.head);

        if (from === to) {
            return `${text.slice(0, from)}|${text.slice(from)}`;
        }

        return `${text.slice(0, from)}[${text.slice(from, to)}]${text.slice(to)}`;
    });
}

async function getListAutocompletionFailureNotices(): Promise<string[]> {
    return browser.execute(() => {
        return Array.from(document.querySelectorAll('.notice'))
            .map(notice => notice.textContent ?? '')
            .filter(text => text.includes('list autocompletion failed'));
    });
}

async function pressKey(key: string, pauseMs = 300): Promise<void> {
    await browser.keys(key);
    await browser.pause(pauseMs);
}
