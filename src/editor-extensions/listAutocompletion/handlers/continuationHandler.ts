import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ListPatterns } from '../../../shared/patterns';
import { getNextListMarker } from '../../../shared/utils/listMarkerDetector';
import { renumberListItems } from '../../../shared/utils/listRenumbering';
import { ContinuationLineConfig } from '../types';
import { findLastListItem } from '../utils/continuationUtils';

/**
 * Handles Enter key in continuation lines (indented lines within a list).
 *
 * @param config - Configuration for continuation line handling
 * @returns True if handled, false otherwise
 */
export function handleContinuationLine(config: ContinuationLineConfig): boolean {
    const { view, currentLine, settings } = config;
    const state = view.state;
    const { lineText } = currentLine;

    // Check if we're in a continuation line (indented line within a list)
    const indentMatch = lineText.match(/^(\s+)/);
    const isIndented = indentMatch && (indentMatch[1].length >= 2 || indentMatch[1].includes('\t'));

    if (!isIndented || lineText.match(ListPatterns.ANY_LIST_MARKER)) {
        return false; // Not a continuation line or already has a marker
    }

    // Find the last list item in the current block
    const lastListItem = findLastListItem(state, currentLine.line.number);

    if (!lastListItem) {
        return false; // No list item found
    }

    // We found the last list item before the continuation - create the next list item
    const allLines = state.doc.toString().split('\n');
    const markerInfo = getNextListMarker(lastListItem.text, allLines, lastListItem.line.number - 1);

    if (!markerInfo) {
        return false;
    }

    // Insert new line with next marker at the original indentation
    const spaces = markerInfo.spaces || ' ';
    const newLine = `\n${markerInfo.indent}${markerInfo.marker}${spaces}`;

    // Insert at the end of current line
    const insertPos = currentLine.line.to;
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

        const newLineNum = currentLine.line.number;

        // Use setTimeout to ensure the insertion is complete before renumbering
        setTimeout(() => {
            renumberListItems(view, newLineNum);
        }, 0);
    }

    return true;
}