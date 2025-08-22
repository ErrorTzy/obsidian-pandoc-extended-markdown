import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection, Transaction } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from './settings';
import { INDENTATION } from './constants';
import { ListPatterns } from './patterns';

// Helper function to get the next letter in sequence
function getNextLetter(letter: string): string | null {
    if (letter === 'Z' || letter === 'z') {
        return null; // No next letter after Z
    }
    return String.fromCharCode(letter.charCodeAt(0) + 1);
}

// Helper function to convert letter to number (A=1, B=2, etc.)
function letterToNumber(letter: string): number {
    const upperLetter = letter.toUpperCase();
    return upperLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}

// Helper function to convert number to letter (1=A, 2=B, etc.)
function numberToLetter(num: number, isUpperCase: boolean): string {
    const letter = String.fromCharCode('A'.charCodeAt(0) + num - 1);
    return isUpperCase ? letter : letter.toLowerCase();
}

// Helper function to convert roman numeral to integer
function romanToInt(roman: string): number {
    const romanValues: { [key: string]: number } = {
        'i': 1, 'iv': 4, 'v': 5, 'ix': 9, 'x': 10,
        'xl': 40, 'l': 50, 'xc': 90, 'c': 100,
        'cd': 400, 'd': 500, 'cm': 900, 'm': 1000,
        'I': 1, 'IV': 4, 'V': 5, 'IX': 9, 'X': 10,
        'XL': 40, 'L': 50, 'XC': 90, 'C': 100,
        'CD': 400, 'D': 500, 'CM': 900, 'M': 1000
    };
    
    let value = 0;
    let i = 0;
    const normalizedRoman = roman.toLowerCase();
    
    while (i < normalizedRoman.length) {
        if (i + 1 < normalizedRoman.length && romanValues[normalizedRoman.substring(i, i + 2)]) {
            value += romanValues[normalizedRoman.substring(i, i + 2)];
            i += 2;
        } else {
            value += romanValues[normalizedRoman[i]] || 0;
            i++;
        }
    }
    
    return value;
}

// Helper function to convert integer to roman numeral
function intToRoman(num: number, isUpperCase: boolean): string {
    const intToRomanUpper: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    
    const intToRomanLower: [number, string][] = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    
    let result = '';
    const table = isUpperCase ? intToRomanUpper : intToRomanLower;
    
    for (const [value, sym] of table) {
        while (num >= value) {
            result += sym;
            num -= value;
        }
    }
    
    return result;
}

// Helper function to get the next roman numeral
function getNextRoman(roman: string): string {
    const value = romanToInt(roman);
    const isUpperCase = roman[0] === roman[0].toUpperCase();
    return intToRoman(value + 1, isUpperCase);
}

// Helper function to detect list type and get next marker
function getNextListMarker(currentLine: string, allLines?: string[], currentLineIndex?: number): { marker: string, indent: string, spaces?: string } | null {
    // Check for hash auto-numbering
    const hashMatch = ListPatterns.isHashList(currentLine);
    if (hashMatch) {
        return { marker: '#.', indent: hashMatch[1], spaces: hashMatch[3] };
    }
    
    // Check for letters or roman numerals
    const listMatch = currentLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
    if (listMatch) {
        const indent = listMatch[1];
        const marker = listMatch[2];
        const punctuation = listMatch[3];
        const spaces = listMatch[4];
        
        // Determine if this is alphabetic or roman by looking at context
        let isRoman = false;
        
        // Multi-character patterns that are valid roman numerals are always roman
        if (marker.length > 1 && marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
            isRoman = true;
        }
        // Single character - need to check context
        else if (marker.length === 1 && allLines && currentLineIndex !== undefined) {
            // Special case: 'I' or 'i' should default to roman unless preceded by 'H' or 'h'
            if (marker.match(ListPatterns.SINGLE_I)) {
                // Default to roman for 'I' or 'i'
                isRoman = true;
                
                // Check if preceded by 'H' or 'h' - if so, it's alphabetic
                for (let i = currentLineIndex - 1; i >= 0; i--) {
                    const prevLine = allLines[i];
                    
                    // Skip empty lines
                    if (!prevLine.trim()) continue;
                    
                    // If we find a non-list line, stop looking
                    if (!prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST)) break;
                    
                    const prevMatch = prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
                    if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
                        const prevMarker = prevMatch[2];
                        
                        // If preceded by 'H' or 'h', it's alphabetic
                        if (prevMarker.match(ListPatterns.SINGLE_H)) {
                            isRoman = false;
                            break;
                        }
                        // If previous marker is multi-char roman, keep as roman
                        else if (prevMarker.length > 1 && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = true;
                            break;
                        }
                        // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
                        else if (!prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = false;
                            break;
                        }
                    }
                }
            } else {
                // For other single characters, check context
                for (let i = currentLineIndex - 1; i >= 0; i--) {
                    const prevLine = allLines[i];
                    
                    // Skip empty lines
                    if (!prevLine.trim()) continue;
                    
                    // If we find a non-list line, stop looking
                    if (!prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST)) break;
                    
                    const prevMatch = prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
                    if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
                        const prevMarker = prevMatch[2];
                        
                        // If previous marker is multi-char roman, this is roman too
                        if (prevMarker.length > 1 && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = true;
                            break;
                        }
                        // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
                        else if (!prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = false;
                            break;
                        }
                        // If we found 'A' or 'B' before, it's alphabetic
                        else if (prevMarker.match(ListPatterns.SINGLE_AB)) {
                            isRoman = false;
                            break;
                        }
                    }
                }
            }
        }
        
        if (isRoman) {
            // Validate and continue as roman
            if (marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
                const nextRoman = getNextRoman(marker);
                return { marker: `${nextRoman}${punctuation}`, indent, spaces };
            }
        } else {
            // Continue as alphabetic
            const nextLetter = getNextLetter(marker);
            if (nextLetter) {
                return { marker: `${nextLetter}${punctuation}`, indent, spaces };
            }
            return null; // Can't continue past Z
        }
    }
    
    // Check for example lists
    // Try both with required spaces and with optional spaces for better compatibility
    let exampleMatch = currentLine.match(ListPatterns.EXAMPLE_LIST);
    if (exampleMatch) {
        const indent = exampleMatch[1];
        const spaces = exampleMatch[4]; // Group 4 is spaces in EXAMPLE_LIST pattern
        return { marker: '(@)', indent, spaces };
    }
    
    // Try optional space pattern if the first one didn't match
    const altMatch = currentLine.match(ListPatterns.EXAMPLE_LIST_OPTIONAL_SPACE);
    if (altMatch && currentLine.length > altMatch[0].length) {
        // There's content after the marker even without explicit spaces
        const indent = altMatch[1];
        const spaces = altMatch[3] || ' '; // Group 3 is spaces in EXAMPLE_LIST_OPTIONAL_SPACE pattern
        return { marker: '(@)', indent, spaces };
    }
    
    // Check for definition lists
    const definitionMatch = currentLine.match(ListPatterns.DEFINITION_MARKER);
    if (definitionMatch) {
        const indent = definitionMatch[1];
        const marker = definitionMatch[2];
        const spaces = definitionMatch[3];
        return { marker, indent, spaces };
    }
    
    return null;
}

// Function to renumber all list items after insertion
function renumberListItems(view: EditorView, insertedLineNum: number): void {
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
    const listItems: Array<{lineNum: number, marker: string, punctuation: string, spaces: string, content: string, isRoman: boolean, isAlpha: boolean}> = [];
    
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

// Helper function to check if a line is empty (only contains the list marker)
function isEmptyListItem(line: string): boolean {
    // Check hash lists
    if (line.match(ListPatterns.EMPTY_HASH_LIST)) return true;
    
    // Check fancy lists
    if (line.match(ListPatterns.EMPTY_FANCY_LIST)) return true;
    
    // Note: We do NOT check for empty example lists here
    // (@) is a valid list marker (unlabeled example) and should continue to next item
    // The only time (@) should be deleted is when cursor is between @ and )
    // which is handled by the special case in handleListEnter
    
    // Check definition lists
    if (line.match(ListPatterns.EMPTY_DEFINITION_LIST)) return true;
    
    return false;
}

// Factory function to create keybindings with settings
export function createListAutocompletionKeymap(settings: PandocExtendedMarkdownSettings): KeyBinding[] {
    
// Handle Enter key for list autocompletion
const handleListEnter: KeyBinding = {
    key: 'Enter',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Only handle when cursor is at the end of a line
        const line = state.doc.lineAt(selection.from);
        const lineText = line.text;
        
        // Special case: handle Enter when cursor is between @ and ) in an empty example list
        const isEmptyExampleList = lineText.match(ListPatterns.EMPTY_EXAMPLE_LIST_NO_LABEL);
        if (isEmptyExampleList) {
            // Check if cursor is between @ and )
            const beforeCursor = state.doc.sliceString(line.from, selection.from);
            const afterCursor = state.doc.sliceString(selection.from, line.to);
            // Only delete if cursor is truly between @ and ) with nothing else
            if (beforeCursor.endsWith('(@') && afterCursor.startsWith(')')) {
                // Cursor is between @ and ), treat as empty list item and remove the marker
                const indentMatch = lineText.match(ListPatterns.INDENT_ONLY);
                const indent = indentMatch ? indentMatch[1] : '';
                
                // Remove the marker entirely, leaving just the indentation
                const changes = {
                    from: line.from,
                    to: line.to,
                    insert: indent
                };
                
                const transaction = state.update({
                    changes,
                    selection: EditorSelection.cursor(line.from + indent.length)
                });
                
                view.dispatch(transaction);
                return true;
            }
        }
        
        // Check if we're dealing with a list item first
        const isListItem = lineText.match(ListPatterns.ANY_LIST_MARKER);
        
        // For list items, be more forgiving about cursor position
        // Allow handling if cursor is at end OR near end (within 2 chars) for fast typing
        if (!isListItem) {
            // Not a list item - require cursor at end of line
            if (selection.from !== line.to || selection.from !== selection.to) {
                return false; // Let default Enter handling take over
            }
        } else {
            // For list items, allow some flexibility for fast typing
            // Check if cursor is at end or very close to end (within 2 characters)
            const distanceFromEnd = line.to - selection.from;
            if (distanceFromEnd > 2 || selection.from !== selection.to) {
                // Too far from end or there's a selection
                return false;
            }
        }
        
        // Skip regular numbered lists - let Obsidian handle those
        if (lineText.match(ListPatterns.NUMBERED_LIST_WITH_SPACE)) {
            return false;
        }
        
        // Check if current line is an empty list item
        if (isEmptyListItem(lineText)) {
            // Handle nested list dedent or remove marker
            const indentMatch = lineText.match(ListPatterns.INDENT_ONLY);
            if (indentMatch && indentMatch[1].length >= INDENTATION.TAB_SIZE) {
                // Dedent by removing 4 spaces or 1 tab
                const currentIndent = indentMatch[1];
                let newIndent = '';
                if (currentIndent.startsWith(INDENTATION.FOUR_SPACES)) {
                    newIndent = currentIndent.substring(INDENTATION.TAB_SIZE);
                } else if (currentIndent.startsWith(INDENTATION.TAB)) {
                    newIndent = currentIndent.substring(1);
                } else {
                    // Remove up to 4 spaces
                    newIndent = currentIndent.substring(Math.min(INDENTATION.TAB_SIZE, currentIndent.length));
                }
                
                // Try to find the appropriate marker for this indent level
                // Look at previous lines to determine what marker to use
                let previousMarker = null;
                for (let i = line.number - 1; i >= 1; i--) {
                    const prevLine = state.doc.line(i);
                    const prevText = prevLine.text;
                    
                    // Check if this line has the same indent level we're looking for
                    const prevIndentMatch = prevText.match(ListPatterns.INDENT_ONLY);
                    if (prevIndentMatch && prevIndentMatch[1] === newIndent) {
                        const allLines = state.doc.toString().split('\n');
                        const markerInfo = getNextListMarker(prevText, allLines, i - 1);
                        if (markerInfo) {
                            previousMarker = markerInfo;
                            break;
                        }
                    }
                }
                
                if (previousMarker && newIndent.length > 0) {
                    // Replace with dedented marker
                    const spaces = previousMarker.spaces || ' ';
                    const newLine = `${newIndent}${previousMarker.marker}${spaces}`;
                    const changes = {
                        from: line.from,
                        to: line.to,
                        insert: newLine
                    };
                    
                    const transaction = state.update({
                        changes,
                        selection: EditorSelection.cursor(line.from + newLine.length)
                    });
                    
                    view.dispatch(transaction);
                    return true;
                }
            }
            
            // Remove the marker entirely
            const changes = {
                from: line.from,
                to: line.to,
                insert: ''
            };
            
            const transaction = state.update({
                changes,
                selection: EditorSelection.cursor(line.from)
            });
            
            view.dispatch(transaction);
            return true;
        }
        
        // Check if current line is a list item
        // Get all lines and current line index for context
        const allLines = state.doc.toString().split('\n');
        const currentLineIndex = line.number - 1; // Convert to 0-based index
        const markerInfo = getNextListMarker(lineText, allLines, currentLineIndex);
        if (markerInfo) {
            // Insert new line with next marker
            // Use the same amount of spaces as the current line
            const spaces = markerInfo.spaces || ' ';
            const newLine = `\n${markerInfo.indent}${markerInfo.marker}${spaces}`;
            
            // If cursor is not at the end of line (fast typing), insert at the end
            const insertPos = selection.from === line.to ? selection.from : line.to;
            const changes = {
                from: insertPos,
                to: insertPos,
                insert: newLine
            };
            
            // For example lists with (@), place cursor inside the parentheses
            const cursorOffset = markerInfo.marker === '(@)' 
                ? newLine.length - spaces.length - 1  // Place cursor between @ and )
                : newLine.length;                      // Place cursor after the spaces
            
            const transaction = state.update({
                changes,
                selection: EditorSelection.cursor(insertPos + cursorOffset)
            });
            
            view.dispatch(transaction);
            
            // If auto-renumbering is enabled and this is a fancy list, renumber the list
            if (settings.autoRenumberLists && markerInfo.marker !== '(@)' && markerInfo.marker !== '#.' && !markerInfo.marker.match(ListPatterns.DEFINITION_MARKER_ONLY)) {
                // Get the line number of the newly inserted item (it's the next line)
                const newLineNum = line.number; // This is 1-based, but we need 0-based for our function
                
                // Use setTimeout to ensure the insertion is complete before renumbering
                setTimeout(() => {
                    renumberListItems(view, newLineNum);
                }, 0);
            }
            
            return true;
        }
        
        return false; // Let default Enter handling take over
    }
};

// Handle Tab key for nested lists
const handleListTab: KeyBinding = {
    key: 'Tab',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Get the current line
        const line = state.doc.lineAt(selection.from);
        const lineText = line.text;
        
        // Check if we're at the start of a list item (after the marker)
        const listMatch = lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE);
        if (listMatch) {
            const currentIndent = listMatch[1];
            const marker = listMatch[2];
            const space = listMatch[3];
            const markerEnd = currentIndent.length + marker.length + space.length;
            
            // Only handle Tab if cursor is at the beginning of the content (right after marker)
            if (selection.from === line.from + markerEnd && selection.to === selection.from) {
                // Add indentation (4 spaces or 1 tab based on user preference)
                const newIndent = currentIndent + INDENTATION.FOUR_SPACES; // Using 4 spaces
                const newLine = newIndent + marker + space + lineText.substring(markerEnd);
                
                const changes = {
                    from: line.from,
                    to: line.to,
                    insert: newLine
                };
                
                const transaction = state.update({
                    changes,
                    selection: EditorSelection.cursor(line.from + newIndent.length + marker.length + space.length)
                });
                
                view.dispatch(transaction);
                return true;
            }
        }
        
        return false; // Let default Tab handling take over
    }
};

// Handle Shift+Tab for dedenting
const handleListShiftTab: KeyBinding = {
    key: 'Shift-Tab',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Get the current line
        const line = state.doc.lineAt(selection.from);
        const lineText = line.text;
        
        // Check if we're in a list item with indentation
        const listMatch = lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_INDENT_AND_SPACE);
        if (listMatch && listMatch[1].length > 0) {
            const currentIndent = listMatch[1];
            const marker = listMatch[2];
            const space = listMatch[3];
            const markerEnd = currentIndent.length + marker.length + space.length;
            
            // Remove indentation (4 spaces or 1 tab)
            let newIndent = '';
            if (currentIndent.startsWith('    ')) {
                newIndent = currentIndent.substring(INDENTATION.TAB_SIZE);
            } else if (currentIndent.startsWith('\t')) {
                newIndent = currentIndent.substring(1);
            } else {
                // Remove up to 4 spaces
                newIndent = currentIndent.substring(Math.min(4, currentIndent.length));
            }
            
            const newLine = newIndent + marker + space + lineText.substring(markerEnd);
            
            const changes = {
                from: line.from,
                to: line.to,
                insert: newLine
            };
            
            // Calculate new cursor position
            const oldCursorOffset = selection.from - line.from;
            const indentDiff = currentIndent.length - newIndent.length;
            const newCursorOffset = Math.max(newIndent.length + marker.length + space.length, oldCursorOffset - indentDiff);
            
            const transaction = state.update({
                changes,
                selection: EditorSelection.cursor(line.from + newCursorOffset)
            });
            
            view.dispatch(transaction);
            return true;
        }
        
        return false; // Let default Shift+Tab handling take over
    }
};

// Return all keybindings as an array
return [
    handleListEnter,
    handleListTab,
    handleListShiftTab
];
}