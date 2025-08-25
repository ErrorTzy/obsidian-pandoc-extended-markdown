import { expect } from '@wdio/globals';
import { Key } from 'webdriverio';

describe('Popover Persistence Bug', () => {
    beforeEach(async () => {
        // Create a test file with example references and custom label references
        await browser.executeObsidianCommand('file-explorer:new-file');
        await browser.pause(500);
    });

    it('should properly remove example reference popovers after rapid hover on/off', async () => {
        // Set up content with example list and reference
        const content = [
            '(@example) This is an example item with some content',
            '',
            'Here is a reference to the example: (@example)'
        ].join('\n');
        
        // Type the content
        await browser.keys(content);
        await browser.pause(500);
        
        // Switch to reading mode to test popovers
        await browser.executeObsidianCommand('editor:toggle-source');
        await browser.pause(500);
        
        // Find the reference element
        const reference = await $('.example-ref');
        await expect(reference).toExist();
        
        // Rapidly hover on and off multiple times
        for (let i = 0; i < 5; i++) {
            await reference.moveTo();
            await browser.pause(10); // Very short pause
            await browser.moveTo({ x: 0, y: 0 }); // Move away
            await browser.pause(10);
        }
        
        // Wait a bit for any delayed cleanup
        await browser.pause(200);
        
        // Check that no popovers are left on screen
        const popovers = await $$('.hover-popover');
        await expect(popovers).toHaveLength(0, 'All popovers should be removed after rapid hovering');
    });
    
    it('should properly remove custom label reference popovers after rapid hover on/off', async () => {
        // Set up content with custom label list and reference
        const content = [
            '{::LABEL} This is a custom label item with content',
            '',
            'Here is a reference: {::LABEL}'
        ].join('\n');
        
        // Type the content
        await browser.keys(content);
        await browser.pause(500);
        
        // Switch to reading mode to test popovers
        await browser.executeObsidianCommand('editor:toggle-source');
        await browser.pause(500);
        
        // Find the reference element
        const reference = await $('[data-custom-label-ref]');
        await expect(reference).toExist();
        
        // Rapidly hover on and off multiple times
        for (let i = 0; i < 5; i++) {
            await reference.moveTo();
            await browser.pause(10); // Very short pause
            await browser.moveTo({ x: 0, y: 0 }); // Move away
            await browser.pause(10);
        }
        
        // Wait a bit for any delayed cleanup
        await browser.pause(200);
        
        // Check that no popovers are left on screen
        const popovers = await $$('.hover-popover');
        await expect(popovers).toHaveLength(0, 'All popovers should be removed after rapid hovering');
    });
    
    it('should handle concurrent hover events without leaving orphaned popovers', async () => {
        // Set up content with multiple references
        const content = [
            '(@ex1) First example',
            '(@ex2) Second example',
            '(@ex3) Third example',
            '',
            'References: (@ex1) (@ex2) (@ex3)'
        ].join('\n');
        
        // Type the content
        await browser.keys(content);
        await browser.pause(500);
        
        // Switch to reading mode
        await browser.executeObsidianCommand('Toggle reading view');
        await browser.pause(500);
        
        // Find all reference elements
        const references = await $$('.example-ref');
        await expect(references).toHaveLength({ gte: 3 });
        
        // Rapidly hover between different references
        for (let i = 0; i < 10; i++) {
            const refIndex = i % 3;
            await references[refIndex].moveTo();
            await browser.pause(5); // Very short pause
        }
        
        // Move away from all references
        await browser.moveTo({ x: 0, y: 0 });
        await browser.pause(200);
        
        // Check that no popovers remain
        const popovers = await $$('.hover-popover');
        await expect(popovers).toHaveLength(0, 'No popovers should remain after rapid switching between references');
    });
    
    it('should remove popover when clicking on the reference', async () => {
        // Set up content
        const content = [
            '(@example) This is an example item',
            '',
            'Reference: (@example)'
        ].join('\n');
        
        // Type the content
        await browser.keys(content);
        await browser.pause(500);
        
        // Switch to reading mode
        await browser.executeObsidianCommand('Toggle reading view');
        await browser.pause(500);
        
        // Find the reference element
        const reference = await $('.example-ref');
        await expect(reference).toExist();
        
        // Hover to show popover
        await reference.moveTo();
        await browser.pause(100);
        
        // Verify popover appears
        let popover = await $('.hover-popover');
        await expect(popover).toExist();
        
        // Click on the reference
        await reference.click();
        await browser.pause(100);
        
        // Check that popover is removed
        const popovers = await $$('.hover-popover');
        await expect(popovers).toHaveLength(0, 'Popover should be removed after clicking');
    });
});