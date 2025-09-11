import { Text } from '@codemirror/state';
import { CodeRegion } from '../../../shared/types/codeTypes';
import { ListPatterns } from '../../../shared/patterns';

/**
 * Detects code blocks, inline code, and math regions in a document
 */
export function detectCodeRegions(doc: Text): CodeRegion[] {
    const regions: CodeRegion[] = [];
    const text = doc.toString();
    
    // Detect code blocks (``` or ~~~)
    detectCodeBlocks(text, regions);
    
    // Detect inline code (backticks) - but skip those in code blocks
    detectInlineCode(text, regions);
    
    // Detect math regions ($...$ and $$...$$)
    detectMathRegions(text, regions);
    
    return regions;
}

/**
 * Detect code blocks in the text
 */
function detectCodeBlocks(text: string, regions: CodeRegion[]): void {
    // Match code blocks with ``` or ~~~
    const codeBlockRegex = ListPatterns.CODE_BLOCK_FENCE;
    let match;
    let inCodeBlock = false;
    let codeBlockStart = -1;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (!inCodeBlock) {
            inCodeBlock = true;
            codeBlockStart = match.index;
        } else {
            // End of code block
            regions.push({
                from: codeBlockStart,
                to: match.index + match[0].length,
                type: 'codeblock'
            });
            inCodeBlock = false;
            codeBlockStart = -1;
        }
    }
    
    // Handle unclosed code block
    if (inCodeBlock && codeBlockStart !== -1) {
        regions.push({
            from: codeBlockStart,
            to: text.length,
            type: 'codeblock'
        });
    }
}

/**
 * Detect inline code regions in the text
 * 
 * This function identifies inline code marked by single backticks (`).
 * It handles several edge cases:
 * 1. Escaped backticks (\`) are not treated as code delimiters
 * 2. Backticks inside code blocks are ignored (already marked as code)
 * 3. Unclosed backticks are skipped (no matching closing backtick)
 * 
 * Algorithm:
 * - Iterate through each character in the text
 * - Skip positions already inside code blocks
 * - When a backtick is found, check if it's escaped
 * - If not escaped, search for the matching closing backtick
 * - Mark the region between backticks as inline code
 * 
 * @param text - The document text to scan
 * @param regions - Array to add found inline code regions to
 */
function detectInlineCode(text: string, regions: CodeRegion[]): void {
    let i = 0;
    while (i < text.length) {
        // Skip if we're inside a code block
        if (isInCodeBlock(i, regions)) {
            i++;
            continue;
        }
        
        // Look for backtick
        if (text[i] === '`') {
            // Check if it's escaped with backslash
            if (i > 0 && text[i - 1] === '\\') {
                i++;
                continue;
            }
            
            // Search for the matching closing backtick
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === '`') {
                    // Check if the closing backtick is escaped
                    if (j > 0 && text[j - 1] === '\\') {
                        j++;
                        continue;
                    }
                    
                    // Found valid closing backtick - mark as inline code
                    regions.push({
                        from: i,
                        to: j + 1,
                        type: 'inline-code'
                    });
                    i = j + 1;
                    break;
                }
                j++;
            }
            
            // If no closing backtick found, skip this backtick
            if (j >= text.length) {
                i++;
            }
        } else {
            i++;
        }
    }
}

/**
 * Check if a position is inside a code block
 */
function isInCodeBlock(pos: number, regions: CodeRegion[]): boolean {
    for (const region of regions) {
        if (region.type === 'codeblock' && pos >= region.from && pos < region.to) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a line is entirely inside a code block (not inline code)
 */
export function isLineInCodeBlock(lineNumber: number, doc: Text, codeRegions: CodeRegion[]): boolean {
    const line = doc.line(lineNumber);
    
    // Only check code blocks, not inline code
    for (const region of codeRegions) {
        if (region.type === 'codeblock') {
            // Check if the entire line is within the code block
            if (line.from >= region.from && line.to <= region.to) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Check if a line is inside a code region (code block or inline code)
 * This is kept for backward compatibility but should be used carefully
 */
export function isLineInCodeRegion(lineNumber: number, doc: Text, codeRegions: CodeRegion[]): boolean {
    return isLineInCodeBlock(lineNumber, doc, codeRegions);
}

/**
 * Check if a position range is completely inside a code region
 */
export function isRangeCompletelyInCodeRegion(from: number, to: number, codeRegions: CodeRegion[]): boolean {
    for (const region of codeRegions) {
        // Check if the range is completely inside a code region
        if (from >= region.from && to <= region.to) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a position range overlaps with any code region
 */
export function isRangeInCodeRegion(from: number, to: number, codeRegions: CodeRegion[]): boolean {
    return isRangeCompletelyInCodeRegion(from, to, codeRegions);
}

/**
 * Detect math regions in the text
 * 
 * This function identifies both inline math ($...$) and display math ($$...$$).
 * It handles several edge cases:
 * 1. Escaped dollar signs (\$) are not treated as math delimiters
 * 2. Display math ($$) is prioritized over inline math
 * 3. Math inside code blocks is ignored (already marked as code)
 * 4. Unclosed math expressions are skipped
 * 
 * @param text - The document text to scan
 * @param regions - Array to add found math regions to
 */
function detectMathRegions(text: string, regions: CodeRegion[]): void {
    let i = 0;
    while (i < text.length) {
        // Skip if we're inside a code block or inline code
        if (isInExistingRegion(i, regions)) {
            i++;
            continue;
        }
        
        // Look for dollar sign
        if (text[i] === '$') {
            // Check if it's escaped with backslash
            if (i > 0 && text[i - 1] === '\\') {
                i++;
                continue;
            }
            
            // Check for display math ($$)
            if (i + 1 < text.length && text[i + 1] === '$') {
                // Search for closing $$
                let j = i + 2;
                while (j < text.length - 1) {
                    if (text[j] === '$' && text[j + 1] === '$') {
                        // Check if the closing $$ is escaped
                        if (j > 0 && text[j - 1] === '\\') {
                            j++;
                            continue;
                        }
                        
                        // Found valid closing $$ - mark as display math
                        regions.push({
                            from: i,
                            to: j + 2,
                            type: 'math'
                        });
                        i = j + 2;
                        break;
                    }
                    j++;
                }
                
                // If no closing $$ found, skip these dollar signs
                if (j >= text.length - 1) {
                    i += 2;
                }
            } else {
                // Single $ - look for inline math
                let j = i + 1;
                while (j < text.length) {
                    if (text[j] === '$') {
                        // Check if the closing $ is escaped
                        if (j > 0 && text[j - 1] === '\\') {
                            j++;
                            continue;
                        }
                        
                        // Found valid closing $ - mark as inline math
                        regions.push({
                            from: i,
                            to: j + 1,
                            type: 'math'
                        });
                        i = j + 1;
                        break;
                    }
                    j++;
                }
                
                // If no closing $ found, skip this dollar sign
                if (j >= text.length) {
                    i++;
                }
            }
        } else {
            i++;
        }
    }
}

/**
 * Check if a position is inside any existing region (code block, inline code, or math)
 */
function isInExistingRegion(pos: number, regions: CodeRegion[]): boolean {
    for (const region of regions) {
        if (pos >= region.from && pos < region.to) {
            return true;
        }
    }
    return false;
}