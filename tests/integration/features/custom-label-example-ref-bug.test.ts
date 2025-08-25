/**
 * Test for the bug where example references get incorrectly numbered when 
 * custom label references are on the same line
 */

import { processReadingMode } from '../../../src/reading-mode/processor';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { processCustomLabelLists } from '../../../src/reading-mode/parsers/customLabelListParser';

describe('Custom label and example reference interaction bug', () => {
    const docPath = 'test.md';
    let config: ProcessorConfig;
    let context: any;
    
    beforeEach(() => {
        pluginStateManager.clearAllStates();
        
        config = {
            strictPandocMode: false,
            strictLineBreaks: false,
            enableSuperSubscripts: false,
            enableCustomLabelLists: true,
            enableExampleLists: true,
            enableFancyLists: true,
            enableHashAutoNumber: true,
            enableDefinitionLists: true,
            moreExtendedSyntax: true
        };
        
        context = {
            sourcePath: docPath,
            getSectionInfo: () => null,
            frontmatter: null,
            addChild: () => {}
        };
    });
    
    afterEach(() => {
        pluginStateManager.clearAllStates();
    });
    
    it('should demonstrate the bug step by step', () => {
        // Step 1: Set up the example list and custom label list
        const setupEl = document.createElement('div');
        setupEl.innerHTML = `
            <p>(@a) Example list</p>
            <p>{::P(#a)} Custom Label List</p>
        `;
        
        // console.log('=== Step 1: Process setup lists ===');
        processReadingMode(setupEl, context, config);
        // console.log('Counter after setup:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        // Step 2: Process all the test lines together (as would happen in real scenario)
        const testEl = document.createElement('div');
        testEl.innerHTML = `
            <p>A.  crossref in <strong>fancy list</strong> (@a) and {::P(#a)}</p>
            <p>(@) crossref in <strong>example list</strong> (@a) and {::P(#a)}</p>
            <p>#. crossref in <strong>hash auto-numbering</strong> list (@a) and {::P(#a)}</p>
            <p>{::P(#b)} crossref in <strong>custom label list</strong> (@a) and {::P(#a)}</p>
        `;
        
        // console.log('\n=== Step 2: Process all test lines ===');
        // console.log('HTML before:', testEl.innerHTML);
        // console.log('Counter before:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        // Process - this calls processCustomLabelLists internally after processing other syntax
        processReadingMode(testEl, context, config);
        
        // console.log('\nHTML after:', testEl.innerHTML);
        // console.log('Counter after:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        // Check what happened to the example references
        const exampleRefs = testEl.querySelectorAll('.pandoc-example-reference');
        // console.log('\nExample references found:', exampleRefs.length);
        exampleRefs.forEach((ref, i) => {
            const parent = ref.closest('p');
            const context = parent ? parent.textContent?.substring(0, 50) : 'no context';
            // console.log(`  Ref ${i}: "${ref.textContent}" in: ${context}`);
        });
        
        // Check for incorrectly created example lists
        const exampleLists = testEl.querySelectorAll('.pandoc-example-list');
        // console.log('\nExample lists found:', exampleLists.length);
        exampleLists.forEach((list, i) => {
            const parent = list.closest('p');
            const context = parent ? parent.textContent?.substring(0, 50) : 'no context';
            // console.log(`  List ${i}: "${list.textContent}" in: ${context}`);
        });
        
        // The bug: (@a) references should all be (1), but they show as (2), (3), (4), etc.
        const errors: string[] = [];
        exampleRefs.forEach((ref, i) => {
            if (ref.textContent !== '(1)') {
                errors.push(`Ref ${i} is "${ref.textContent}" instead of "(1)"`);
            }
        });
        
        // This test should fail with the current bug
        expect(errors).toEqual([]);
    });
    
    it('should work correctly without custom labels on the same line', () => {
        // Setup
        const setupEl = document.createElement('div');
        setupEl.innerHTML = `
            <p>(@a) Example list</p>
            <p>{::P(#a)} Custom Label List</p>
        `;
        processReadingMode(setupEl, context, config);
        
        // Test WITHOUT {::P(#a)} on same lines
        const testEl = document.createElement('div');
        testEl.innerHTML = `
            <p>A.  crossref in <strong>fancy list</strong> (@a)</p>
            <p>(@) crossref in <strong>example list</strong> (@a)</p>
            <p>#. crossref in <strong>hash auto-numbering</strong> list (@a)</p>
            <p>{::P(#b)} crossref in <strong>custom label list</strong> (@a)</p>
        `;
        
        processReadingMode(testEl, context, config);
        
        const exampleRefs = testEl.querySelectorAll('.pandoc-example-reference');
        const errors: string[] = [];
        exampleRefs.forEach((ref, i) => {
            if (ref.textContent !== '(1)') {
                errors.push(`Ref ${i} is "${ref.textContent}" instead of "(1)"`);
            }
        });
        
        // This should pass
        expect(errors).toEqual([]);
    });
});