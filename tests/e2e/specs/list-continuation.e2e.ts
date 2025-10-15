import { browser, $, $$ } from '@wdio/globals';

describe('List continuation with Shift+Enter', () => {
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
    
    it('should apply proper CSS classes to continuation lines in fancy lists', async () => {
        // Create and open the test file with pre-existing continuation lines
        await browser.execute(() => {
            const content = `A. First item
   with continuation
B. Second item

i. Roman numeral item  
   with continuation
ii. Second roman item`;
            
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('list-continuation-test.md');
            if (file) {
                // @ts-ignore
                app.vault.modify(file, content);
                // @ts-ignore
                app.workspace.getLeaf().openFile(file);
            } else {
                // @ts-ignore
                app.vault.create('list-continuation-test.md', content).then(file => {
                    // @ts-ignore
                    app.workspace.getLeaf().openFile(file);
                });
            }
        });
        await browser.pause(1000);
        
        // Switch to live preview mode
        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            // @ts-ignore
            const state = leaf.getViewState();
            state.state.mode = 'source';
            state.state.source = true; // live preview mode
            // @ts-ignore
            leaf.setViewState(state);
        });
        await browser.pause(500);
        
        // Check the DOM structure for list lines
        const listInfo = await browser.execute(() => {
            const lines = document.querySelectorAll('.cm-line');
            return Array.from(lines).map((line, i) => ({
                index: i,
                text: (line as HTMLElement).textContent,
                classes: line.className,
                hasPandocListLine: line.classList.contains('pandoc-list-line'),
                hasHyperMDListLine: line.classList.contains('HyperMD-list-line'),
                hasNoBullet: line.classList.contains('HyperMD-list-line-nobullet'),
                indentStyle: (line as HTMLElement).style.textIndent,
                paddingStyle: (line as HTMLElement).style.paddingInlineStart
            }));
        });
        
        // Test fancy list continuation
        const lineA = listInfo.find(l => l.text?.includes('First item'));
        const lineACont = listInfo.find(l => l.text?.trim() === 'with continuation' && 
                                        listInfo.indexOf(l) === listInfo.indexOf(lineA!) + 1);
        
        // Debug output
        console.log('Line A:', lineA);
        console.log('Line A continuation:', lineACont);
        console.log('All lines:', listInfo);
        
        expect(lineA).toBeDefined();
        expect(lineA?.hasHyperMDListLine).toBe(true);
        expect(lineA?.hasPandocListLine).toBe(true);
        
        // The continuation line should have proper list classes and indentation
        expect(lineACont).toBeDefined();
        expect(lineACont?.hasHyperMDListLine).toBe(true);
        expect(lineACont?.hasNoBullet).toBe(true);
        expect(lineACont?.indentStyle).toBeTruthy(); // Should have indentation
        
        // Test roman numeral list continuation
        const lineI = listInfo.find(l => l.text?.includes('Roman numeral item'));
        const lineICont = listInfo.find(l => l.text?.trim() === 'with continuation' && 
                                        listInfo.indexOf(l) === listInfo.indexOf(lineI!) + 1);
        
        expect(lineI).toBeDefined();
        expect(lineI?.hasHyperMDListLine).toBe(true);
        expect(lineI?.hasPandocListLine).toBe(true);
        
        expect(lineICont).toBeDefined();
        expect(lineICont?.hasHyperMDListLine).toBe(true);
        expect(lineICont?.hasNoBullet).toBe(true);
        expect(lineICont?.indentStyle).toBeTruthy();
    });
    
    it('should apply proper CSS classes to continuation lines in example lists', async () => {
        // Create and open test file with example lists
        await browser.execute(() => {
            const content = `(@label) Example item
         with continuation
(@) Another example

{::CUSTOM} Custom label item
           with continuation
{::OTHER} Another custom item`;
            
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('example-continuation-test.md');
            if (file) {
                // @ts-ignore
                app.vault.modify(file, content);
                // @ts-ignore
                app.workspace.getLeaf().openFile(file);
            } else {
                // @ts-ignore
                app.vault.create('example-continuation-test.md', content).then(file => {
                    // @ts-ignore
                    app.workspace.getLeaf().openFile(file);
                });
            }
        });
        await browser.pause(1000);
        
        // Switch to live preview mode
        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            // @ts-ignore
            const state = leaf.getViewState();
            state.state.mode = 'source';
            state.state.source = true; // live preview mode
            // @ts-ignore
            leaf.setViewState(state);
        });
        await browser.pause(500);
        
        // Check the DOM structure for list lines
        const listInfo = await browser.execute(() => {
            const lines = document.querySelectorAll('.cm-line');
            return Array.from(lines).map((line, i) => ({
                index: i,
                text: (line as HTMLElement).textContent,
                classes: line.className,
                hasPandocListLine: line.classList.contains('pandoc-list-line'),
                hasHyperMDListLine: line.classList.contains('HyperMD-list-line'),
                hasNoBullet: line.classList.contains('HyperMD-list-line-nobullet'),
                indentStyle: (line as HTMLElement).style.textIndent,
                paddingStyle: (line as HTMLElement).style.paddingInlineStart
            }));
        });
        
        // Test example list continuation
        const exampleLine = listInfo.find(l => l.text?.includes('Example item'));
        const exampleCont = listInfo.find(l => l.text?.trim() === 'with continuation' && 
                                          listInfo.indexOf(l) === listInfo.indexOf(exampleLine!) + 1);
        
        expect(exampleLine).toBeDefined();
        expect(exampleLine?.hasHyperMDListLine).toBe(true);
        expect(exampleLine?.hasPandocListLine).toBe(true);
        
        expect(exampleCont).toBeDefined();
        expect(exampleCont?.hasHyperMDListLine).toBe(true);
        expect(exampleCont?.hasNoBullet).toBe(true);
        expect(exampleCont?.indentStyle).toBeTruthy();
        
        // Test custom label list continuation
        const customLine = listInfo.find(l => l.text?.includes('Custom label item'));
        const customCont = listInfo.find(l => l.text?.trim() === 'with continuation' && 
                                         listInfo.indexOf(l) === listInfo.indexOf(customLine!) + 1);
        
        expect(customLine).toBeDefined();
        expect(customLine?.hasHyperMDListLine).toBe(true);
        expect(customLine?.hasPandocListLine).toBe(true);
        
        expect(customCont).toBeDefined();
        expect(customCont?.hasHyperMDListLine).toBe(true);
        expect(customCont?.hasNoBullet).toBe(true);
        expect(customCont?.indentStyle).toBeTruthy();
    });
});
