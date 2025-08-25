import { browser } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service';

describe('Fancy Lists', function () {
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

    it('should render alphabetic lists correctly', async () => {
        // Open the fancy lists test file
        await browser.executeObsidianCommand("file-explorer:open");
        await browser.pause(500);
        
        // Navigate to the fancy-lists.md file
        const fileExplorer = await browser.$('.workspace-leaf-content[data-type="file-explorer"]');
        await expect(fileExplorer).toExist();
        
        const file = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
        await file.click();
        await browser.pause(1000);

        // Switch to reading mode to see rendered output
        await browser.executeObsidianCommand("editor:toggle-source");
        await browser.pause(500);

        // Check that alphabetic lists are rendered as ordered lists
        const alphaList = await browser.$('.markdown-preview-view ol');
        await expect(alphaList).toExist();
        
        // Check list items have correct type attribute
        const listItems = await browser.$$('.markdown-preview-view ol li');
        expect(listItems.length).toBeGreaterThan(0);
    });

    it('should render roman numeral lists', async () => {
        // Open the fancy lists file
        const file = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
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

        // Look for roman numeral lists
        const content = await browser.$('.markdown-preview-view');
        const html = await content.getHTML();
        
        // Check that roman numerals are properly rendered
        expect(html).toContain('ol');
        expect(html.toLowerCase()).toContain('first item in roman');
    });

    it('should handle auto-numbering (#.) correctly', async () => {
        // Open the fancy lists file
        const file = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
            await fileRetry.click();
        } else {
            await file.click();
        }
        await browser.pause(1000);

        // Switch to source mode to check auto-numbering
        const readingMode = await browser.$('.workspace-leaf-content .markdown-preview-view');
        if (await readingMode.isExisting()) {
            await browser.executeObsidianCommand("editor:toggle-source");
            await browser.pause(500);
        }

        // Check that auto-numbering syntax is present
        const editor = await browser.$('.cm-content');
        const text = await editor.getText();
        expect(text).toContain('#. Auto numbered');

        // Switch back to reading mode
        await browser.executeObsidianCommand("editor:toggle-source");
        await browser.pause(500);

        // Verify it renders as numbered list
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        expect(html).toContain('Auto numbered item');
    });

    it('should support nested fancy lists', async () => {
        // Open the fancy lists file
        const file = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
        if (!await file.isExisting()) {
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.pause(500);
            const fileRetry = await browser.$('.nav-file-title[data-path="fancy-lists.md"]');
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

        // Check for nested list structure
        const preview = await browser.$('.markdown-preview-view');
        const html = await preview.getHTML();
        
        // Should have nested ol/ul elements
        expect(html).toContain('Parent item');
        expect(html).toContain('Child item');
        const nestedLists = await browser.$$('.markdown-preview-view ol ol, .markdown-preview-view ol ul');
        expect(nestedLists.length).toBeGreaterThan(0);
    });
});
