// External libraries
import { EditorSelection } from '@codemirror/state';

// Types
import { EmptyListHandlingConfig } from '../types';
import { ListMarkerInfo } from '../../../shared/types/listTypes';

// Constants
import { INDENTATION } from '../../../core/constants';

// Patterns
import { ListPatterns } from '../../../shared/patterns';

// Utils
import { isEmptyListItem } from '../../../shared/utils/listHelpers';
import { getNextListMarker } from '../../../shared/utils/listMarkerDetector';
import { calculateIndentation } from '../utils/indentation';

/**
 * Handles special cases for empty example and custom label lists.
 *
 * @param config - Configuration for empty list handling
 * @returns True if the empty list case was handled
 */
export function handleEmptyListSpecialCases(config: EmptyListHandlingConfig): boolean {
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
 * Handles empty list items by either dedenting or removing the marker.
 *
 * @param config - Configuration for empty list handling
 * @returns True if the empty list item was handled
 */
export function handleEmptyListItem(config: EmptyListHandlingConfig): boolean {
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