/**
 * Test for cross-reference numbering bug in reading mode
 * 
 * Bug: When (@a) appears in list items, it incorrectly increments the example counter
 * instead of just showing the reference to the existing example.
 */

import { ReadingModeParser } from '../../../src/reading-mode/parsers/parser';
import { ReadingModeRenderer, RenderContext } from '../../../src/reading-mode/renderer';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';
import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('Cross-reference numbering bug', () => {
    const docPath = 'test.md';
    
    beforeEach(() => {
        // Reset state
        pluginStateManager.resetDocumentCounters(docPath);
    });

    afterEach(() => {
        pluginStateManager.clearAllStates();
    });

    it('should not increment counter for (@) when it appears in list items', () => {
        // First, set up an example list with label 'a'
        const setupElement = document.createElement('div');
        setupElement.innerHTML = '<p>(@a) Example list</p>';
        
        const config: ProcessorConfig = {
            strictPandocMode: false,
            strictLineBreaks: false,
            enableSuperSubscripts: false,
            enableCustomLabelLists: false
        };
        
        const context = {
            sourcePath: docPath,
            getSectionInfo: () => null
        } as any;
        
        // Process the example list to register it
        processReadingMode(setupElement, context, config);
        
        // Verify the example was registered with number 1
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        
        // Now process lines that contain (@) in various list contexts
        const testCases = [
            { 
                html: '<li>(@) crossref in ordered list (@a)</li>',
                description: 'ordered list item'
            },
            {
                html: '<p>A. crossref in fancy list (@a)</p>',
                description: 'fancy list'
            },
            {
                html: '<p>#. crossref in hash list (@a)</p>',
                description: 'hash list'
            },
            {
                html: '<p>(@) another example list (@a)</p>',
                description: 'example list'
            }
        ];
        
        testCases.forEach(testCase => {
            const element = document.createElement('div');
            element.innerHTML = testCase.html;
            
            // Get the current counter value
            const counterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
            
            processReadingMode(element, context, config);
            
            const counterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
            
            // Check the rendered output
            const renderedText = element.textContent || '';
            
            // console.log(`Test case: ${testCase.description}`);
            // console.log(`HTML input: ${testCase.html}`);
            // console.log(`Rendered text: ${renderedText}`);
            // console.log(`Counter before: ${counterBefore}, after: ${counterAfter}`);
            
            // The reference (@a) should always show as (1)
            if (testCase.description === 'example list') {
                // This is a real example list, so counter should increment
                expect(counterAfter).toBe(counterBefore + 1);
                // And the (@a) reference should still show as (1)
                expect(renderedText).toContain('(1)'); // Reference to example 'a'
            } else {
                // These are NOT example lists, just contain (@) as text
                // The counter should NOT increment
                
                // FAILING: Currently (@) in list items incorrectly increments the counter
                expect(counterAfter).toBe(counterBefore);
                
                // The (@a) reference should show as (1)
                expect(renderedText).toContain('(1)');
            }
        });
    });
    
    it('should handle (@) as literal text in non-paragraph contexts', () => {
        const parser = new ReadingModeParser();
        
        // In a list item (not a paragraph), (@) should not be parsed as an example list
        const listItemLine = '(@) text in list item';
        const parsed = parser.parseLine(listItemLine, { isInParagraph: false });
        
        // Should not be parsed as an example list
        expect(parsed.type).not.toBe('example');
    });
    
    it('should correctly number (@a) references when {::P(#a)} is also present on the same line', () => {
        // First, set up an example list with label 'a' and a custom label list
        const setupElement = document.createElement('div');
        setupElement.innerHTML = `
            <p>(@a) Example list</p>
            <p>{::P(#a)} Custom Label List</p>
        `;
        
        const config: ProcessorConfig = {
            strictPandocMode: false,
            strictLineBreaks: false,
            enableSuperSubscripts: false,
            enableCustomLabelLists: true  // Enable custom labels
        };
        
        const context = {
            sourcePath: docPath,
            getSectionInfo: () => null
        } as any;
        
        // Process the example and custom label lists to register them
        processReadingMode(setupElement, context, config);
        
        // Verify the example was registered with number 1
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        
        // Now process a line that contains both (@a) and {::P(#a)} references
        const testElement = document.createElement('div');
        testElement.innerHTML = '<p>A.  crossref in fancy list (@a) and {::P(#a)}</p>';
        
        processReadingMode(testElement, context, config);
        
        // Debug: log the HTML after processing
        // console.log('HTML after processing:', testElement.innerHTML);
        
        // Check that (@a) reference is rendered as (1)
        const exampleRefs = testElement.querySelectorAll('.pem-example-reference');
        // console.log('Found example refs:', exampleRefs.length);
        exampleRefs.forEach((ref, i) => {
            // console.log(`  Ref ${i}: text="${ref.textContent}", class="${ref.className}"`);
        });
        
        expect(exampleRefs.length).toBe(1);
        if (exampleRefs.length > 0) {
            expect(exampleRefs[0].textContent).toBe('(1)'); // Should be (1), not (2) or something else
        }
        
        // Check that {::P(#a)} reference is rendered correctly
        const customRefs = testElement.querySelectorAll('[data-custom-label-ref]');
        expect(customRefs.length).toBe(1);
        expect(customRefs[0].textContent).toBe('(P1)');
    });
});