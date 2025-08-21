import { Text } from '@codemirror/state';
import { ListPatterns } from '../../patterns';
import { PandocExtendedMarkdownSettings } from '../../settings';

export interface CustomLabelScanResult {
    customLabels: Map<string, string>;        // label -> content
    duplicateLabels: Set<string>;              // labels that appear more than once
}

export function scanCustomLabels(
    doc: Text,
    settings: PandocExtendedMarkdownSettings
): CustomLabelScanResult {
    const customLabels = new Map<string, string>();
    const duplicateLabels = new Set<string>();
    const seenLabels = new Set<string>();
    
    // Only scan if More Extended Syntax is enabled
    if (!settings.moreExtendedSyntax) {
        return { customLabels, duplicateLabels };
    }
    
    // Process each line in the document
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;
        
        const match = ListPatterns.isCustomLabelList(lineText);
        if (match) {
            const label = match[3];
            
            // Check for duplicates
            if (seenLabels.has(label)) {
                duplicateLabels.add(label);
            } else {
                seenLabels.add(label);
                
                // Extract content after the marker
                const contentStart = match[0].length;
                const content = lineText.substring(contentStart).trim();
                if (content) {
                    customLabels.set(label, content);
                }
            }
        }
    }
    
    return { customLabels, duplicateLabels };
}

export function validateCustomLabelBlocks(
    doc: Text,
    settings: PandocExtendedMarkdownSettings
): Set<number> {
    const invalidLines = new Set<number>();
    
    // Only validate if More Extended Syntax is enabled AND strict pandoc mode is enabled
    if (!settings.moreExtendedSyntax || !settings.strictPandocMode) {
        return invalidLines;
    }
    
    // First pass: identify all blocks and their validity
    const blocks: { start: number; end: number; valid: boolean }[] = [];
    let inBlock = false;
    let blockStart = -1;
    let blockValid = true;
    
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;  // Don't trim - pattern needs to match from start
        const isCustomLabel = ListPatterns.isCustomLabelList(lineText);
        
        if (isCustomLabel) {
            if (!inBlock) {
                // Starting a new block
                inBlock = true;
                blockStart = i;
                blockValid = true;
                
                // Check if there's a valid line before (must be blank or start of document)
                if (i > 1) {
                    const prevLine = doc.line(i - 1);
                    if (prevLine.text.trim() !== '') {
                        // Previous line is not blank, block is invalid
                        blockValid = false;
                    }
                }
            }
            // If already in block, this line continues the block
        } else if (inBlock) {
            // We've left the block
            const blockEnd = i - 1;
            
            // Check if current line is blank (valid block end) or not
            if (line.text.trim() !== '') {
                // Non-blank line after block, block is invalid
                blockValid = false;
            }
            
            // Save the block info
            blocks.push({ start: blockStart, end: blockEnd, valid: blockValid });
            inBlock = false;
        }
    }
    
    // Handle case where document ends while still in a block
    if (inBlock) {
        // Ending at document boundary is valid
        blocks.push({ start: blockStart, end: doc.lines, valid: blockValid });
    }
    
    // Second pass: mark all lines in invalid blocks as invalid
    for (const block of blocks) {
        if (!block.valid) {
            for (let i = block.start; i <= block.end; i++) {
                invalidLines.add(i - 1);  // Convert to 0-based index
            }
        }
    }
    
    return invalidLines;
}