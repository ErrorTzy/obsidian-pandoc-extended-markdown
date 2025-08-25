import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { ListPatterns } from '../patterns';
import { intToRoman, numberToLetter } from './listHelpers';

interface ListItem {
    lineNum: number;
    marker: string;
    punctuation: string;
    spaces: string;
    content: string;
    isRoman: boolean;
    isAlpha: boolean;
}

// Function to renumber all list items after insertion
export function renumberListItems(view: EditorView, insertedLineNum: number): void {
    const state = view.state;
    const doc = state.doc;
    const allLines = doc.toString().split('\n');
    
    // Find the start and end of the current list block
    let blockStart = insertedLineNum;
    let blockEnd = insertedLineNum;
    
    // Get the indentation level of the inserted line
    const insertedLine = allLines[insertedLineNum];
    const insertedIndentMatch = insertedLine.match(ListPatterns.INDENT_ONLY);
    const insertedIndent = insertedIndentMatch ? insertedIndentMatch[1] : '';
    
    // Find the start of the list block (going backwards)
    for (let i = insertedLineNum - 1; i >= 0; i--) {
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
        
        // If this line has less indentation, it's a parent list - include it
        if (lineIndent.length < insertedIndent.length) {
            // This is a parent list item, don't include it in renumbering
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
    
    // Now collect all list items at the same indentation level
    const listItems: ListItem[] = [];
    
    for (let i = blockStart; i <= blockEnd; i++) {
        const line = allLines[i];
        const listMatch = line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST_WITH_CONTENT);
        
        if (listMatch && listMatch[1] === insertedIndent) {
            const marker = listMatch[2];
            const punctuation = listMatch[3];
            const spaces = listMatch[4];
            const content = listMatch[5];
            
            // Determine if it's roman or alphabetic
            let isRoman = false;
            let isAlpha = false;
            
            if (marker === '#') {
                // Hash list - neither roman nor alpha
            } else if (marker.match(ListPatterns.ALPHABETIC_CHARS)) {
                // Could be either roman or alphabetic
                if (marker.length > 1 && marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
                    isRoman = true;
                } else if (marker.length === 1 && marker.match(ListPatterns.SINGLE_ROMAN_CHAR)) {
                    // Single character that could be roman - check context
                    // For renumbering, we'll look at the first item to determine type
                    if (i === blockStart) {
                        // First item - check if it's 'I' or 'i' (assume roman for these)
                        isRoman = marker.match(ListPatterns.SINGLE_I) !== null;
                        if (!isRoman) {
                            // For other single chars, default to alphabetic unless clearly roman
                            isAlpha = true;
                        }
                    } else {
                        // Use the type of the first item
                        isRoman = listItems.length > 0 && listItems[0].isRoman;
                        isAlpha = listItems.length > 0 && listItems[0].isAlpha;
                    }
                } else {
                    isAlpha = true;
                }
            }
            
            listItems.push({
                lineNum: i,
                marker,
                punctuation,
                spaces,
                content,
                isRoman,
                isAlpha
            });
        }
    }
    
    // If we have items to renumber
    if (listItems.length > 1) {
        const changes: Array<{from: number, to: number, insert: string}> = [];
        
        // Determine the starting value based on the first item
        let currentValue = 1;
        const firstItem = listItems[0];
        
        // Renumber all items
        for (let i = 0; i < listItems.length; i++) {
            const item = listItems[i];
            let newMarker: string;
            
            if (item.marker === '#') {
                // Hash lists always use '#'
                newMarker = '#';
            } else if (item.isRoman) {
                // Roman numeral
                const isUpperCase = item.marker[0] === item.marker[0].toUpperCase();
                newMarker = intToRoman(i + 1, isUpperCase);
            } else if (item.isAlpha) {
                // Alphabetic
                const isUpperCase = item.marker[0] === item.marker[0].toUpperCase();
                newMarker = numberToLetter(i + 1, isUpperCase);
            } else {
                // Default to keeping the same marker
                newMarker = item.marker;
            }
            
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
        if (changes.length > 0) {
            const transaction = state.update({ changes });
            view.dispatch(transaction);
        }
    }
}