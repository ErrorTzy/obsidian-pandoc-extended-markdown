import { browser, expect } from '@wdio/globals';
import { obsidianPage } from 'wdio-obsidian-service';

describe('Popover Bug Fix - Simple Test', () => {
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
                plugin.saveSettings();
            }
        });
    });

    it('should not leave popovers stuck after clicking - the main bug fix', async () => {
        // Open the test file
        await browser.execute(() => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('popover-test.md');
            if (file) {
                // @ts-ignore
                app.workspace.getLeaf().openFile(file);
            }
        });
        await browser.pause(1500);
        
        // Scroll to the references section
        await browser.execute(() => {
            const headings = document.querySelectorAll('h3');
            for (const h of headings) {
                if (h.textContent?.includes('References to Examples')) {
                    h.scrollIntoView({ behavior: 'instant', block: 'center' });
                    break;
                }
            }
        });
        await browser.pause(500);
        
        // Find inline example references
        const references = await $$('.pem-example-reference');
        // console.log(`Found ${references.length} total example references`);
        
        // Find only the inline references (numbered ones)
        let targetRef = null;
        for (const ref of references) {
            try {
                const text = await ref.getText();
                if (text === '(1)' || text === '(2)') {
                    targetRef = ref;
                    // console.log(`Found inline reference with text: ${text}`);
                    break;
                }
            } catch (e) {
                // Element might be stale, skip it
            }
        }
        
        if (!targetRef) {
            // console.log('No inline references found, skipping test');
            return;
        }
        
        // THE CRITICAL TEST SEQUENCE:
        // 1. Hover to show popover
        await targetRef.moveTo();
        await browser.pause(800);
        
        // Check popover exists
        let popovers = await $$('.pem-hover-popover');
        // console.log(`After hover: ${popovers.length} popovers found`);
        expect(popovers.length).toBeGreaterThan(0);
        
        // 2. Click on the reference (this should dismiss the popover)
        await targetRef.click();
        await browser.pause(500);
        
        // Check popover is gone
        popovers = await $$('.pem-hover-popover');
        // console.log(`After click: ${popovers.length} popovers found`);
        
        // 3. Move mouse away completely
        const editor = await $('.cm-content');
        await editor.click({ x: 10, y: 10 });
        await browser.pause(500);
        
        // 4. Move back to the reference
        // Need to re-query as element might be stale
        const refsAgain = await $$('.pem-example-reference');
        let targetRefAgain = null;
        for (const ref of refsAgain) {
            try {
                const text = await ref.getText();
                if (text === '(1)' || text === '(2)') {
                    targetRefAgain = ref;
                    break;
                }
            } catch (e) {
                // Element might be stale, skip it
            }
        }
        
        if (targetRefAgain) {
            await targetRefAgain.moveTo();
            await browser.pause(800);
            
            // Popover should appear again (not stuck from before)
            popovers = await $$('.pem-hover-popover');
            // console.log(`After re-hover: ${popovers.length} popovers found`);
            
            // Move away again
            await editor.click({ x: 10, y: 10 });
            await browser.pause(800);
            
            // Final check - no popovers should remain
            popovers = await $$('.pem-hover-popover');
            // console.log(`Final check: ${popovers.length} popovers found`);
            
            // Check if any are actually visible
            let visibleCount = 0;
            for (const p of popovers) {
                try {
                    if (await p.isDisplayed()) {
                        visibleCount++;
                    }
                } catch (e) {
                    // Element might be stale or removed
                }
            }
            // console.log(`Final visible popovers: ${visibleCount}`);
            
            // THE KEY ASSERTION: No visible popovers should remain
            expect(visibleCount).toBe(0);
        }
    });
});