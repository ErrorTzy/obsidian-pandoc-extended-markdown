/**
 * Test for bug where inline custom label references {::P(#a)} cause
 * example references (@a) to be treated as labels instead of references
 */

import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Inline custom label reference breaks example reference', () => {
    const docPath = 'test.md';
    let config: ProcessorConfig;
    let context: any;
    
    beforeEach(() => {
        pluginStateManager.resetDocumentCounters(docPath);
        
        config = {
            strictPandocMode: false,
            strictLineBreaks: false,
            enableSuperSubscripts: false,
            enableCustomLabelLists: true
        };
        
        context = {
            sourcePath: docPath,
            getSectionInfo: () => null
        };
    });
    
    afterEach(() => {
        pluginStateManager.clearAllStates();
    });
    
    it('should treat (@a) as reference when inline {::P(#a)} is present', () => {
        // Setup: Create example list with label 'a' and custom label list
        const setup = document.createElement('div');
        setup.innerHTML = `
            <p>(@a) Example list</p>
            <p>{::P(#a)} Custom label list</p>
        `;
        processReadingMode(setup, context, config);
        
        // Verify setup
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        const setupText = setup.textContent || '';
        expect(setupText).toContain('(1) Example list');
        expect(setupText).toContain('(P1) Custom label list');
        
        // Test case: Lines with inline custom label references
        const testCases = [
            {
                name: 'Fancy list with both refs',
                html: '<p>A. crossref in fancy list (@a) and {::P(#a)}</p>',
                expected: 'A. crossref in fancy list (1) and (P1)'
            },
            {
                name: 'Plain paragraph with both refs',
                html: '<p>Text with (@a) and {::P(#a)} references</p>',
                expected: 'Text with (1) and (P1) references'
            },
            {
                name: 'List item with both refs',
                html: '<li>Item with (@a) and {::P(#a)}</li>',
                expected: 'Item with (1) and (P1)'
            }
        ];
        
        testCases.forEach(test => {
            const element = document.createElement('div');
            element.innerHTML = test.html;
            
            const counterBefore = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
            processReadingMode(element, context, config);
            const counterAfter = pluginStateManager.getDocumentCounters(docPath).exampleCounter;
            
            const text = element.textContent?.trim() || '';
            // console.log(`${test.name}:`);
            // console.log(`  Input: ${test.html}`);
            // console.log(`  Output: ${text}`);
            // console.log(`  Counter: ${counterBefore} -> ${counterAfter}`);
            
            // The example counter should NOT increment
            expect(counterAfter).toBe(counterBefore);
            expect(counterAfter).toBe(1); // Should still be 1 from initial setup
            
            // (@a) should be rendered as (1), not treated as a new label
            expect(text).toBe(test.expected);
            
            // Specifically check that (@a) was replaced with (1)
            expect(text).not.toContain('(@a)');
            expect(text).toContain('(1)');
        });
    });
    
    it('should handle (@a) correctly in different positions relative to {::P(#a)}', () => {
        // Setup
        const setup = document.createElement('div');
        setup.innerHTML = '<p>(@a) Example list</p><p>{::P(#a)} Custom label</p>';
        processReadingMode(setup, context, config);
        
        const testCases = [
            {
                name: '{::P(#a)} before (@a)',
                html: '<p>Test: {::P(#a)} comes before (@a)</p>',
                expected: 'Test: (P1) comes before (1)'
            },
            {
                name: '(@a) before {::P(#a)}',  
                html: '<p>Test: (@a) comes before {::P(#a)}</p>',
                expected: 'Test: (1) comes before (P1)'
            },
            {
                name: 'Multiple (@a) with {::P(#a)}',
                html: '<p>First (@a), then {::P(#a)}, then (@a) again</p>',
                expected: 'First (1), then (P1), then (1) again'
            }
        ];
        
        testCases.forEach(test => {
            const element = document.createElement('div');
            element.innerHTML = test.html;
            
            processReadingMode(element, context, config);
            
            const text = element.textContent?.trim() || '';
            // console.log(`${test.name}: "${text}"`);
            
            // Check the output matches expected
            expect(text).toBe(test.expected);
            
            // Verify counter didn't increment
            expect(pluginStateManager.getDocumentCounters(docPath).exampleCounter).toBe(1);
        });
    });
});