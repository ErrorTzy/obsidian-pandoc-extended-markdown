import { DefinitionList, DefinitionTerm, DefinitionItem } from '../types/listTypes';
import { ListPatterns } from '../patterns';
import { UI_CONSTANTS } from '../../core/constants';

/**
 * Represents a flattened definition list item for panel display
 * @interface DefinitionListItem
 * @property {string} term - The definition term text
 * @property {string[]} definitions - Array of definition texts for this term
 * @property {number} lineNumber - Line number where the term appears in the document
 * @property {Object} position - Position object for cursor navigation
 */
export interface DefinitionListItem {
    term: string;
    definitions: string[];
    lineNumber: number;
    position: { line: number; ch: number };
}

/**
 * Extracts all definition lists from the document content
 * @param content The document content
 * @returns Array of definition list items
 */
export function extractDefinitionLists(content: string): DefinitionListItem[] {
    const lines = content.split('\n');
    const items: DefinitionListItem[] = [];
    
    let currentTerm: string | null = null;
    let currentDefinitions: string[] = [];
    let termLineNumber: number = -1;
    let termPosition: { line: number; ch: number } | null = null;
    let inDefinitionBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for definition marker (: or ~)
        // Match lines that start with optional spaces followed by : or ~
        const defMatch = ListPatterns.isDefinitionMarker(line);
        if (defMatch) {
            // If we haven't found a term yet, skip this definition
            if (!currentTerm) {
                continue;
            }
            
            inDefinitionBlock = true;
            const content = line.substring(defMatch[0].length);
            
            if (content) {
                currentDefinitions.push(content);
            }
            continue;
        }
        
        // Check for continuation lines (indented content without markers)
        if (inDefinitionBlock && line.trim()) {
            const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
            
            // Check if this is a continuation of the previous definition
            // Must be indented at least the standard markdown indent size
            if (leadingSpaces >= UI_CONSTANTS.MARKDOWN_INDENT_SIZE && !ListPatterns.isDefinitionMarker(line)) {
                if (currentDefinitions.length > 0) {
                    // Append to the last definition
                    const lastIndex = currentDefinitions.length - 1;
                    currentDefinitions[lastIndex] += ' ' + line.trim();
                    continue;
                }
            }
        }
        
        // Check if this line could be a term (not a list marker, not empty, not indented too much)
        // Note: Unordered list items must have a space after the marker, so "* item" but not "**bold**"
        const isNotListItem = !line.match(ListPatterns.UNORDERED_LIST) && 
                             !line.match(ListPatterns.NUMBERED_LIST) && 
                             !line.match(ListPatterns.HASH_LIST) &&
                             !line.match(ListPatterns.FANCY_LIST) &&
                             !line.match(ListPatterns.CUSTOM_LABEL_LIST) &&
                             !line.match(ListPatterns.EXAMPLE_LIST) &&
                             !ListPatterns.isDefinitionMarker(line);
        
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
        const isPotentialTerm = line.trim() && leadingSpaces < UI_CONSTANTS.MARKDOWN_INDENT_SIZE && isNotListItem;
        
        if (isPotentialTerm) {
            // Save the previous term if we have one
            if (currentTerm && currentDefinitions.length > 0 && termPosition) {
                items.push({
                    term: currentTerm,
                    definitions: [...currentDefinitions],
                    lineNumber: termLineNumber,
                    position: termPosition
                });
            }
            
            // Start a new term
            currentTerm = line.trim();
            currentDefinitions = [];
            termLineNumber = i;
            termPosition = { line: i, ch: leadingSpaces };
            inDefinitionBlock = false;
        } else if (!line.trim()) {
            // Empty line - just continue, don't end the definition list yet
            // Definitions can have empty lines between them
            continue;
        }
    }
    
    // Save the last term if we have one
    if (currentTerm && currentDefinitions.length > 0 && termPosition) {
        items.push({
            term: currentTerm,
            definitions: [...currentDefinitions],
            lineNumber: termLineNumber,
            position: termPosition
        });
    }
    
    return items;
}