import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from './settings';
import { INDENTATION } from './constants';
import { ListPatterns } from './patterns';
import { isEmptyListItem } from './utils/listHelpers';
import { getNextListMarker } from './utils/listMarkerDetector';
import { renumberListItems } from './utils/listRenumbering';

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
        
        // Special case: handle Enter when cursor is between {:: and } in an empty custom label list
        const isEmptyCustomLabelList = lineText.match(ListPatterns.EMPTY_CUSTOM_LABEL_LIST_NO_LABEL);
        if (isEmptyCustomLabelList) {
            // Check if cursor is between {:: and }
            const beforeCursor = state.doc.sliceString(line.from, selection.from);
            const afterCursor = state.doc.sliceString(selection.from, line.to);
            // Only delete if cursor is truly between {:: and } with nothing else
            if (beforeCursor.endsWith('{::') && afterCursor.startsWith('}')) {
                // Cursor is between {:: and }, treat as empty list item and remove the marker
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
            // For custom label lists with {::}, place cursor between :: and }
            const cursorOffset = markerInfo.marker === '(@)' 
                ? newLine.length - spaces.length - 1  // Place cursor between @ and )
                : markerInfo.marker === '{::}'
                ? newLine.length - spaces.length - 1  // Place cursor between :: and }
                : newLine.length;                      // Place cursor after the spaces
            
            const transaction = state.update({
                changes,
                selection: EditorSelection.cursor(insertPos + cursorOffset)
            });
            
            view.dispatch(transaction);
            
            // If auto-renumbering is enabled and this is a fancy list, renumber the list
            if (settings.autoRenumberLists && markerInfo.marker !== '(@)' && markerInfo.marker !== '{::}' && markerInfo.marker !== '#.' && !markerInfo.marker.match(ListPatterns.DEFINITION_MARKER_ONLY)) {
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