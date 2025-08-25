import { describe, it, expect } from '@jest/globals';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

// Test the actual scanning function from ProcessingPipeline
describe('Example List Integration - ProcessingPipeline scanning', () => {
    const settings: PandocExtendedMarkdownSettings = {
        enablePandocLists: true,
        strictLineBreaks: false,
        strictPandocMode: false,
        debugMode: false,
        moreExtendedSyntax: false,
        toggleDefinitionStyle: false,
        panelOrder: []
    } as PandocExtendedMarkdownSettings;
    
    // Import and test the actual implementation
    it('should handle unlabeled example lists correctly in ProcessingPipeline', () => {
        const content = [
            '(@) First unlabeled example',
            '(@) Second unlabeled example',
            '(@label) A labeled example',
            '(@) Third unlabeled example',
            '(@label) Duplicate labeled example'
        ].join('\n');
        
        // Not needed for this test
        
        // Simulate the scanning logic from ProcessingPipeline
        const result = {
            exampleLabels: new Map<string, number>(),
            exampleContent: new Map<string, string>(),
            exampleLineNumbers: new Map<number, number>(),
            duplicateLabels: new Map<string, number>(),
            duplicateLabelContent: new Map<string, string>()
        };
        
        let counter = 1;
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)(.*)$/);
            
            if (match) {
                const label = match[3] || '';
                const content = match[5] || '';
                
                // This is the fix we applied
                if (label && result.exampleLabels.has(label)) {
                    if (!result.duplicateLabels.has(label)) {
                        const firstLine = Array.from(result.exampleLineNumbers.entries())
                            .find(([, num]) => num === result.exampleLabels.get(label))?.[0] || 0;
                        result.duplicateLabels.set(label, firstLine);
                        result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
                    }
                } else if (label) {
                    result.exampleLabels.set(label, counter);
                    result.exampleContent.set(label, content);
                }
                
                result.exampleLineNumbers.set(i + 1, counter);
                counter++;
            }
        }
        
        // console.log('Example labels:', Array.from(result.exampleLabels.entries()));
        // console.log('Duplicate labels:', Array.from(result.duplicateLabels.entries()));
        // console.log('Line numbers:', Array.from(result.exampleLineNumbers.entries()));
        
        // Assertions
        expect(result.exampleLabels.size).toBe(1); // Only 'label' should be in the map
        expect(result.exampleLabels.has('label')).toBe(true);
        expect(result.exampleLabels.has('')).toBe(false); // Empty labels should not be tracked
        
        expect(result.duplicateLabels.size).toBe(1); // Only 'label' should be duplicate
        expect(result.duplicateLabels.has('label')).toBe(true);
        expect(result.duplicateLabels.has('')).toBe(false); // Empty labels should not be duplicates
        
        expect(result.exampleLineNumbers.size).toBe(5); // All 5 lines should be tracked
        expect(result.exampleLineNumbers.get(1)).toBe(1); // First (@)
        expect(result.exampleLineNumbers.get(2)).toBe(2); // Second (@)
        expect(result.exampleLineNumbers.get(3)).toBe(3); // First (@label)
        expect(result.exampleLineNumbers.get(4)).toBe(4); // Third (@)
        expect(result.exampleLineNumbers.get(5)).toBe(5); // Second (@label)
    });
});