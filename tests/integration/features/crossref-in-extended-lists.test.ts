/**
 * Test for cross-references appearing in extended list items
 * Reproduces the bug where (@a) references show wrong numbers in extended lists
 */

import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Cross-references in extended lists bug', () => {
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
        
        // Setup: Create an example list with label 'a' that should be number 1
        const setupEl = document.createElement('div');
        setupEl.innerHTML = '<p>(@a) Example list content</p>';
        processReadingMode(setupEl, context, config);
        
        // Verify setup
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        expect(pluginStateManager.getDocumentCounters(docPath).exampleCounter).toBe(1);
    });
    
    afterEach(() => {
        pluginStateManager.clearAllStates();
    });
    
    it('should show correct reference number in fancy list without incrementing counter', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>A. crossref in fancy list (@a)</p>';
        
        const counterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        processReadingMode(element, context, config);
        const counterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        
        // Counter should not change
        expect(counterAfter).toBe(counterBefore);
        expect(counterAfter).toBe(1); // Still 1 from setup
        
        // Reference should show as (1)
        const text = element.textContent || '';
        expect(text).toContain('(1)');
        expect(text).not.toContain('(@a)');
        
        // The 'A.' marker should still be there
        expect(element.innerHTML).toContain('pem-list-fancy');
    });
    
    it('should handle unlabeled example list (@) with reference (@a)', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>(@) crossref in example list (@a)</p>';
        
        const counterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        processReadingMode(element, context, config);
        const counterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        
        // This IS an example list, so counter should increment for the (@)
        expect(counterAfter).toBe(counterBefore + 1);
        expect(counterAfter).toBe(2);
        
        // The list should show as (2) and reference should show as (1)
        const text = element.textContent || '';
        expect(text).toMatch(/^\(2\).*\(1\)/); // (2) at start, (1) later
    });
    
    it('should show correct reference in hash list', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>#. crossref in hash list (@a)</p>';
        
        const exampleCounterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        processReadingMode(element, context, config);
        const exampleCounterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        
        // Example counter should NOT change
        expect(exampleCounterAfter).toBe(exampleCounterBefore);
        expect(exampleCounterAfter).toBe(1); // Still 1 from setup
        
        // Hash counter should increment
        const hashCounter = pluginStateManager.getDocumentCounters(docPath).hashCounter;
        expect(hashCounter).toBe(1);
        
        // Should show hash number and reference (1)
        const text = element.textContent || '';
        expect(text).toMatch(/^1\./); // Hash list shows as "1."
        expect(text).toContain('(1)'); // Reference to (@a)
    });
    
    it('should handle custom label list with reference', () => {
        // First create a custom label list P(#a) which should resolve to P1
        const setupEl2 = document.createElement('div');
        setupEl2.innerHTML = '<p>{::P(#a)} First custom label</p>';
        processReadingMode(setupEl2, context, config);
        
        // Now test a second custom label with reference
        const element = document.createElement('div');
        element.innerHTML = '<p>{::P(#b)} crossref in custom label list (@a)</p>';
        
        const exampleCounterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        processReadingMode(element, context, config);
        const exampleCounterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        
        // Example counter should NOT change
        expect(exampleCounterAfter).toBe(exampleCounterBefore);
        expect(exampleCounterAfter).toBe(1); // Still 1 from setup
        
        // Should show custom label and reference
        const text = element.textContent || '';
        expect(text).toContain('(1)'); // Reference to (@a)
    });
    
    it('should NOT treat (@word) in the middle of text as example list', () => {
        const element = document.createElement('div');
        // This is a fancy list with (@something) in the middle - NOT an example list
        element.innerHTML = '<p>A. Some text with (@something) in the middle</p>';
        
        const counterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        processReadingMode(element, context, config);
        const counterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
        
        // Counter should NOT increment - (@something) in middle of text is not an example list
        expect(counterAfter).toBe(counterBefore);
        
        const text = element.textContent || '';
        // Should still have the fancy list marker
        expect(text).toMatch(/^A\./);
    });
    
    it('BUG: should maintain correct numbering for (@a) when {::P(#a)} is on the same line', () => {
        // First setup custom label
        const setupEl2 = document.createElement('div');
        setupEl2.innerHTML = '<p>{::P(#a)} Custom Label List</p>';
        processReadingMode(setupEl2, context, config);
        
        // Now process lines with both (@a) and {::P(#a)} on the same line
        const element = document.createElement('div');
        element.innerHTML = `
            <p>A.  crossref in fancy list (@a) and {::P(#a)}</p>
            <p>(@) crossref in <strong>example list</strong> (@a) and {::P(#a)}</p>
            <p>#. crossref in <strong>hash auto-numbering</strong> list (@a) and {::P(#a)}</p>
            <p>{::P(#b)} crossref in <strong>custom label list</strong> (@a) and {::P(#a)}</p>
        `;
        
        processReadingMode(element, context, config);
        
        // Check all (@a) references
        const exampleRefs = element.querySelectorAll('.pem-example-reference');
        // console.log(`Found ${exampleRefs.length} example references`);
        
        const errors: string[] = [];
        let refIndex = 0;
        exampleRefs.forEach((ref) => {
            const text = ref.textContent;
            const parent = ref.closest('p');
            const parentText = parent?.textContent || '';
            
            // console.log(`Ref ${refIndex}: "${text}" in: "${parentText.substring(0, 60)}"`);
            
            // All (@a) references should show as (1), not (2), (3), (4), etc.
            if (text !== '(1)') {
                errors.push(`Reference ${refIndex} shows "${text}" instead of "(1)" in: ${parentText.substring(0, 50)}`);
            }
            refIndex++;
        });
        
        // This test currently FAILS - (@a) references show as (2), (3), (4) instead of all being (1)
        expect(errors).toEqual([]);
    });
});