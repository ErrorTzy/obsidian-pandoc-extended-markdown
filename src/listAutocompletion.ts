import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection, Transaction } from '@codemirror/state';

// Helper function to get the next letter in sequence
function getNextLetter(letter: string): string | null {
    if (letter === 'Z' || letter === 'z') {
        return null; // No next letter after Z
    }
    return String.fromCharCode(letter.charCodeAt(0) + 1);
}

// Helper function to get the next roman numeral
function getNextRoman(roman: string): string {
    const romanToInt: { [key: string]: number } = {
        'i': 1, 'iv': 4, 'v': 5, 'ix': 9, 'x': 10,
        'xl': 40, 'l': 50, 'xc': 90, 'c': 100,
        'cd': 400, 'd': 500, 'cm': 900, 'm': 1000,
        'I': 1, 'IV': 4, 'V': 5, 'IX': 9, 'X': 10,
        'XL': 40, 'L': 50, 'XC': 90, 'C': 100,
        'CD': 400, 'D': 500, 'CM': 900, 'M': 1000
    };
    
    const intToRoman: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    
    const intToRomanLower: [number, string][] = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    
    // Convert roman to integer
    let value = 0;
    let i = 0;
    const normalizedRoman = roman.toLowerCase();
    
    while (i < normalizedRoman.length) {
        if (i + 1 < normalizedRoman.length && romanToInt[normalizedRoman.substring(i, i + 2)]) {
            value += romanToInt[normalizedRoman.substring(i, i + 2)];
            i += 2;
        } else {
            value += romanToInt[normalizedRoman[i]];
            i++;
        }
    }
    
    // Increment the value
    value++;
    
    // Convert back to roman
    let result = '';
    const table = roman[0] === roman[0].toUpperCase() ? intToRoman : intToRomanLower;
    
    for (const [num, sym] of table) {
        while (value >= num) {
            result += sym;
            value -= num;
        }
    }
    
    return result;
}

// Helper function to detect list type and get next marker
function getNextListMarker(currentLine: string, allLines?: string[], currentLineIndex?: number): { marker: string, indent: string, spaces?: string } | null {
    // Check for hash auto-numbering
    const hashMatch = currentLine.match(/^(\s*)(#\.)(\s+)/);
    if (hashMatch) {
        return { marker: '#.', indent: hashMatch[1], spaces: hashMatch[3] };
    }
    
    // Check for letters or roman numerals
    const listMatch = currentLine.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/);
    if (listMatch) {
        const indent = listMatch[1];
        const marker = listMatch[2];
        const punctuation = listMatch[3];
        const spaces = listMatch[4];
        
        // Determine if this is alphabetic or roman by looking at context
        let isRoman = false;
        
        // Multi-character patterns that are valid roman numerals are always roman
        if (marker.length > 1 && marker.match(/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i)) {
            isRoman = true;
        }
        // Single character - need to check context
        else if (marker.length === 1 && allLines && currentLineIndex !== undefined) {
            // Special case: 'I' or 'i' should default to roman unless preceded by 'H' or 'h'
            if (marker.match(/^[Ii]$/)) {
                // Default to roman for 'I' or 'i'
                isRoman = true;
                
                // Check if preceded by 'H' or 'h' - if so, it's alphabetic
                for (let i = currentLineIndex - 1; i >= 0; i--) {
                    const prevLine = allLines[i];
                    
                    // Skip empty lines
                    if (!prevLine.trim()) continue;
                    
                    // If we find a non-list line, stop looking
                    if (!prevLine.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/)) break;
                    
                    const prevMatch = prevLine.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/);
                    if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
                        const prevMarker = prevMatch[2];
                        
                        // If preceded by 'H' or 'h', it's alphabetic
                        if (prevMarker.match(/^[Hh]$/)) {
                            isRoman = false;
                            break;
                        }
                        // If previous marker is multi-char roman, keep as roman
                        else if (prevMarker.length > 1 && prevMarker.match(/^[ivxlcdmIVXLCDM]+$/i)) {
                            isRoman = true;
                            break;
                        }
                        // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
                        else if (!prevMarker.match(/^[ivxlcdmIVXLCDM]+$/i)) {
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
                    if (!prevLine.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/)) break;
                    
                    const prevMatch = prevLine.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/);
                    if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
                        const prevMarker = prevMatch[2];
                        
                        // If previous marker is multi-char roman, this is roman too
                        if (prevMarker.length > 1 && prevMarker.match(/^[ivxlcdmIVXLCDM]+$/i)) {
                            isRoman = true;
                            break;
                        }
                        // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
                        else if (!prevMarker.match(/^[ivxlcdmIVXLCDM]+$/i)) {
                            isRoman = false;
                            break;
                        }
                        // If we found 'A' or 'B' before, it's alphabetic
                        else if (prevMarker.match(/^[ABab]$/)) {
                            isRoman = false;
                            break;
                        }
                    }
                }
            }
        }
        
        if (isRoman) {
            // Validate and continue as roman
            if (marker.match(/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i)) {
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
    const exampleMatch = currentLine.match(/^(\s*)\(@([a-zA-Z0-9_-]*)\)(\s+)/);
    if (exampleMatch) {
        const indent = exampleMatch[1];
        const spaces = exampleMatch[3];
        return { marker: '(@)', indent, spaces };
    }
    
    // Check for definition lists
    const definitionMatch = currentLine.match(/^([~:])(\s+)/);
    if (definitionMatch) {
        const marker = definitionMatch[1];
        const spaces = definitionMatch[2];
        return { marker, indent: '', spaces };
    }
    
    return null;
}

// Helper function to check if a line is empty (only contains the list marker)
function isEmptyListItem(line: string): boolean {
    // Check hash lists
    if (line.match(/^(\s*)(#\.)(\s*)$/)) return true;
    
    // Check fancy lists
    if (line.match(/^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s*)$/)) return true;
    
    // Check example lists
    if (line.match(/^(\s*)\(@([a-zA-Z0-9_-]*)\)(\s*)$/)) return true;
    
    // Check definition lists
    if (line.match(/^([~:])(\s*)$/)) return true;
    
    return false;
}

// Handle Enter key for list autocompletion
export const handleListEnter: KeyBinding = {
    key: 'Enter',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Only handle when cursor is at the end of a line
        const line = state.doc.lineAt(selection.from);
        
        if (selection.from !== line.to || selection.from !== selection.to) {
            return false; // Let default Enter handling take over
        }
        
        const lineText = line.text;
        
        // Skip regular numbered lists - let Obsidian handle those
        if (lineText.match(/^\s*\d+[.)]\s/)) {
            return false;
        }
        
        // Check if current line is an empty list item
        if (isEmptyListItem(lineText)) {
            // Handle nested list dedent or remove marker
            const indentMatch = lineText.match(/^(\s+)/);
            if (indentMatch && indentMatch[1].length >= 4) {
                // Dedent by removing 4 spaces or 1 tab
                const currentIndent = indentMatch[1];
                let newIndent = '';
                if (currentIndent.startsWith('    ')) {
                    newIndent = currentIndent.substring(4);
                } else if (currentIndent.startsWith('\t')) {
                    newIndent = currentIndent.substring(1);
                } else {
                    // Remove up to 4 spaces
                    newIndent = currentIndent.substring(Math.min(4, currentIndent.length));
                }
                
                // Try to find the appropriate marker for this indent level
                // Look at previous lines to determine what marker to use
                let previousMarker = null;
                for (let i = line.number - 1; i >= 1; i--) {
                    const prevLine = state.doc.line(i);
                    const prevText = prevLine.text;
                    
                    // Check if this line has the same indent level we're looking for
                    const prevIndentMatch = prevText.match(/^(\s*)/);
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
            const changes = {
                from: selection.from,
                to: selection.to,
                insert: newLine
            };
            
            // For example lists with (@), place cursor inside the parentheses
            const cursorOffset = markerInfo.marker === '(@)' 
                ? newLine.length - spaces.length - 1  // Place cursor between @ and )
                : newLine.length;                      // Place cursor after the spaces
            
            const transaction = state.update({
                changes,
                selection: EditorSelection.cursor(selection.from + cursorOffset)
            });
            
            view.dispatch(transaction);
            return true;
        }
        
        return false; // Let default Enter handling take over
    }
};

// Handle Tab key for nested lists
export const handleListTab: KeyBinding = {
    key: 'Tab',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Get the current line
        const line = state.doc.lineAt(selection.from);
        const lineText = line.text;
        
        // Check if we're at the start of a list item (after the marker)
        const listMatch = lineText.match(/^(\s*)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|@\([a-zA-Z0-9_-]*\)|[~:])(\s+)/);
        if (listMatch) {
            const currentIndent = listMatch[1];
            const marker = listMatch[2];
            const space = listMatch[3];
            const markerEnd = currentIndent.length + marker.length + space.length;
            
            // Only handle Tab if cursor is at the beginning of the content (right after marker)
            if (selection.from === line.from + markerEnd && selection.to === selection.from) {
                // Add indentation (4 spaces or 1 tab based on user preference)
                const newIndent = currentIndent + '    '; // Using 4 spaces
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
export const handleListShiftTab: KeyBinding = {
    key: 'Shift-Tab',
    run: (view: EditorView): boolean => {
        const state = view.state;
        const selection = state.selection.main;
        
        // Get the current line
        const line = state.doc.lineAt(selection.from);
        const lineText = line.text;
        
        // Check if we're in a list item with indentation
        const listMatch = lineText.match(/^(\s+)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|@\([a-zA-Z0-9_-]*\)|[~:])(\s+)/);
        if (listMatch && listMatch[1].length > 0) {
            const currentIndent = listMatch[1];
            const marker = listMatch[2];
            const space = listMatch[3];
            const markerEnd = currentIndent.length + marker.length + space.length;
            
            // Remove indentation (4 spaces or 1 tab)
            let newIndent = '';
            if (currentIndent.startsWith('    ')) {
                newIndent = currentIndent.substring(4);
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

// Export all keybindings as an array
export const listAutocompletionKeymap: KeyBinding[] = [
    handleListEnter,
    handleListTab,
    handleListShiftTab
];