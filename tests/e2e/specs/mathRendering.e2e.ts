import { browser, $, $$ } from '@wdio/globals';

describe('Math Expression Rendering Bug', () => {
    before(async () => {
        // Load the test vault
        await browser.reloadObsidian({
            vault: "./tests/e2e/vaults/test-vault"
        });
        
        // Ensure plugin is enabled
        await browser.execute(() => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                return app.plugins.enablePlugin('pandoc-extended-markdown');
            }
            if (plugin && plugin.settings) {
                plugin.settings.moreExtendedSyntax = true;
                plugin.settings.enableExampleLists = true;
                plugin.settings.enableFancyLists = true;
                plugin.settings.enableHashAutoNumber = true;
                plugin.saveSettings();
            }
        });
    });

    it('should not interfere with math expressions containing superscripts', async () => {
        // Create a test file with the problematic content
        const testContent = `> Given $R^{+}_{xy}$ and $R^{+}_{yz}$, if x=y or y=z, obviously we have $R^{+}_{xz}$`;
        
        await browser.execute((content) => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('math-bug-test.md');
            if (file) {
                // @ts-ignore
                app.vault.delete(file);
            }
            // @ts-ignore
            app.vault.create('math-bug-test.md', content);
            return true; // Return simple value to avoid circular reference
        }, testContent);
        
        // Open the file
        await browser.execute(() => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('math-bug-test.md');
            // @ts-ignore
            return app.workspace.getLeaf().openFile(file);
        });
        
        await browser.pause(500);

        // Ensure we're in live preview mode
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

        // Get the rendered HTML in live preview
        const livePreviewHTML = await browser.execute(() => {
            const container = document.querySelector('.markdown-source-view.mod-cm6 .cm-content');
            if (!container) return 'Container not found';
            
            // Find the line with our content
            const lines = container.querySelectorAll('.cm-line');
            for (const line of lines) {
                const html = (line as HTMLElement).innerHTML;
                if (html.includes('Given') || html.includes('xy')) {
                    console.log('Found line HTML:', html);
                    return html;
                }
            }
            
            // If not found, return all lines for debugging
            const allLines = Array.from(lines).map(l => (l as HTMLElement).innerHTML);
            return 'Line not found. All lines: ' + JSON.stringify(allLines);
        });

        console.log('Live Preview HTML:', livePreviewHTML);

        // Check if the bug is present - superscript widgets interrupting math
        const hasBug = livePreviewHTML.includes('pem-superscript') && 
                      livePreviewHTML.includes('class="math"');
        
        // Log details for debugging
        if (hasBug) {
            console.log('BUG DETECTED: Math expressions are being interrupted by superscript widgets');
        }
        
        // The bug manifests as the math being broken up with pem-superscript widgets
        // So we check if pem-superscript appears in what should be pure math rendering
        expect(livePreviewHTML).toContain('math'); // Math should be rendered
        
        // If our fix works, there should be NO pem-superscript in this line
        // because the entire line should be protected as math expressions
        if (livePreviewHTML.includes('pem-superscript')) {
            console.log('FAILURE: Superscript processor is still interfering with math!');
            throw new Error('Math expressions are being broken by superscript processor');
        } else {
            console.log('SUCCESS: Math expressions are properly protected from superscript processing!');
        }

        // Clean up
        await browser.execute(() => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('math-bug-test.md');
            if (file) {
                // @ts-ignore
                return app.vault.delete(file);
            }
        });
    });

});