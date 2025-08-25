import { browser, $, $$ } from '@wdio/globals';

describe('Cross-reference numbering bug in reading mode', () => {
    before(async () => {
        // Load the test vault
        await browser.reloadObsidian({
            vault: "./tests/e2e/vaults/test-vault"
        });
        
        // Ensure plugin is enabled with custom labels
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
    
    it('should correctly number (@a) references when {::P(#a)} is present', async () => {
        // Create and open the test file
        await browser.execute(() => {
            const content = `(@a) Example list

{::P(#a)} Custom Label List

A.  crossref in **fancy list** (@a) and {::P(#a)}

(@) crossref in **example list** (@a) and {::P(#a)}

#. crossref in **hash auto-numbering** list (@a) and {::P(#a)}

{::P(#b)} crossref in **custom label list** (@a) and {::P(#a)}`;
            
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath('crossref-bug-test.md');
            if (file) {
                // @ts-ignore
                app.vault.modify(file, content);
                // @ts-ignore
                app.workspace.getLeaf().openFile(file);
            } else {
                // @ts-ignore
                app.vault.create('crossref-bug-test.md', content).then(file => {
                    // @ts-ignore
                    app.workspace.getLeaf().openFile(file);
                });
            }
        });
        await browser.pause(1000);
        
        // Switch to reading mode
        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            // @ts-ignore
            const state = leaf.getViewState();
            state.state.mode = 'preview';
            // @ts-ignore
            leaf.setViewState(state);
        });
        await browser.pause(500);
        
        // Get all example reference spans - using the correct class name
        const exampleRefs = await $$('.pandoc-example-reference');
        
        // Get info about each reference - now including both example refs and custom label refs
        const refInfo = await browser.execute(() => {
            // Get both example references and custom label references that might have been misclassified
            const refs = document.querySelectorAll('.pandoc-example-reference, .pandoc-custom-label-reference-processed');
            return Array.from(refs).map((ref, i) => {
                const parentP = ref.closest('p');
                const parentLi = ref.closest('li');
                const parentText = (parentP || parentLi)?.textContent || '';
                return {
                    index: i,
                    text: ref.textContent,
                    className: ref.className,
                    dataExampleNumber: (ref as HTMLElement).dataset.exampleNumber,
                    parentText: parentText.substring(0, 50) // First 50 chars for context
                };
            });
        });
        
        // Check that all (@a) references show as (1)
        let bugFound = false;
        refInfo.forEach((ref, i) => {
            // References to (@a) should all show as (1), but custom label refs (P1, P2) are ok
            if (ref.parentText.includes('crossref')) {
                // Check if this is an example reference (should be "(1)")
                if (ref.className === 'pandoc-example-reference' && ref.text !== '(1)') {
                    // console.log(`BUG: Reference ${i} shows as "${ref.text}" instead of "(1)" in: ${ref.parentText}`);
                    bugFound = true;
                }
                // Custom label refs should start with P
                if (ref.className === 'pandoc-custom-label-reference-processed' && !ref.text.includes('P')) {
                    // console.log(`BUG: Custom label ref ${i} shows as "${ref.text}" instead of "(P...)" in: ${ref.parentText}`);
                    bugFound = true;
                }
            }
        });
        
        expect(bugFound).toBe(false);
        
        // Also check that custom label references are processed correctly
        const customRefInfo = await browser.execute(() => {
            const refs = document.querySelectorAll('[data-custom-label-ref]');
            return Array.from(refs).map(ref => ({
                text: ref.textContent,
                dataRef: (ref as HTMLElement).dataset.customLabelRef
            }));
        });
        
        // All {::P(#a)} references should show as (P1)
        customRefInfo.forEach(ref => {
            if (ref.dataRef === 'P1') {
                expect(ref.text).toBe('(P1)');
            }
        });
    });
});