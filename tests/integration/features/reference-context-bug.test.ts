/**
 * Test that example references maintain correct numbering across all contexts
 */

import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Reference context preservation', () => {
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
    
    it('should maintain consistent reference numbers across multiple list types', () => {
        // First, create example list 'a' which should be (1)
        const setup = document.createElement('div');
        setup.innerHTML = '<p>(@a) First example list</p>';
        processReadingMode(setup, context, config);
        
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        
        // Test that (@a) consistently shows as (1) in all contexts
        const testCases = [
            {
                name: 'Plain paragraph',
                html: '<p>Reference in plain text (@a)</p>',
                expected: 'Reference in plain text (1)'
            },
            {
                name: 'Fancy list A.',
                html: '<p>A. Reference in fancy list (@a)</p>',
                expected: 'A. Reference in fancy list (1)'
            },
            {
                name: 'Hash list',
                html: '<p>#. Reference in hash list (@a)</p>',
                expected: '1. Reference in hash list (1)'
            },
            {
                name: 'Another example list',
                html: '<p>(@b) Another example with ref (@a)</p>',
                expected: '(2) Another example with ref (1)'
            },
            {
                name: 'Custom label list',
                html: '<p>{::TEST} Custom label with ref (@a)</p>',
                expected: '(TEST) Custom label with ref (1)'
            }
        ];
        
        testCases.forEach(test => {
            const el = document.createElement('div');
            el.innerHTML = test.html;
            processReadingMode(el, context, config);
            
            const actual = el.textContent?.trim() || '';
            // console.log(`${test.name}: "${actual}"`);
            
            // Check that (@a) always renders as (1)
            expect(actual).toContain('(1)');
            
            // Verify full expected output
            expect(actual).toBe(test.expected);
        });
        
        // Verify final state
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'a')).toBe(1);
        expect(pluginStateManager.getLabeledExampleNumber(docPath, 'b')).toBe(2);
    });
    
    it('should handle references in nested list contexts', () => {
        // Setup example 'a'
        const setup = document.createElement('div');
        setup.innerHTML = '<p>(@a) Example list</p>';
        processReadingMode(setup, context, config);
        
        // Test nested/complex scenarios
        const el = document.createElement('div');
        el.innerHTML = `
            <ul>
                <li>Unordered item with ref (@a)</li>
            </ul>
            <ol>
                <li>Ordered item with ref (@a)</li>
            </ol>
            <p>A. Fancy list with ref (@a)</p>
            <p>#. Hash list with ref (@a)</p>
        `;
        
        processReadingMode(el, context, config);
        
        const text = el.textContent || '';
        
        // Count how many times (1) appears - should be 4 times for the 4 references
        const matches = text.match(/\(1\)/g);
        expect(matches).toHaveLength(4);
        
        // Verify (@a) was replaced
        expect(text).not.toContain('(@a)');
    });
});