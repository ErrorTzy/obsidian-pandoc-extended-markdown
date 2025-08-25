import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { ListPatterns } from '../patterns';
import { intToRoman, numberToLetter } from './listHelpers';
import { ListItem } from '../types/listTypes';
import { NUMERIC_CONSTANTS } from '../../core/constants';

/**
 * Information about the boundaries of a list block
 */
interface ListBlockBoundaries {
    blockStart: number;
    blockEnd: number;
    insertedIndent: string;
}

/**
 * Information about a list marker type determination
 */
interface ListTypeInfo {
    isRoman: boolean;
    isAlpha: boolean;
}

/**
 * Find the start and end boundaries of a list block at a given indentation level
 * @param allLines - Array of all document lines
 * @param insertedLineNum - The line number where a new item was inserted
 * @returns Object containing block boundaries and indentation information
 */
function findBlockBoundaries(allLines: string[], insertedLineNum: number): ListBlockBoundaries {
    let blockStart = insertedLineNum;
    let blockEnd = insertedLineNum;
    
    // Get the indentation level of the inserted line
    const insertedLine = allLines[insertedLineNum];
    const insertedIndentMatch = insertedLine.match(ListPatterns.INDENT_ONLY);
    const insertedIndent = insertedIndentMatch ? insertedIndentMatch[1] : '';
    
    // Find the start of the list block (going backwards)
    for (let i = insertedLineNum - 1; i >= NUMERIC_CONSTANTS.MIN_DOC_POSITION; i--) {
        const line = allLines[i];
        
        // Skip empty lines
        if (!line.trim()) {
            continue;
        }
        
        // Check if this line is a list item with same or less indentation
        const listMatch = line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST);
        if (!listMatch) {
            // Not a list item, stop here
            break;
        }
        
        const lineIndent = listMatch[1];
        
        // If this line has less indentation, it's a parent list - don't include it
        if (lineIndent.length < insertedIndent.length) {
            break;
        }
        
        // If same indentation, include in the block
        if (lineIndent === insertedIndent) {
            blockStart = i;
        }
        
        // If more indentation, it's a nested list - skip it but continue looking
    }
    
    // Find the end of the list block (going forwards)
    for (let i = insertedLineNum + 1; i < allLines.length; i++) {
        const line = allLines[i];
        
        // Skip empty lines within the list
        if (!line.trim()) {
            continue;
        }
        
        // Check if this line is a list item
        const listMatch = line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST);
        if (!listMatch) {
            // Not a list item, stop here
            break;
        }
        
        const lineIndent = listMatch[1];
        
        // If this line has less indentation, it's a different list level
        if (lineIndent.length < insertedIndent.length) {
            break;
        }
        
        // If same indentation, include in the block
        if (lineIndent === insertedIndent) {
            blockEnd = i;
        }
        
        // If more indentation, it's a nested list - continue but don't update blockEnd
    }
    
    return {
        blockStart,
        blockEnd,
        insertedIndent
    };
}

/**
 * Collect all list items at the same indentation level within a block
 * @param allLines - Array of all document lines
 * @param boundaries - Block boundary information
 * @returns Array of ListItem objects
 */
function collectListItems(allLines: string[], boundaries: ListBlockBoundaries): ListItem[] {
    const listItems: ListItem[] = [];
    const { blockStart, blockEnd, insertedIndent } = boundaries;
    
    for (let i = blockStart; i <= blockEnd; i++) {
        const line = allLines[i];
        const listMatch = line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST_WITH_CONTENT);
        
        if (listMatch && listMatch[1] === insertedIndent) {
            const marker = listMatch[2];
            const punctuation = listMatch[3];
            const spaces = listMatch[4];
            const content = listMatch[5];
            
            // Determine list type for this item
            const typeInfo = determineListType(marker, i, blockStart, listItems);
            
            listItems.push({
                lineNum: i,
                marker,
                punctuation,
                spaces,
                content,
                isRoman: typeInfo.isRoman,
                isAlpha: typeInfo.isAlpha
            });
        }
    }
    
    return listItems;
}

/**
 * Determine whether a list marker represents a roman numeral or alphabetic list
 * @param marker - The list marker string
 * @param currentLineIndex - Current line index being processed
 * @param blockStartIndex - Index of the first line in the block
 * @param existingItems - Already processed list items for context
 * @returns Object indicating list type flags
 */
function determineListType(
    marker: string,
    currentLineIndex: number,
    blockStartIndex: number,
    existingItems: ListItem[]
): ListTypeInfo {
    let isRoman = false;
    let isAlpha = false;
    
    if (marker === '#') {
        // Hash list - neither roman nor alpha
        return { isRoman, isAlpha };
    }
    
    if (!marker.match(ListPatterns.ALPHABETIC_CHARS)) {
        return { isRoman, isAlpha };
    }
    
    // Could be either roman or alphabetic
    if (marker.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER && 
        marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
        isRoman = true;
    } else if (marker.length === NUMERIC_CONSTANTS.SINGLE_CHARACTER && 
               marker.match(ListPatterns.SINGLE_ROMAN_CHAR)) {
        // Single character that could be roman - check context
        if (currentLineIndex === blockStartIndex) {
            // First item - check if it's 'I' or 'i' (assume roman for these)
            isRoman = marker.match(ListPatterns.SINGLE_I) !== null;
            if (!isRoman) {
                // For other single chars, default to alphabetic unless clearly roman
                isAlpha = true;
            }
        } else {
            // Use the type of the first item for consistency
            isRoman = existingItems.length > NUMERIC_CONSTANTS.EMPTY_LENGTH && 
                     existingItems[NUMERIC_CONSTANTS.FIRST_INDEX].isRoman;
            isAlpha = existingItems.length > NUMERIC_CONSTANTS.EMPTY_LENGTH && 
                     existingItems[NUMERIC_CONSTANTS.FIRST_INDEX].isAlpha;
        }
    } else {
        isAlpha = true;
    }
    
    return { isRoman, isAlpha };
}

/**
 * Calculate the new marker for a list item based on its position and type
 * @param item - The list item to calculate marker for
 * @param itemIndex - Zero-based index of the item in the list
 * @returns The new marker string
 */
function calculateNewMarker(item: ListItem, itemIndex: number): string {
    if (item.marker === '#') {
        // Hash lists always use '#'
        return '#';
    }
    
    if (item.isRoman) {
        // Roman numeral
        const isUpperCase = item.marker[NUMERIC_CONSTANTS.FIRST_INDEX] === 
                           item.marker[NUMERIC_CONSTANTS.FIRST_INDEX].toUpperCase();
        return intToRoman(itemIndex + 1, isUpperCase);
    }
    
    if (item.isAlpha) {
        // Alphabetic
        const isUpperCase = item.marker[NUMERIC_CONSTANTS.FIRST_INDEX] === 
                           item.marker[NUMERIC_CONSTANTS.FIRST_INDEX].toUpperCase();
        return numberToLetter(itemIndex + 1, isUpperCase);
    }
    
    // Default to keeping the same marker
    return item.marker;
}

/**
 * Validate that a list block has enough items to warrant renumbering
 * @param listItems - Array of list items in the block
 * @returns True if the block should be renumbered
 */
function validateListBlock(listItems: ListItem[]): boolean {
    return listItems.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER;
}

/**
 * Apply renumbering changes to the editor
 * @param view - The editor view
 * @param listItems - Array of list items to renumber
 * @param insertedIndent - Indentation string for the list items
 */
function applyNumberingChanges(
    view: EditorView,
    listItems: ListItem[],
    insertedIndent: string
): void {
    const state = view.state;
    const doc = state.doc;
    const allLines = doc.toString().split('\n');
    const changes: Array<{from: number, to: number, insert: string}> = [];
    
    // Renumber all items
    for (let i = NUMERIC_CONSTANTS.FIRST_INDEX; i < listItems.length; i++) {
        const item = listItems[i];
        const newMarker = calculateNewMarker(item, i);
        
        // Build the new line
        const newLine = `${insertedIndent}${newMarker}${item.punctuation}${item.spaces}${item.content}`;
        const oldLine = allLines[item.lineNum];
        
        // Only add a change if the line actually changed
        if (newLine !== oldLine) {
            const lineStartPos = doc.line(item.lineNum + 1).from;
            const lineEndPos = doc.line(item.lineNum + 1).to;
            
            changes.push({
                from: lineStartPos,
                to: lineEndPos,
                insert: newLine
            });
        }
    }
    
    // Apply all changes if there are any
    if (changes.length > NUMERIC_CONSTANTS.EMPTY_LENGTH) {
        const transaction = state.update({ changes });
        view.dispatch(transaction);
    }
}

/**
 * Renumber all list items in a block after insertion of a new item.
 * This function finds the list block boundaries, collects all items at the same
 * indentation level, determines their types, and applies sequential renumbering.
 * 
 * @param view - The CodeMirror editor view
 * @param insertedLineNum - The line number where a new item was inserted (0-based)
 */
export function renumberListItems(view: EditorView, insertedLineNum: number): void {
    const state = view.state;
    const doc = state.doc;
    const allLines = doc.toString().split('\n');
    
    // Find the boundaries of the current list block
    const boundaries = findBlockBoundaries(allLines, insertedLineNum);
    
    // Collect all list items at the same indentation level
    const listItems = collectListItems(allLines, boundaries);
    
    // Validate that renumbering is needed and apply changes
    if (validateListBlock(listItems)) {
        applyNumberingChanges(view, listItems, boundaries.insertedIndent);
    }
}