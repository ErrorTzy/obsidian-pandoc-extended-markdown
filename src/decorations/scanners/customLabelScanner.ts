import { Text } from '@codemirror/state';
import { ListPatterns } from '../../patterns';
import { PandocExtendedMarkdownSettings } from '../../settings';
import { PlaceholderContext } from '../../utils/placeholderProcessor';

export interface CustomLabelScanResult {
    customLabels: Map<string, string>;        // processed label -> content
    rawToProcessed: Map<string, string>;      // raw label -> processed label
    duplicateLabels: Set<string>;              // labels that appear more than once
    duplicateLineInfo?: Map<string, { firstLine: number; firstContent: string }>;  // duplicate label -> first occurrence info
    placeholderContext: PlaceholderContext;    // context for placeholder processing
}

/**
 * Collects all placeholders from the document in order.
 */
function collectPlaceholders(doc: Text): string[] {
    const placeholdersInOrder: string[] = [];
    const seenPlaceholders = new Set<string>();
    
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;
        const match = ListPatterns.isCustomLabelList(lineText);
        
        if (match) {
            const rawLabel = match[3];
            const matches = [...rawLabel.matchAll(ListPatterns.PLACEHOLDER_PATTERN)];
            for (const m of matches) {
                const placeholder = m[1];
                if (!seenPlaceholders.has(placeholder)) {
                    placeholdersInOrder.push(placeholder);
                    seenPlaceholders.add(placeholder);
                }
            }
        }
    }
    
    return placeholdersInOrder;
}

/**
 * Checks if placeholder context needs to be reset based on order changes.
 */
function shouldResetContext(
    placeholdersInOrder: string[], 
    existingMappings: Map<string, number>
): boolean {
    if (placeholdersInOrder.length !== existingMappings.size) {
        return true;
    }
    
    for (let i = 0; i < placeholdersInOrder.length; i++) {
        const placeholder = placeholdersInOrder[i];
        const expectedNumber = i + 1;
        const actualNumber = existingMappings.get(placeholder);
        if (actualNumber !== expectedNumber) {
            return true;
        }
    }
    
    return false;
}

/**
 * Scans document for custom labels and tracks duplicates.
 */
export function scanCustomLabels(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    placeholderContext?: PlaceholderContext
): CustomLabelScanResult {
    const customLabels = new Map<string, string>();
    const rawToProcessed = new Map<string, string>();
    const duplicateLabels = new Set<string>();
    const duplicateLineInfo = new Map<string, { firstLine: number; firstContent: string }>();
    const seenLabels = new Map<string, { line: number; content: string }>();
    const context = placeholderContext || new PlaceholderContext();
    
    // Only scan if More Extended Syntax is enabled
    if (!settings.moreExtendedSyntax) {
        return { customLabels, rawToProcessed, duplicateLabels, duplicateLineInfo, placeholderContext: context };
    }
    
    // First pass: collect all placeholders in document order
    const placeholdersInOrder = collectPlaceholders(doc);
    
    // Check if we need to reset based on placeholder order change
    const existingMappings = context.getPlaceholderMappings();
    if (shouldResetContext(placeholdersInOrder, existingMappings)) {
        context.reset();
    }
    
    // Process all labels (this will assign numbers to placeholders in order)
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;
        
        const match = ListPatterns.isCustomLabelList(lineText);
        if (match) {
            const rawLabel = match[3];
            const processedLabel = context.processLabel(rawLabel);
            
            // Store the mapping
            rawToProcessed.set(rawLabel, processedLabel);
            
            // Extract content after the marker
            const contentStart = match[0].length;
            const content = lineText.substring(contentStart).trim();
            
            // Check for duplicates (based on processed label)
            if (seenLabels.has(processedLabel)) {
                // Mark as duplicate
                duplicateLabels.add(processedLabel);
                
                // Store first occurrence info if not already stored
                if (!duplicateLineInfo.has(processedLabel)) {
                    const firstOccurrence = seenLabels.get(processedLabel)!;
                    duplicateLineInfo.set(processedLabel, {
                        firstLine: firstOccurrence.line,
                        firstContent: firstOccurrence.content
                    });
                }
            } else {
                // First occurrence - track it
                seenLabels.set(processedLabel, {
                    line: i,  // line number (1-based)
                    content: content
                });
                
                // Store content in customLabels
                if (content) {
                    customLabels.set(processedLabel, content);
                }
            }
        }
    }
    
    return { customLabels, rawToProcessed, duplicateLabels, duplicateLineInfo, placeholderContext: context };
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