import { ListPatterns } from '../../shared/patterns';
import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { Text } from '@codemirror/state';

export class ListBlockValidator {
    static isListItemForValidation(line: string): boolean {
        // Check for various list patterns
        return !!(
            ListPatterns.isHashList(line) || // Hash auto-numbering
            ListPatterns.isFancyList(line) || // Fancy lists
            ListPatterns.isExampleList(line) || // Example lists
            ListPatterns.isCustomLabelList(line) || // Custom label lists
            ListPatterns.isDefinitionMarker(line) || // Definition lists
            line.match(ListPatterns.UNORDERED_LIST) || // Unordered lists
            line.match(ListPatterns.NUMBERED_LIST) // Regular numbered lists
        );
    }
    
    static isListContinuation(line: string, prevWasListItem: boolean): boolean {
        // A line is a continuation if:
        // 1. Previous line was a list item or continuation
        // 2. Current line is indented (at least 2 spaces or a tab)
        // 3. Current line is not itself a list item
        if (!prevWasListItem) return false;
        if (this.isListItemForValidation(line)) return false;
        
        // Check if line is properly indented
        const indentMatch = line.match(/^(\s+)/);
        if (indentMatch) {
            const indent = indentMatch[1];
            // Need at least 2 spaces or a tab for continuation
            return indent.length >= 2 || indent.includes('\t');
        }
        
        return false;
    }

    static validateListBlocks(lines: string[], settings: PandocExtendedMarkdownSettings): Set<number> {
        const invalidListBlocks = new Set<number>();
        if (!settings.strictPandocMode) {
            return invalidListBlocks;
        }

        let listBlockStart = -1;
        let inListBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isCurrentList = this.isListItemForValidation(line);
            const isContinuation = this.isListContinuation(line, inListBlock);
            
            // Check if previous line is a definition term (special case)
            const prevIsDefinitionTerm = i > 0 && lines[i - 1].trim() && 
                !ListPatterns.isDefinitionMarker(lines[i - 1]) && 
                !ListPatterns.isIndentedContent(lines[i - 1]) &&
                ListPatterns.isDefinitionMarker(line);
            
            if (isCurrentList && listBlockStart === -1) {
                // Start of a new list block
                listBlockStart = i;
                inListBlock = true;
                // Check if it has proper empty line before (unless first line or after a definition term)
                if (i > 0 && lines[i - 1].trim() !== '' && !prevIsDefinitionTerm) {
                    // Mark entire block as invalid
                    for (let j = i; j < lines.length && (this.isListItemForValidation(lines[j]) || this.isListContinuation(lines[j], true)); j++) {
                        invalidListBlocks.add(j);
                    }
                }
            } else if (!isCurrentList && !isContinuation && listBlockStart !== -1) {
                // End of list block
                // Check if there's proper empty line after (unless it's an empty line)
                if (line.trim() !== '') {
                    // Mark entire previous block as invalid
                    for (let j = listBlockStart; j < i; j++) {
                        invalidListBlocks.add(j);
                    }
                }
                listBlockStart = -1;
                inListBlock = false;
            }
            
            // Check for capital letter spacing issue
            if (isCurrentList) {
                const capitalLetterMatch = line.match(ListPatterns.CAPITAL_LETTER_LIST);
                if (capitalLetterMatch && capitalLetterMatch[4].length < 2) {
                    // Mark entire block as invalid
                    for (let j = i; j >= 0 && this.isListItemForValidation(lines[j]); j--) {
                        invalidListBlocks.add(j);
                    }
                    for (let j = i + 1; j < lines.length && this.isListItemForValidation(lines[j]); j++) {
                        invalidListBlocks.add(j);
                    }
                }
            }
        }
        return invalidListBlocks;
    }
}

// Helper function for use with Text objects
export function validateListBlocks(doc: Text): Set<number> {
    const lines = doc.toString().split('\n');
    const zeroBasedIndices = ListBlockValidator.validateListBlocks(lines, { strictPandocMode: true } as PandocExtendedMarkdownSettings);
    
    // Convert to 1-based line numbers for CodeMirror
    const oneBasedLineNumbers = new Set<number>();
    for (const index of zeroBasedIndices) {
        oneBasedLineNumbers.add(index + 1);
    }
    return oneBasedLineNumbers;
}
