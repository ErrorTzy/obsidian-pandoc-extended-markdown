import { Text } from '@codemirror/state';

import { ListPatterns } from '../patterns';

interface ListSpacingSettings {
    enforcePandocListSpacing: boolean;
}

export class ListBlockValidator {
    static isListItemForValidation(line: string): boolean {
        return !!(
            ListPatterns.isHashList(line) ||
            ListPatterns.isFancyList(line) ||
            ListPatterns.isExampleList(line) ||
            ListPatterns.isCustomLabelList(line) ||
            ListPatterns.isDefinitionMarker(line) ||
            line.match(ListPatterns.UNORDERED_LIST) ||
            line.match(ListPatterns.NUMBERED_LIST)
        );
    }

    static isListContinuation(line: string, prevWasListItem: boolean): boolean {
        if (!prevWasListItem) return false;
        if (this.isListItemForValidation(line)) return false;

        const indentMatch = line.match(/^(\s+)/);
        if (indentMatch) {
            const indent = indentMatch[1];
            return indent.length >= 2 || indent.includes('\t');
        }

        return false;
    }

    static validateListBlocks(lines: string[], settings: ListSpacingSettings): Set<number> {
        const invalidListBlocks = new Set<number>();
        if (!settings.enforcePandocListSpacing) {
            return invalidListBlocks;
        }

        let listBlockStart = -1;
        let inListBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isCurrentList = this.isListItemForValidation(line);
            const isContinuation = this.isListContinuation(line, inListBlock);
            const prevIsDefinitionTerm = i > 0 && lines[i - 1].trim() &&
                !ListPatterns.isDefinitionMarker(lines[i - 1]) &&
                !ListPatterns.isIndentedContent(lines[i - 1]) &&
                ListPatterns.isDefinitionMarker(line);

            if (isCurrentList && listBlockStart === -1) {
                listBlockStart = i;
                inListBlock = true;
                if (i > 0 && lines[i - 1].trim() !== '' && !prevIsDefinitionTerm) {
                    for (let j = i; j < lines.length &&
                        (this.isListItemForValidation(lines[j]) ||
                            this.isListContinuation(lines[j], true)); j++) {
                        invalidListBlocks.add(j);
                    }
                }
            } else if (!isCurrentList && !isContinuation && listBlockStart !== -1) {
                if (line.trim() !== '') {
                    for (let j = listBlockStart; j < i; j++) {
                        invalidListBlocks.add(j);
                    }
                }
                listBlockStart = -1;
                inListBlock = false;
            }

            if (isCurrentList) {
                const capitalLetterMatch = line.match(ListPatterns.CAPITAL_LETTER_LIST);
                if (capitalLetterMatch && capitalLetterMatch[4].length < 2) {
                    for (let j = i; j >= 0 && this.isListItemForValidation(lines[j]); j--) {
                        invalidListBlocks.add(j);
                    }
                    for (let j = i + 1; j < lines.length &&
                        this.isListItemForValidation(lines[j]); j++) {
                        invalidListBlocks.add(j);
                    }
                }
            }
        }
        return invalidListBlocks;
    }
}

export function validateListBlocks(doc: Text): Set<number> {
    const lines = doc.toString().split('\n');
    const zeroBasedIndices = ListBlockValidator.validateListBlocks(
        lines,
        { enforcePandocListSpacing: true }
    );

    const oneBasedLineNumbers = new Set<number>();
    for (const index of zeroBasedIndices) {
        oneBasedLineNumbers.add(index + 1);
    }
    return oneBasedLineNumbers;
}
