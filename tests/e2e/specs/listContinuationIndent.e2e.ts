import { browser } from '@wdio/globals';

describe('List continuation indentation', () => {
    before(async () => {
        // Load the test vault
        await browser.reloadObsidian({
            vault: "./tests/e2e/vaults/test-vault"
        });

        // Ensure plugin is enabled with required settings
        await browser.execute(() => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                return app.plugins.enablePlugin('pandoc-extended-markdown');
            }
            if (plugin && plugin.settings) {
                plugin.settings.moreExtendedSyntax = true;
                plugin.settings.enableFancyLists = true;
                plugin.settings.enableHashAutoNumber = true;
                plugin.settings.enableExampleLists = true;
                plugin.saveSettings();
            }
        });
    });

    it('keeps continuation indentation while actively editing', async () => {
        const filePath = 'list-continuation-indent.md';
        const initialContent = 'A.  first line';

        // Create or overwrite the file with the starting content
        await browser.execute((path, content) => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(path);
            if (file) {
                // @ts-ignore
                app.vault.modify(file, content);
            } else {
                // @ts-ignore
                app.vault.create(path, content);
            }
        }, filePath, initialContent);

        // Open the file in the active leaf
        await browser.execute((path) => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(path);
            if (file) {
                // @ts-ignore
                app.workspace.getLeaf().openFile(file);
            }
        }, filePath);

        await browser.pause(500);

        // Ensure we are in live preview (source) mode
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

        // Focus the editor and place the cursor at the end of the first line
        const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
        await contentEl.waitForExist({ timeout: 2000 });
        await contentEl.click();

        await browser.execute(() => {
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            if (leaves.length === 0) {
                return;
            }
            const view = leaves[0].view;
            if (!view || !view.editor || !view.editor.cm) {
                return;
            }

            // @ts-ignore - CM6 editor access
            const cm = view.editor.cm;
            const doc = cm.state.doc;
            const firstLine = doc.line(1);
            const insertPos = firstLine.to;

            cm.dispatch({
                selection: { anchor: insertPos }
            });
            cm.focus();
        });

        await browser.pause(500);

        // Simulate Shift+Enter to create a continuation line, then type content
        await browser.keys(['Shift', 'Enter', 'NULL']);
        await browser.pause(200);
        await browser.keys('continuation line');
        await browser.pause(500);

        // Capture style information for the active continuation line
        const styleInfo = await browser.execute(() => {
            const lines = document.querySelectorAll('.cm-line.cm-active');
            for (const line of Array.from(lines)) {
                const el = line as HTMLElement;
                if (el.textContent && el.textContent.includes('continuation line')) {
                    const computed = window.getComputedStyle(el);
                    const contentSpan = el.querySelector('.cm-list-1, .cm-list-2, .cm-list-3');
                    let contentOffset = -1;
                    if (contentSpan) {
                        const lineRect = el.getBoundingClientRect();
                        const contentRect = (contentSpan as HTMLElement).getBoundingClientRect();
                        contentOffset = contentRect.left - lineRect.left;
                    }
                    const widget = el.querySelector('.pem-list-continuation-widget') as HTMLElement | null;
                    return {
                        paddingInlineStart: computed.paddingInlineStart,
                        textIndent: computed.textIndent,
                        className: el.className,
                        styleAttr: el.getAttribute('style') || '',
                        contentOffset,
                        widgetWidth: widget ? widget.getBoundingClientRect().width : -1
                    };
                }
            }
            return null;
        });

        expect(styleInfo).toBeTruthy();

        const paddingValue = styleInfo ? parseFloat(styleInfo.paddingInlineStart) : 0;

        // Expect the continuation line to keep a padding of at least 20px while editing
        expect(paddingValue).toBeGreaterThanOrEqual(24);

        if (styleInfo) {
            const contentOffsetValue = styleInfo.contentOffset ?? -1;
            expect(contentOffsetValue).toBeGreaterThanOrEqual(24);
            expect(styleInfo.widgetWidth).toBeGreaterThanOrEqual(24);
        }

        // No additional assertions; inactive line behavior is handled by Obsidian defaults
    });
});
