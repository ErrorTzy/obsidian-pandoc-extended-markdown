import { ListPatterns } from '../../patterns';
import { PandocExtendedMarkdownSettings } from '../../settings';

export class ListBlockValidator {
    static isListItemForValidation(line: string): boolean {
        // Check for various list patterns
        return !!(
            ListPatterns.isHashList(line) || // Hash auto-numbering
            ListPatterns.isFancyList(line) || // Fancy lists
            ListPatterns.isExampleList(line) || // Example lists
            ListPatterns.isDefinitionMarker(line) || // Definition lists
            line.match(ListPatterns.UNORDERED_LIST) || // Unordered lists
            line.match(ListPatterns.NUMBERED_LIST) // Regular numbered lists
        );
    }

    static validateListBlocks(lines: string[], settings: PandocExtendedMarkdownSettings): Set<number> {
        const invalidListBlocks = new Set<number>();
        if (!settings.strictPandocMode) {
            return invalidListBlocks;
        }

        let listBlockStart = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isCurrentList = this.isListItemForValidation(line);
            const prevIsListOrEmpty = i > 0 && (this.isListItemForValidation(lines[i - 1]) || lines[i - 1].trim() === '');
            
            // Check if previous line is a definition term (special case)
            const prevIsDefinitionTerm = i > 0 && lines[i - 1].trim() && 
                !lines[i - 1].match(/^\s*[~:]\s+/) && 
                !lines[i - 1].match(/^(    |\t)/) &&
                line.match(/^\s*[~:]\s+/);
            
            if (isCurrentList && listBlockStart === -1) {
                // Start of a new list block
                listBlockStart = i;
                // Check if it has proper empty line before (unless first line or after a definition term)
                if (i > 0 && lines[i - 1].trim() !== '' && !prevIsDefinitionTerm) {
                    // Mark entire block as invalid
                    for (let j = i; j < lines.length && this.isListItemForValidation(lines[j]); j++) {
                        invalidListBlocks.add(j);
                    }
                }
            } else if (!isCurrentList && listBlockStart !== -1) {
                // End of list block
                // Check if there's proper empty line after (unless it's an empty line)
                if (line.trim() !== '') {
                    // Mark entire previous block as invalid
                    for (let j = listBlockStart; j < i; j++) {
                        invalidListBlocks.add(j);
                    }
                }
                listBlockStart = -1;
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