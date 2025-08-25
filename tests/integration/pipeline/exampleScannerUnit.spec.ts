import { describe, it, expect } from '@jest/globals';
import { Text } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

// Since scanExampleLabelsFromDoc is internal to ProcessingPipeline,
// we'll test the logic directly
describe('Example List Scanning Logic', () => {
    const settings: PandocExtendedMarkdownSettings = {
        enablePandocLists: true,
        strictLineBreaks: false,
        strictPandocMode: false,
        debugMode: false,
        moreExtendedSyntax: false,
        toggleDefinitionStyle: false,
        panelOrder: []
    } as PandocExtendedMarkdownSettings;
    
    // Reimplementing the scanning logic for testing
    function scanExampleLabels(content: string) {
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
            // Pattern: /^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)/
            const match = line.match(/^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)(.*)$/);
            
            if (match) {
                const label = match[3] || '';  // The label inside (@...)
                const content = match[5] || '';  // Content after the marker
                
                // FIXED: Only check for duplicates if there's an actual label (not empty)
                if (label && result.exampleLabels.has(label)) {
                    // Track as duplicate
                    if (!result.duplicateLabels.has(label)) {
                        const firstLine = Array.from(result.exampleLineNumbers.entries())
                            .find(([, num]) => num === result.exampleLabels.get(label))?.[0] || 0;
                        result.duplicateLabels.set(label, firstLine);
                        result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
                    }
                } else if (label) {
                    // Only track labeled examples in the labels map
                    result.exampleLabels.set(label, counter);
                    result.exampleContent.set(label, content);
                }
                
                result.exampleLineNumbers.set(i + 1, counter);
                counter++;
            }
        }
        
        return result;
    }
    
    it('should treat unlabeled example lists (@) as separate items, not duplicates', () => {
        const content = [
            '(@) First unlabeled example',
            '(@) Second unlabeled example',
            '(@) Third unlabeled example'
        ].join('\n');
        
        const result = scanExampleLabels(content);
        
        // The bug: all three (@) share empty label "", so they're incorrectly marked as duplicates
        // console.log('Labels map:', Array.from(result.exampleLabels.entries()));
        // console.log('Duplicate labels:', Array.from(result.duplicateLabels.entries()));
        
        // Currently fails because empty labels are treated as duplicates
        expect(result.duplicateLabels.size).toBe(0);  // Should have no duplicates
        expect(result.exampleLineNumbers.size).toBe(3);  // Should track all 3 lines
    });
    
    it('should correctly identify labeled duplicates', () => {
        const content = [
            '(@good) First labeled example',
            '(@good) Second labeled example with same label',
            '(@bad) Different label example'
        ].join('\n');
        
        const result = scanExampleLabels(content);
        
        // console.log('Labels map:', Array.from(result.exampleLabels.entries()));
        // console.log('Duplicate labels:', Array.from(result.duplicateLabels.entries()));
        
        expect(result.duplicateLabels.has('good')).toBe(true);  // 'good' is duplicate
        expect(result.duplicateLabels.has('bad')).toBe(false);   // 'bad' is not duplicate
        expect(result.exampleLabels.size).toBe(2);  // Only 2 unique labels: 'good' and 'bad'
    });
    
    it('should handle mixed labeled and unlabeled lists correctly', () => {
        const content = [
            '(@) Unlabeled 1',
            '(@label) Labeled 1',
            '(@) Unlabeled 2',
            '(@label) Labeled 2 (duplicate)',
            '(@) Unlabeled 3'
        ].join('\n');
        
        const result = scanExampleLabels(content);
        
        // console.log('Labels map:', Array.from(result.exampleLabels.entries()));
        // console.log('Duplicate labels:', Array.from(result.duplicateLabels.entries()));
        // console.log('Line numbers:', Array.from(result.exampleLineNumbers.entries()));
        
        // The bug: empty label "" from all (@) items is incorrectly flagged as duplicate
        expect(result.duplicateLabels.has('')).toBe(false);     // Empty labels should NOT be duplicates
        expect(result.duplicateLabels.has('label')).toBe(true); // 'label' should be duplicate
        expect(result.exampleLineNumbers.size).toBe(5);         // All 5 lines should be tracked
    });
});