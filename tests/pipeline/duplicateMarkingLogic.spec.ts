import { describe, it, expect } from '@jest/globals';
import { PandocExtendedMarkdownSettings } from '../../src/core/settings';

describe('Duplicate Marking Logic - Only mark 2nd+ occurrences', () => {
    const settings: PandocExtendedMarkdownSettings = {
        enablePandocLists: true,
        strictLineBreaks: false,
        strictPandocMode: false,
        debugMode: false,
        moreExtendedSyntax: false,
        toggleDefinitionStyle: false,
        panelOrder: []
    } as PandocExtendedMarkdownSettings;
    
    // Simulating the fixed scanning logic
    function scanExampleLabelsFixed(content: string) {
        const result = {
            exampleLabels: new Map<string, number>(),
            exampleContent: new Map<string, string>(),
            exampleLineNumbers: new Map<number, number>(),
            duplicateLabels: new Map<string, number>(),
            duplicateLabelContent: new Map<string, string>()
        };
        
        const duplicateLineNumbers = new Set<number>();
        let counter = 1;
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)(.*)$/);
            
            if (match) {
                const label = match[3] || '';
                const content = match[5] || '';
                const lineNum = i + 1;
                
                if (label && result.exampleLabels.has(label)) {
                    // Mark THIS line as duplicate, not the first
                    duplicateLineNumbers.add(lineNum);
                    
                    // Store info about first occurrence for reference
                    if (!result.duplicateLabels.has(label)) {
                        const firstOccurrenceNumber = result.exampleLabels.get(label)!;
                        const firstLine = Array.from(result.exampleLineNumbers.entries())
                            .find(([, num]) => num === firstOccurrenceNumber)?.[0] || 0;
                        result.duplicateLabels.set(label, firstLine);
                        result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
                    }
                } else if (label) {
                    // First occurrence - track it
                    result.exampleLabels.set(label, counter);
                    result.exampleContent.set(label, content);
                }
                
                result.exampleLineNumbers.set(lineNum, counter);
                counter++;
            }
        }
        
        return { ...result, duplicateLineNumbers };
    }
    
    it('should NOT mark the first occurrence of a label as duplicate', () => {
        const content = [
            '(@good) First occurrence',
            '(@good) Second occurrence',
            '(@good) Third occurrence'
        ].join('\n');
        
        const result = scanExampleLabelsFixed(content);
        
        console.log('Duplicate line numbers:', Array.from(result.duplicateLineNumbers));
        console.log('Labels:', Array.from(result.exampleLabels.entries()));
        console.log('Duplicate label info:', Array.from(result.duplicateLabels.entries()));
        
        // First line should NOT be marked as duplicate
        expect(result.duplicateLineNumbers.has(1)).toBe(false);
        
        // Second and third lines SHOULD be marked as duplicates
        expect(result.duplicateLineNumbers.has(2)).toBe(true);
        expect(result.duplicateLineNumbers.has(3)).toBe(true);
        
        // The label should still be tracked with its first occurrence
        expect(result.exampleLabels.get('good')).toBe(1);
        expect(result.duplicateLabels.get('good')).toBe(1); // Points to first line
    });
    
    it('should correctly handle mixed duplicates and unique labels', () => {
        const content = [
            '(@alpha) First alpha',
            '(@beta) First beta', 
            '(@alpha) Second alpha (duplicate)',
            '(@gamma) First gamma',
            '(@beta) Second beta (duplicate)'
        ].join('\n');
        
        const result = scanExampleLabelsFixed(content);
        
        console.log('Duplicate line numbers:', Array.from(result.duplicateLineNumbers));
        
        // First occurrences should NOT be duplicates
        expect(result.duplicateLineNumbers.has(1)).toBe(false); // First alpha
        expect(result.duplicateLineNumbers.has(2)).toBe(false); // First beta
        expect(result.duplicateLineNumbers.has(4)).toBe(false); // First gamma
        
        // Second occurrences SHOULD be duplicates
        expect(result.duplicateLineNumbers.has(3)).toBe(true);  // Second alpha
        expect(result.duplicateLineNumbers.has(5)).toBe(true);  // Second beta
        
        // Check duplicate count
        expect(result.duplicateLineNumbers.size).toBe(2);
    });
    
    it('should not mark any unlabeled examples as duplicates', () => {
        const content = [
            '(@) First unlabeled',
            '(@good) Labeled example',
            '(@) Second unlabeled',
            '(@good) Duplicate labeled',
            '(@) Third unlabeled'
        ].join('\n');
        
        const result = scanExampleLabelsFixed(content);
        
        console.log('Duplicate line numbers:', Array.from(result.duplicateLineNumbers));
        
        // No unlabeled examples should be marked as duplicates
        expect(result.duplicateLineNumbers.has(1)).toBe(false); // First (@)
        expect(result.duplicateLineNumbers.has(3)).toBe(false); // Second (@)
        expect(result.duplicateLineNumbers.has(5)).toBe(false); // Third (@)
        
        // First (@good) should not be duplicate
        expect(result.duplicateLineNumbers.has(2)).toBe(false);
        
        // Second (@good) SHOULD be duplicate
        expect(result.duplicateLineNumbers.has(4)).toBe(true);
        
        // Total duplicates should be 1
        expect(result.duplicateLineNumbers.size).toBe(1);
    });
});