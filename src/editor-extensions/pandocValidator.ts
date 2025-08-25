import { ValidationContext, LintingIssue } from '../shared/types/listTypes';

import { INDENTATION } from '../core/constants';

import { ListPatterns } from '../shared/patterns';

/**
 * Validates whether the current line conforms to strict Pandoc formatting rules.
 * In strict mode, lists must be surrounded by empty lines and capital letter lists
 * with periods require double spacing.
 * 
 * @param context - The validation context containing lines and current position
 * @param strictMode - Whether to enforce strict Pandoc formatting rules
 * @returns True if formatting is valid or strict mode is disabled, false otherwise
 * @throws Does not throw exceptions - returns false for validation failures
 * @example
 * const context = { lines: ['', 'A. First item', ''], currentLine: 1 };
 * const isValid = isStrictPandocFormatting(context, true); // returns true
 */
export function isStrictPandocFormatting(context: ValidationContext, strictMode: boolean): boolean {
    if (!strictMode) {
        return true;
    }

    const { lines, currentLine } = context;
    const line = lines[currentLine];
    
    // Check if previous line is also a list item (part of same list block)
    const isPartOfListBlock = currentLine > 0 && isListItem(lines[currentLine - 1], false);
    
    // Check for empty line before list (unless it's the first line or part of a list block)
    if (currentLine > 0 && !isPartOfListBlock) {
        const prevLine = lines[currentLine - 1];
        if (prevLine.trim() !== '') {
            return false;
        }
    }
    
    // Check for capital letter lists requiring double space
    const capitalLetterMatch = line.match(ListPatterns.CAPITAL_LETTER_LIST);
    if (capitalLetterMatch && capitalLetterMatch[3] === '.') {
        // Capital letter with period requires at least 2 spaces
        if (capitalLetterMatch[4].length < INDENTATION.DOUBLE_SPACE) {
            return false;
        }
    }
    
    // Check if this is part of a list block and verify empty line after
    let isLastItemInList = true;
    if (currentLine < lines.length - 1) {
        const nextLine = lines[currentLine + 1];
        // Check if next line is also a list item
        const nextIsListItem = isListItem(nextLine, false);
        
        if (!nextIsListItem && nextLine.trim() !== '') {
            // Next line is not a list item and not empty - invalid in strict mode
            return false;
        }
        
        if (nextIsListItem) {
            isLastItemInList = false;
        }
    }
    
    return true;
}

export function isListItem(line: string, includeCustomLabels: boolean = false): boolean {
    // Check for various list patterns
    if (ListPatterns.FANCY_LIST_WITH_NUMBERS.test(line) ||
        ListPatterns.STANDARD_ORDERED_LIST.test(line) ||
        ListPatterns.UNORDERED_LIST.test(line) ||
        ListPatterns.isExampleList(line) ||
        ListPatterns.isDefinitionMarker(line)) {
        return true;
    }
    
    // Add custom label lists if enabled
    if (includeCustomLabels && ListPatterns.isCustomLabelList(line)) {
        return true;
    }
    
    return false;
}

export function isStrictPandocHeading(context: ValidationContext, strictMode: boolean): boolean {
    if (!strictMode) {
        return true;
    }
    
    const { lines, currentLine } = context;
    const line = lines[currentLine];
    
    if (!ListPatterns.isHeading(line)) {
        return true; // Not a heading
    }
    
    // Check for empty line before heading (unless it's the first line)
    if (currentLine > 0) {
        const prevLine = lines[currentLine - 1];
        if (prevLine.trim() !== '') {
            return false;
        }
    }
    
    // Check for empty line after heading (unless it's the last line)
    if (currentLine < lines.length - 1) {
        const nextLine = lines[currentLine + 1];
        if (nextLine.trim() !== '') {
            return false;
        }
    }
    
    return true;
}

/**
 * Formats markdown content to comply with Pandoc standard formatting rules.
 * Automatically adds empty lines before and after lists and headings, and ensures
 * proper spacing for capital letter lists with periods.
 * 
 * @param content - The raw markdown content to format
 * @param moreExtendedSyntax - Whether to include custom label lists in formatting
 * @returns The formatted markdown content with proper Pandoc spacing
 * @throws Does not throw exceptions - handles malformed input gracefully
 * @example
 * const content = 'Some text\nA.First item\nNext paragraph';
 * const formatted = formatToPandocStandard(content);
 * // Returns: 'Some text\n\nA.  First item\n\nNext paragraph'
 */
export function formatToPandocStandard(content: string, moreExtendedSyntax: boolean = false): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inListBlock = false;
    let lastWasEmpty = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isCurrentLineList = isListItem(line, moreExtendedSyntax);
        const isCurrentLineHeading = ListPatterns.isHeading(line);
        const isEmpty = line.trim() === '';
        
        // Handle transition into list block
        if (isCurrentLineList && !inListBlock) {
            // Add empty line before list if needed
            if (result.length > 0 && !lastWasEmpty) {
                result.push('');
            }
            inListBlock = true;
        }
        
        // Handle transition out of list block
        if (!isCurrentLineList && !isEmpty && inListBlock) {
            // Add empty line after list if needed
            if (!lastWasEmpty) {
                result.push('');
            }
            inListBlock = false;
        }
        
        // Handle headings
        if (isCurrentLineHeading) {
            // Add empty line before heading if needed (but not at the beginning of the document)
            if (result.length > 0 && !lastWasEmpty && i > 0) {
                result.push('');
            }
            
            // Process the heading line
            let formattedLine = line;
            result.push(formattedLine);
            
            // Add empty line after heading if next line exists and is not empty
            if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
                result.push('');
                lastWasEmpty = true;
            } else {
                lastWasEmpty = false;
            }
            continue;
        }
        
        // Handle capital letter lists with period - ensure double space
        const capitalLetterMatch = line.match(ListPatterns.CAPITAL_LETTER_LIST);
        if (capitalLetterMatch && capitalLetterMatch[4].length < INDENTATION.DOUBLE_SPACE) {
            // Add double space after capital letter with period
            const formattedLine = line.replace(ListPatterns.CAPITAL_LETTER_REPLACE, '$1$2  ');
            result.push(formattedLine);
        } else {
            result.push(line);
        }
        
        lastWasEmpty = isEmpty;
    }
    
    // Clean up any multiple consecutive empty lines
    const cleanedResult: string[] = [];
    let prevWasEmpty = false;
    for (const line of result) {
        if (line.trim() === '') {
            if (!prevWasEmpty) {
                cleanedResult.push(line);
                prevWasEmpty = true;
            }
        } else {
            cleanedResult.push(line);
            prevWasEmpty = false;
        }
    }
    
    return cleanedResult.join('\n');
}

/**
 * Analyzes markdown content and returns a list of Pandoc formatting violations.
 * Checks for missing empty lines around lists and headings, and validates
 * spacing requirements for capital letter lists.
 * 
 * @param content - The markdown content to analyze for formatting issues
 * @param moreExtendedSyntax - Whether to include custom label lists in validation
 * @returns Array of LintingIssue objects describing formatting problems with line numbers
 * @throws Does not throw exceptions - returns empty array for valid content
 * @example
 * const content = 'Text\nA.Item\nMore text';
 * const issues = checkPandocFormatting(content);
 * // Returns issues for missing empty lines and insufficient spacing
 */
export function checkPandocFormatting(content: string, moreExtendedSyntax: boolean = false): LintingIssue[] {
    const lines = content.split('\n');
    const issues: LintingIssue[] = [];
    let inListBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isCurrentLineList = isListItem(line, moreExtendedSyntax);
        const isCurrentLineHeading = ListPatterns.isHeading(line);
        const isEmpty = line.trim() === '';
        
        // Check list formatting
        if (isCurrentLineList) {
            // Check for empty line before list
            if (!inListBlock && i > 0 && lines[i - 1].trim() !== '') {
                issues.push({
                    line: i + 1,
                    message: 'List should have an empty line before it'
                });
            }
            
            // Check capital letter lists with period
            const capitalLetterMatch = line.match(ListPatterns.CAPITAL_LETTER_LIST);
            if (capitalLetterMatch && capitalLetterMatch[4].length < INDENTATION.DOUBLE_SPACE) {
                issues.push({
                    line: i + 1,
                    message: 'Capital letter list with period requires at least 2 spaces after marker'
                });
            }
            
            inListBlock = true;
        } else if (!isEmpty && inListBlock) {
            // Non-empty, non-list line after list
            if (i > 0 && isListItem(lines[i - 1])) {
                issues.push({
                    line: i,
                    message: 'List should have an empty line after it'
                });
            }
            inListBlock = false;
        } else if (isEmpty) {
            inListBlock = false;
        }
        
        // Check heading formatting
        if (isCurrentLineHeading) {
            // Check for empty line before heading (but not at the beginning of the document)
            if (i > 0 && lines[i - 1].trim() !== '') {
                issues.push({
                    line: i + 1,
                    message: 'Heading should have an empty line before it'
                });
            }
            
            // Check for empty line after heading
            if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
                issues.push({
                    line: i + 1,
                    message: 'Heading should have an empty line after it'
                });
            }
        }
    }
    
    return issues;
}