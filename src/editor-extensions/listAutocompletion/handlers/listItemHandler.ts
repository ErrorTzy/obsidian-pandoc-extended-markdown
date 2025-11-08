import { EditorSelection } from '@codemirror/state';
import { ListPatterns } from '../../../shared/patterns';
import { getNextListMarker } from '../../../shared/utils/listMarkerDetector';
import { renumberListItems } from '../../../shared/utils/listRenumbering';
import { NewListItemConfig } from '../types';

/**
 * Inserts a new list item with the appropriate marker.
 *
 * @param config - Configuration for new list item insertion
 * @returns True if a new list item was inserted
 */
export function insertNewListItem(config: NewListItemConfig): boolean {
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
        window.setTimeout(() => {
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
export function handleNonEmptyListItem(config: Omit<NewListItemConfig, 'markerInfo'>): boolean {
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
        const newConfig = { ...config, markerInfo } as NewListItemConfig;
        return insertNewListItem(newConfig);
    }

    return false;
}
