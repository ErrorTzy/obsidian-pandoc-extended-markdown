import { browser, expect } from '@wdio/globals';

describe('Definition list semantic HTML in reading mode', () => {
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
            }
        });
    });

    it('renders markdown definition list terms inside dt without a stray br', async () => {
        const markdown = `DefinitionTerm
: DefinitionItem`;
        const expectedHtml = '<dl class="pem-definition-list"><dt class="pem-definition-term">DefinitionTerm</dt><dd class="pem-list-definition-desc">DefinitionItem</dd></dl>';

        await createOrReplaceFile('definition-list-semantic-e2e.md', markdown);
        await openFileInActiveLeaf('definition-list-semantic-e2e.md');
        await ensureReadingMode();

        const html = await browser.execute(() => {
            const definitionList = document.querySelector('.markdown-preview-view .pem-definition-list');
            const paragraph = definitionList?.closest('p');
            return {
                paragraphHtml: paragraph?.innerHTML ?? '',
                termText: definitionList?.querySelector('dt')?.textContent ?? '',
                hasStrayBreak: Boolean(paragraph?.querySelector(':scope > br'))
            };
        });

        expect(html.paragraphHtml).toBe(expectedHtml);
        expect(html.termText).toBe('DefinitionTerm');
        expect(html.hasStrayBreak).toBe(false);

        await deleteFileIfExists('definition-list-semantic-e2e.md');
    });
});

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
        state.state.mode = 'preview';
        // @ts-ignore
        await leaf.setViewState(state);
    });
    await browser.waitUntil(async () => {
        const hasPreview = await browser.execute(() =>
            Boolean(document.querySelector('.markdown-preview-view'))
        );
        return hasPreview;
    }, { timeout: 5000 });
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
