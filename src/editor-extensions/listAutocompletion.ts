import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

import { INDENTATION } from '../core/constants';

import { ListPatterns } from '../shared/patterns';
import { ListMarkerInfo } from '../shared/types/listTypes';

import { isEmptyListItem } from '../shared/utils/listHelpers';
import { getNextListMarker } from '../shared/utils/listMarkerDetector';
import { renumberListItems } from '../shared/utils/listRenumbering';

import { PandocExtendedMarkdownSettings } from '../core/settings';

/**
 * Information about the current line and cursor position.
 */
interface CurrentLineInfo {
    line: any;
    lineText: string;
    selection: any;
    isAtEndOfLine: boolean;
    distanceFromEnd: number;
}

/**
 * Result of list marker detection and validation.
 */
interface ListMarkerDetectionResult {
    isListItem: boolean;
    shouldHandleEnter: boolean;
    isEmptyExampleListSpecial: boolean;
    isEmptyCustomLabelSpecial: boolean;
}

/**
 * Configuration for handling empty list items.
 */
interface EmptyListHandlingConfig {
    view: EditorView;
    currentLine: CurrentLineInfo;
    beforeCursor: string;
    afterCursor: string;
}

/**
 * Configuration for inserting new list items.
 */
interface NewListItemConfig {
    view: EditorView;
    currentLine: CurrentLineInfo;
    markerInfo: ListMarkerInfo;
    settings: PandocExtendedMarkdownSettings;
}

/**
 * Gets current line information and cursor position details.
 * 
 * @param view - The CodeMirror editor view
 * @returns Object containing line and cursor information
 */
function getCurrentLineInfo(view: EditorView): CurrentLineInfo {
    const state = view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    const lineText = line.text;
    const isAtEndOfLine = selection.from === line.to;
    const distanceFromEnd = line.to - selection.from;
    
    return {
        line,
        lineText,
        selection,
        isAtEndOfLine,
        distanceFromEnd
    };
}

/**
 * Detects the type of list marker and determines if Enter should be handled.
 * 
 * @param currentLine - Current line information
 * @param view - The editor view for accessing document state
 * @returns Detection result with handling flags
 */
function detectListMarker(currentLine: CurrentLineInfo, view: EditorView): ListMarkerDetectionResult {
    const { lineText, selection, line, distanceFromEnd } = currentLine;
    const state = view.state;
    
    // Check for empty example list special case
    const isEmptyExampleList = lineText.match(ListPatterns.EMPTY_EXAMPLE_LIST_NO_LABEL);
    if (isEmptyExampleList) {
        const beforeCursor = state.doc.sliceString(line.from, selection.from);
        const afterCursor = state.doc.sliceString(selection.from, line.to);
        if (beforeCursor.endsWith('(@') && afterCursor.startsWith(')')) {
            return {
                isListItem: true,
                shouldHandleEnter: true,
                isEmptyExampleListSpecial: true,
                isEmptyCustomLabelSpecial: false
            };
        }
    }
    
    // Check for empty custom label list special case
    const isEmptyCustomLabelList = lineText.match(ListPatterns.EMPTY_CUSTOM_LABEL_LIST_NO_LABEL);
    if (isEmptyCustomLabelList) {
        const beforeCursor = state.doc.sliceString(line.from, selection.from);
        const afterCursor = state.doc.sliceString(selection.from, line.to);
        if (beforeCursor.endsWith('{::') && afterCursor.startsWith('}')) {
            return {
                isListItem: true,
                shouldHandleEnter: true,
                isEmptyExampleListSpecial: false,
                isEmptyCustomLabelSpecial: true
            };
        }
    }
    
    // Check if we're dealing with a list item
    const isListItem = lineText.match(ListPatterns.ANY_LIST_MARKER);
    
    if (!isListItem) {
        // Not a list item - require cursor at end of line
        const shouldHandle = selection.from === line.to && selection.from === selection.to;
        return {
            isListItem: false,
            shouldHandleEnter: shouldHandle,
            isEmptyExampleListSpecial: false,
            isEmptyCustomLabelSpecial: false
        };
    }
    
    // For list items, allow some flexibility for fast typing
    const shouldHandle = distanceFromEnd <= 2 && selection.from === selection.to;
    
    return {
        isListItem: true,
        shouldHandleEnter: shouldHandle,
        isEmptyExampleListSpecial: false,
        isEmptyCustomLabelSpecial: false
    };
}

/**
 * Handles special cases for empty example and custom label lists.
 * 
 * @param config - Configuration for empty list handling
 * @returns True if the empty list case was handled
 */
function handleEmptyListSpecialCases(config: EmptyListHandlingConfig): boolean {
    const { view, currentLine, beforeCursor, afterCursor } = config;
    const { line, lineText } = currentLine;
    const state = view.state;
    
    // Handle empty example list between @ and )
    if (beforeCursor.endsWith('(@') && afterCursor.startsWith(')')) {
        const indentMatch = lineText.match(ListPatterns.INDENT_ONLY);
        const indent = indentMatch ? indentMatch[1] : '';
        
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
    
    // Handle empty custom label list between {:: and }
    if (beforeCursor.endsWith('{::') && afterCursor.startsWith('}')) {
        const indentMatch = lineText.match(ListPatterns.INDENT_ONLY);
        const indent = indentMatch ? indentMatch[1] : '';
        
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
    
    return false;
}

/**
 * Calculates proper indentation for dedented list items.
 * 
 * @param currentIndent - Current indentation string
 * @returns New indentation string after dedenting
 */
function calculateIndentation(currentIndent: string): string {
    let newIndent = '';
    
    if (currentIndent.startsWith(INDENTATION.FOUR_SPACES)) {
        newIndent = currentIndent.substring(INDENTATION.TAB_SIZE);
    } else if (currentIndent.startsWith(INDENTATION.TAB)) {
        newIndent = currentIndent.substring(1);
    } else {
        // Remove up to 4 spaces
        newIndent = currentIndent.substring(Math.min(INDENTATION.TAB_SIZE, currentIndent.length));
    }
    
    return newIndent;
}

/**
 * Handles empty list items by either dedenting or removing the marker.
 * 
 * @param config - Configuration for empty list handling
 * @returns True if the empty list item was handled
 */
function handleEmptyListItem(config: EmptyListHandlingConfig): boolean {
    const { view, currentLine } = config;
    const { line, lineText } = currentLine;
    const state = view.state;
    
    if (!isEmptyListItem(lineText)) {
        return false;
    }
    
    // Handle nested list dedent or remove marker
    const indentMatch = lineText.match(ListPatterns.INDENT_ONLY);
    if (indentMatch && indentMatch[1].length >= INDENTATION.TAB_SIZE) {
        const currentIndent = indentMatch[1];
        const newIndent = calculateIndentation(currentIndent);
        
        // Try to find the appropriate marker for this indent level
        let previousMarker: ListMarkerInfo | null = null;
        for (let i = line.number - 1; i >= 1; i--) {
            const prevLine = state.doc.line(i);
            const prevText = prevLine.text;
            
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

/**
 * Inserts a new list item with the appropriate marker.
 * 
 * @param config - Configuration for new list item insertion
 * @returns True if a new list item was inserted
 */
function insertNewListItem(config: NewListItemConfig): boolean {
    const { view, currentLine, markerInfo, settings } = config;
    const { line, selection } = currentLine;
    const state = view.state;
    
    // Insert new line with next marker
    const spaces = markerInfo.spaces || ' ';
    const newLine = `\n${markerInfo.indent}${markerInfo.marker}${spaces}`;
    
    // If cursor is not at the end of line (fast typing), insert at the end
    const insertPos = selection.from === line.to ? selection.from : line.to;
    const changes = {
        from: insertPos,
        to: insertPos,
        insert: newLine
    };
    
    // Calculate cursor position based on marker type
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
    
    // Handle auto-renumbering if enabled
    if (settings.autoRenumberLists && 
        markerInfo.marker !== '(@)' && 
        markerInfo.marker !== '{::}' && 
        markerInfo.marker !== '#.' && 
        !markerInfo.marker.match(ListPatterns.DEFINITION_MARKER_ONLY)) {
        
        const newLineNum = line.number; // This is 1-based, but we need 0-based for our function
        
        // Use setTimeout to ensure the insertion is complete before renumbering
        setTimeout(() => {
            renumberListItems(view, newLineNum);
        }, 0);
    }
    
    return true;
}

/**
 * Handles non-empty list items by creating a new list item.
 * 
 * @param config - Configuration for new list item insertion
 * @returns True if handled successfully
 */
function handleNonEmptyListItem(config: NewListItemConfig): boolean {
    const { currentLine } = config;
    const { lineText } = currentLine;
    
    // Skip regular numbered lists - let Obsidian handle those
    if (lineText.match(ListPatterns.NUMBERED_LIST_WITH_SPACE)) {
        return false;
    }
    
    // Get all lines and current line index for context
    const state = config.view.state;
    const allLines = state.doc.toString().split('\n');
    const currentLineIndex = currentLine.line.number - 1; // Convert to 0-based index
    const markerInfo = getNextListMarker(lineText, allLines, currentLineIndex);
    
    if (markerInfo) {
        const newConfig = { ...config, markerInfo };
        return insertNewListItem(newConfig);
    }
    
    return false;
}

// Factory function to create keybindings with settings
export function createListAutocompletionKeymap(settings: PandocExtendedMarkdownSettings): KeyBinding[] {
    
// Handle Enter key for list autocompletion
const handleListEnter: KeyBinding = {
    key: 'Enter',
    run: (view: EditorView): boolean => {
        const state = view.state;
        
        // Get current line information
        const currentLine = getCurrentLineInfo(view);
        
        // Detect list marker type and determine if we should handle Enter
        const detection = detectListMarker(currentLine, view);
        
        if (!detection.shouldHandleEnter) {
            return false; // Let default Enter handling take over
        }
        
        // Handle special cases for empty lists with cursor in specific positions
        if (detection.isEmptyExampleListSpecial || detection.isEmptyCustomLabelSpecial) {
            const beforeCursor = state.doc.sliceString(currentLine.line.from, currentLine.selection.from);
            const afterCursor = state.doc.sliceString(currentLine.selection.from, currentLine.line.to);
            
            const specialConfig: EmptyListHandlingConfig = {
                view,
                currentLine,
                beforeCursor,
                afterCursor
            };
            
            return handleEmptyListSpecialCases(specialConfig);
        }
        
        // Skip regular numbered lists - let Obsidian handle those
        if (currentLine.lineText.match(ListPatterns.NUMBERED_LIST_WITH_SPACE)) {
            return false;
        }
        
        // Handle empty list items (dedent or remove)
        const emptyListConfig: EmptyListHandlingConfig = {
            view,
            currentLine,
            beforeCursor: '',
            afterCursor: ''
        };
        
        if (handleEmptyListItem(emptyListConfig)) {
            return true;
        }
        
        // Handle non-empty list items (create new list item)
        const nonEmptyConfig: Omit<NewListItemConfig, 'markerInfo'> = {
            view,
            currentLine,
            settings
        };
        
        return handleNonEmptyListItem(nonEmptyConfig as NewListItemConfig);
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