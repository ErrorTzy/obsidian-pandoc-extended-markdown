/**
 * Debug test to understand the exact bug
 */

import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Debug cross-reference bug', () => {
    const docPath = 'test.md';
    let config: ProcessorConfig;
    let context: any;
    
    beforeEach(() => {
        pluginStateManager.resetDocumentCounters(docPath);
        
        config = {
            strictPandocMode: false,
            strictLineBreaks: false,
            enableSuperSubscripts: false,
            enableCustomLabelLists: true,
            enableHashAutoNumber: true,
            enableFancyLists: true,
            enableExampleLists: true,
            enableDefinitionLists: false
        };
        
        context = {
            sourcePath: docPath,
            getSectionInfo: () => null
        };
    });
    
    afterEach(() => {
        pluginStateManager.clearAllStates();
    });
    
    it('should debug what happens step by step', () => {
        // First, establish the example list
        const setupElement = document.createElement('div');
        setupElement.innerHTML = '<p>(@a) Example list</p>';
        
        // console.log('=== Processing example list ===');
        processReadingMode(setupElement, context, config);
        // console.log('Counter after example list:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        // console.log('Example a number:', pluginStateManager.getLabeledExampleNumber(docPath, 'a'));
        
        // Now test a single line with both references
        const testElement = document.createElement('div');
        testElement.innerHTML = '<p>A.  crossref in fancy list (@a) and {::P(#a)}</p>';
        
        // console.log('\n=== Before processing line with both refs ===');
        // console.log('HTML before:', testElement.innerHTML);
        // console.log('Text before:', testElement.textContent);
        // console.log('Counter before:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        // Process the line
        processReadingMode(testElement, context, config);
        
        // console.log('\n=== After processing ===');
        // console.log('HTML after:', testElement.innerHTML);
        // console.log('Text after:', testElement.textContent);
        // console.log('Counter after:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        // Check spans
        const exampleRefs = testElement.querySelectorAll('.pem-example-reference');
        // console.log('Example ref spans found:', exampleRefs.length);
        exampleRefs.forEach((ref, i) => {
            // console.log(`  Ref ${i}: "${ref.textContent}" with data-example-number="${ref.getAttribute('data-example-number')}"`);
        });
        
        const customRefs = testElement.querySelectorAll('[data-custom-label-ref]');
        // console.log('Custom label ref spans found:', customRefs.length);
        customRefs.forEach((ref, i) => {
            // console.log(`  Custom ref ${i}: "${ref.textContent}" with data-custom-label-ref="${ref.getAttribute('data-custom-label-ref')}"`);
        });
        
        // The bug would be if (@a) shows as something other than (1)
        expect(testElement.textContent).toContain('(1)');
    });
    
    it('should test without custom label processing', () => {
        // Disable custom labels
        config.enableCustomLabelLists = false;
        
        // First, establish the example list
        const setupElement = document.createElement('div');
        setupElement.innerHTML = '<p>(@a) Example list</p>';
        processReadingMode(setupElement, context, config);
        
        // Test the same line
        const testElement = document.createElement('div');
        testElement.innerHTML = '<p>A.  crossref in fancy list (@a) and {::P(#a)}</p>';
        
        // console.log('\n=== Without custom labels enabled ===');
        // console.log('Counter before:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        processReadingMode(testElement, context, config);
        
        // console.log('HTML after:', testElement.innerHTML);
        // console.log('Text after:', testElement.textContent);
        // console.log('Counter after:', pluginStateManager.getDocumentCounters(docPath).exampleCounter);
        
        expect(testElement.textContent).toContain('(1)');
    });
});