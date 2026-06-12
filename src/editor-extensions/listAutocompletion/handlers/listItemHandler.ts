import { EditorSelection } from '@codemirror/state';
import { getNextListMarker } from '../../../shared/utils/listMarkerDetector';
import { parseStandardListItem } from '../../../shared/utils/listContext';
import {
    formatOrderedListMarker,
    isOrderedMarkerStyleAvailable,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import {
    isEnabledStandardListLine,
    showListAutocompletionError
} from '../utils/debugNotice';
import { renumberOrderedGroup } from '../utils/orderedSiblingRenumbering';
import { resolveListOwnerAtLine } from '../utils/standardListStructure';
import { NewListItemConfig } from '../types';

/**
 * Inserts a new list item with the appropriate marker.
 *
 * @param config - Configuration for new list item insertion
 * @returns True if a new list item was inserted
 */
export function insertNewListItem(config: NewListItemConfig): boolean {
    const { view, currentLine, markerInfo } = config;
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

    return true;
}

/**
 * Handles non-empty list items by creating a new list item.
 *
 * @param config - Configuration for new list item insertion
 * @returns True if handled successfully
 */
export function handleNonEmptyListItem(config: Omit<NewListItemConfig, 'markerInfo'>): boolean {
    const { currentLine, settings } = config;
    const { lineText } = currentLine;

    // Get all lines and current line index for context
    const state = config.view.state;
    const allLines = state.doc.toString().split('\n');
    const currentLineIndex = currentLine.line.number - 1; // Convert to 0-based index
    if (isEnabledStandardListLine(lineText, allLines, currentLineIndex, settings)) {
        if (insertNewStandardListItem(config, allLines, currentLineIndex)) {
            return true;
        }

        return showListAutocompletionError(
            'The standard list item could not be continued with the standard resolver.',
            currentLine.line.number
        );
    }

    const markerInfo = getNextListMarker(lineText, allLines, currentLineIndex, settings);

    if (markerInfo) {
        const newConfig = { ...config, markerInfo } as NewListItemConfig;
        return insertNewListItem(newConfig);
    }

    return false;
}

function insertNewStandardListItem(
    config: Omit<NewListItemConfig, 'markerInfo'>,
    allLines: string[],
    currentLineIndex: number
): boolean {
    const { view, currentLine, settings } = config;
    const markerInfo = getNextStandardListMarker(currentLine.lineText, allLines, currentLineIndex, settings);
    if (!markerInfo) {
        return false;
    }

    const ownerContext = resolveListOwnerAtLine(allLines, currentLineIndex, settings);
    if (!ownerContext || ownerContext.owner.lineIndex !== currentLineIndex) {
        return false;
    }

    const state = view.state;
    const { line, selection } = currentLine;
    const insertPos = selection.from === line.to ? selection.from : line.to;
    const spaces = markerInfo.spaces || ' ';
    const insertedLine = `${markerInfo.indent}${markerInfo.marker}${spaces}`;
    const nextDoc = `${state.doc.sliceString(0, insertPos)}\n${insertedLine}${state.doc.sliceString(insertPos)}`;
    const nextLines = nextDoc.split('\n');
    const insertedLineIndex = currentLineIndex + 1;

    if (settings.autoRenumberLists && ownerContext.owner.markerType.kind === 'ordered') {
        renumberOrderedGroup(nextLines, insertedLineIndex, {
            depth: ownerContext.owner.depth,
            parentLineIndex: ownerContext.owner.parentLineIndex,
            markerType: ownerContext.owner.markerType
        }, settings);
    }

    view.dispatch(state.update({
        changes: {
            from: 0,
            to: state.doc.length,
            insert: nextLines.join('\n')
        },
        selection: EditorSelection.cursor(
            getLineStartOffset(nextLines, insertedLineIndex) + insertedLine.length
        )
    }));

    return true;
}

function getNextStandardListMarker(
    lineText: string,
    allLines: string[],
    currentLineIndex: number,
    settings: NewListItemConfig['settings']
): NewListItemConfig['markerInfo'] | null {
    const standardItem = parseStandardListItem(lineText);
    if (!standardItem) {
        return null;
    }

    if (standardItem.kind === 'unordered') {
        return {
            marker: standardItem.marker,
            indent: standardItem.indent,
            spaces: standardItem.spaces || ' '
        };
    }

    const ordered = parseOrderedListMarker(lineText, allLines, currentLineIndex);
    if (!ordered) {
        return null;
    }

    if (!isOrderedMarkerStyleAvailable(ordered.style, settings)) {
        return null;
    }

    const ordinal = settings.autoRenumberLists
        ? ordered.ordinal + 1
        : ordered.ordinal;

    return {
        marker: formatOrderedListMarker(ordered.style, ordinal),
        indent: ordered.indent,
        spaces: ordered.spaces || ' '
    };
}

function getLineStartOffset(lines: string[], lineIndex: number): number {
    let offset = 0;
    for (let index = 0; index < lineIndex; index++) {
        offset += lines[index].length + 1;
    }

    return offset;
}
