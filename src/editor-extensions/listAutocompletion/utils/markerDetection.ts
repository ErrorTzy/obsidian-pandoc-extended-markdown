import { EditorView } from '@codemirror/view';
import { ListPatterns } from '../../../shared/patterns';
import { CurrentLineInfo, ListMarkerDetectionResult } from '../types';

/**
 * Detects the type of list marker and determines if Enter should be handled.
 *
 * @param currentLine - Current line information
 * @param view - The editor view for accessing document state
 * @returns Detection result with handling flags
 */
export function detectListMarker(currentLine: CurrentLineInfo, view: EditorView): ListMarkerDetectionResult {
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
 * Checks if a line is an extended list type.
 *
 * @param lineText - The text of the line to check
 * @returns True if the line is an extended list type
 */
export function isExtendedList(lineText: string): boolean {
    return !!(
        ListPatterns.isFancyList(lineText) ||
        ListPatterns.isExampleList(lineText) ||
        ListPatterns.isCustomLabelList(lineText) ||
        ListPatterns.isHashList(lineText)
    );
}