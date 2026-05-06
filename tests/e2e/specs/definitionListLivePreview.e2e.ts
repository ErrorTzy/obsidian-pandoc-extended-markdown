import { browser, expect } from '@wdio/globals';

describe('Definition list live preview', () => {
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
            if (plugin?.settings) {
                plugin.settings.enableDefinitionLists = true;
                plugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('shows source definition marker text when a selection range intersects it', async () => {
        const filePath = 'definition-list-live-preview-selection.md';
        const content = 'Description Term\n: details1';

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await waitForDefinitionMarkerWidget();

        const beforeSelection = await getDefinitionMarkerRenderState();

        expect(beforeSelection.markerWidgets).toBeGreaterThanOrEqual(1);
        expect(beforeSelection.cursorMarkers).toBe(0);

        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            const view = leaf?.view;
            const cm = view?.editor?.cm;
            if (!cm) {
                return;
            }

            const termLine = cm.state.doc.line(1);
            const definitionLine = cm.state.doc.line(2);
            cm.dispatch({
                selection: {
                    anchor: termLine.from,
                    head: definitionLine.from + 2
                }
            });
            cm.focus();
        });

        await browser.waitUntil(async () => {
            const state = await getDefinitionMarkerRenderState();
            return state.cursorMarkers >= 1 && state.markerWidgets === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected selected definition marker to render as source text'
        });

        const selectedState = await getDefinitionMarkerRenderState();

        expect(selectedState.definitionLineText).toContain(': details1');
        expect(selectedState.cursorMarkerText).toContain(':');
        expect(selectedState.markerWidgets).toBe(0);

        await deleteFileIfExists(filePath);
    });
});

async function waitForDefinitionMarkerWidget(): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getDefinitionMarkerRenderState();
        return state.markerWidgets >= 1;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected definition marker widget in live preview'
    });
}

async function getDefinitionMarkerRenderState(): Promise<{
    markerWidgets: number;
    cursorMarkers: number;
    definitionLineText: string;
    cursorMarkerText: string;
}> {
    return browser.execute(() => {
        const definitionLine = Array.from(document.querySelectorAll('.cm-line'))
            .find(line => line.textContent?.includes('details1')) as HTMLElement | undefined;
        const cursorMarkers = Array.from(document.querySelectorAll('.cm-pem-definition-marker-cursor')) as HTMLElement[];

        return {
            markerWidgets: document.querySelectorAll('.cm-line .pem-list-marker').length,
            cursorMarkers: cursorMarkers.length,
            definitionLineText: definitionLine?.textContent ?? '',
            cursorMarkerText: cursorMarkers.map(marker => marker.textContent ?? '').join('')
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
        if (!leaf) {
            return;
        }

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
