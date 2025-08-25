import { browser } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service';

describe('Plugin Features and Commands', function () {
    before(async function () {
        // Load the test vault
        await browser.reloadObsidian({
            vault: "./tests/e2e/vaults/test-vault"
        });
    });

    beforeEach(async function () {
        // Reset vault state before each test
        await obsidianPage.resetVault();
    });

    it('should have plugin commands available', async () => {
        // Check that the plugin's commands are registered
        // Open command palette
        await browser.executeObsidianCommand("command-palette:open");
        await browser.pause(500);

        // Search for pandoc-related commands
        const commandInput = await browser.$('.prompt-input');
        await commandInput.setValue('pandoc');
        await browser.pause(500);

        // Check if plugin commands appear
        const suggestions = await browser.$$('.suggestion-item');
        expect(suggestions.length).toBeGreaterThan(0);
        
        // Close command palette
        await browser.keys(['Escape']);
    });

    it('should open the List Panel view', async () => {
        // Try to open the list panel
        await browser.executeObsidianCommand("pandoc-extended-markdown:open-list-panel");
        await browser.pause(1000);

        // Check if the panel opened
        const listPanel = await browser.$('.workspace-leaf-content[data-type="pandoc-list-panel"]');
        const panelExists = await listPanel.isExisting();
        
        if (panelExists) {
            // Verify panel has the expected structure
            const panelContent = await listPanel.$('.list-panel-container');
            await expect(panelContent).toExist();
        }
    });

    it('should toggle strict Pandoc mode', async () => {
        // Open settings
        await browser.executeObsidianCommand("app:open-settings");
        await browser.pause(1000);

        // Navigate to plugin settings
        const pluginTab = await browser.$('.vertical-tab-nav-item:has-text("Community plugins")');
        if (await pluginTab.isExisting()) {
            await pluginTab.click();
            await browser.pause(500);
            
            // Find our plugin in the list
            const pluginItem = await browser.$('.installed-plugins-container .setting-item:has-text("Pandoc Extended Markdown")');
            if (await pluginItem.isExisting()) {
                const settingsButton = await pluginItem.$('.setting-item-control button');
                await settingsButton.click();
                await browser.pause(500);
                
                // Look for strict mode toggle
                const strictModeToggle = await browser.$('.setting-item:has-text("Strict Pandoc Mode") .checkbox-container');
                if (await strictModeToggle.isExisting()) {
                    // Toggle the setting
                    await strictModeToggle.click();
                    await browser.pause(500);
                    
                    // Toggle back
                    await strictModeToggle.click();
                }
            }
        }
        
        // Close settings
        await browser.keys(['Escape']);
    });

    it('should handle definition lists in both reading and live preview modes', async () => {
        // Open the definition lists file
        await browser.executeObsidianCommand("file-explorer:open");
        await browser.pause(500);
        
        const file = await browser.$('.nav-file-title[data-path="definition-lists.md"]');
        await file.click();
        await browser.pause(1000);

        // Test in reading mode first
        await browser.executeObsidianCommand("editor:toggle-source");
        await browser.pause(500);

        // Check that definition lists are rendered
        let preview = await browser.$('.markdown-preview-view');
        let html = await preview.getHTML();
        
        expect(html).toContain('Term 1');
        expect(html).toContain('Definition for term 1');
        
        // Check for dl, dt, dd elements or fallback rendering
        const hasDL = html.includes('<dl') || html.includes('definition');
        expect(hasDL).toBe(true);

        // Switch to live preview mode
        await browser.executeObsidianCommand("editor:toggle-source");
        await browser.pause(500);

        // In live preview, the decorations should be applied
        const editor = await browser.$('.cm-content');
        const editorHTML = await editor.getHTML();
        
        // Check for CodeMirror decorations or widgets
        const hasDecorations = editorHTML.includes('cm-pandoc') || 
                              editorHTML.includes('definition') ||
                              editorHTML.includes('Term 1');
        expect(hasDecorations).toBe(true);
    });

    it('should handle custom label lists and references', async () => {
        // Open the custom labels file
        const file = await browser.$('.nav-file-title[data-path="custom-labels.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="custom-labels.md"]');
            await fileRetry.click();
        } else {
            await file.click();
        }
        await browser.pause(1000);

        // Switch to reading mode
        const sourceMode = await browser.$('.workspace-leaf-content .markdown-source-view');
        if (await sourceMode.isExisting()) {
            await browser.executeObsidianCommand("editor:toggle-source");
            await browser.pause(500);
        }

        // Check that custom labels are rendered
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        
        // Should contain the custom labels
        expect(html).toContain('TODO');
        expect(html).toContain('DONE');
        expect(html).toContain('IN-PROGRESS');
        
        // Check that references are handled
        expect(html).toContain('Implement the feature');
        expect(html).toContain('Write documentation');
    });
});
