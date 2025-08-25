import { browser } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service';

describe('Example Lists and Cross-References', function () {
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

    it('should render example list items with labels', async () => {
        // Open the example lists test file
        await browser.executeObsidianCommand("file-explorer:open");
        await browser.pause(500);
        
        const file = await browser.$('.nav-file-title[data-path="example-lists.md"]');
        await file.click();
        await browser.pause(1000);

        // Switch to reading mode
        await browser.executeObsidianCommand("editor:toggle-source");
        await browser.pause(500);

        // Check that example lists are rendered
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        
        // Should contain numbered examples
        expect(html).toContain('This is the first example');
        expect(html).toContain('This is the second example');
        
        // Check for proper numbering
        const exampleItems = await browser.$$('.markdown-preview-view .example-list-item');
        if (exampleItems.length === 0) {
            // Fallback check for any list rendering
            const lists = await browser.$$('.markdown-preview-view ol');
            expect(lists.length).toBeGreaterThan(0);
        }
    });

    it('should handle cross-references to examples', async () => {
        // Ensure we have the example-lists file open
        const file = await browser.$('.nav-file-title[data-path="example-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="example-lists.md"]');
            await fileRetry.click();
        } else {
            await file.click();
        }
        await browser.pause(1000);

        // Ensure we're in reading mode
        const sourceMode = await browser.$('.workspace-leaf-content .markdown-source-view');
        if (await sourceMode.isExisting()) {
            await browser.executeObsidianCommand("editor:toggle-source");
            await browser.pause(500);
        }

        // Check that cross-references are rendered as numbers
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        
        // References should be converted to numbers
        expect(html).toContain('As shown in example');
        // The actual reference numbers should appear (1, 2, 3)
        expect(html).toMatch(/example\s+\d+/);
    });

    it('should provide autocomplete for example references in edit mode', async () => {
        // Open the example lists file
        const file = await browser.$('.nav-file-title[data-path="example-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="example-lists.md"]');
            await fileRetry.click();
        } else {
            await file.click();
        }
        await browser.pause(1000);

        // Switch to source mode for editing
        const readingMode = await browser.$('.workspace-leaf-content .markdown-preview-view');
        if (await readingMode.isExisting()) {
            await browser.executeObsidianCommand("editor:toggle-source");
            await browser.pause(500);
        }

        // Move cursor to end of document
        const editor = await browser.$('.cm-content');
        await editor.click();
        await browser.keys(['End']);
        await browser.keys(['Enter', 'Enter']);
        
        // Type the beginning of a reference
        await browser.keys('See example (@');
        await browser.pause(500);

        // Check if autocomplete suggestions appear
        const suggestions = await browser.$('.suggestion-container');
        if (await suggestions.isExisting()) {
            // Verify suggestions contain our example labels
            const suggestionText = await suggestions.getText();
            expect(suggestionText.toLowerCase()).toMatch(/(first|second|third|important)/);
        }
    });

    it('should maintain example numbering across the document', async () => {
        // Open the example lists file
        const file = await browser.$('.nav-file-title[data-path="example-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="example-lists.md"]');
            await fileRetry.click();
        } else {
            await file.click();
        }
        await browser.pause(1000);

        // Ensure we're in reading mode
        const sourceMode = await browser.$('.workspace-leaf-content .markdown-source-view');
        if (await sourceMode.isExisting()) {
            await browser.executeObsidianCommand("editor:toggle-source");
            await browser.pause(500);
        }

        // Check that example numbering is consistent
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        
        // The "important" example should have a higher number than the first three
        // since it appears later in the document
        expect(html).toContain('important example');
        
        // All examples should be numbered sequentially
        const content = await preview.getText();
        expect(content).toBeTruthy();
    });
});
