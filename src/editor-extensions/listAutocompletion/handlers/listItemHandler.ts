import { EditorSelection } from '@codemirror/state';
import { LIST_MARKERS } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import {
    formatOrderedListMarker,
    isOrderedMarkerStyleAvailable,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import {
    isCustomLabelListsEnabled,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';
import {
    isEnabledStandardListLine,
    showListAutocompletionError
} from '../utils/debugNotice';
import { renumberOrderedGroup } from '../utils/orderedSiblingRenumbering';
import {
    buildInsertedLineChanges,
    getLineStartOffset
} from '../utils/documentChanges';
import {
    formatNonOrderedMarker,
    getInsertedMarkerCursorOffset,
    parseStructuralListItem,
    resolveListOwnerAtLine,
    StandardListMarkerType
} from '../utils/standardListStructure';
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
            'The structural list item could not be continued with the structural resolver.',
            currentLine.line.number
        );
    }

    const markerInfo = getNextNonStandardListMarker(lineText, settings);

    if (markerInfo) {
        const newConfig = { ...config, markerInfo } as NewListItemConfig;
        return insertNewListItem(newConfig);
    }

    return false;
}

function getNextNonStandardListMarker(
    lineText: string,
    settings: NewListItemConfig['settings']
): NewListItemConfig['markerInfo'] | null {
    const hashMatch = isSyntaxFeatureEnabled(settings, 'enableHashAutoNumber')
        ? ListPatterns.isHashList(lineText)
        : null;
    if (hashMatch) {
        return {
            marker: LIST_MARKERS.HASH_NUMBERED,
            indent: hashMatch[1],
            spaces: hashMatch[3]
        };
    }

    const customLabelMatch = isCustomLabelListsEnabled(settings)
        ? ListPatterns.isCustomLabelList(lineText)
        : null;
    if (customLabelMatch) {
        return {
            marker: LIST_MARKERS.CUSTOM_LABEL_FULL,
            indent: customLabelMatch[1],
            spaces: customLabelMatch[4]
        };
    }

    const exampleMatch = isSyntaxFeatureEnabled(settings, 'enableExampleLists')
        ? ListPatterns.isExampleList(lineText)
        : null;
    if (exampleMatch) {
        return {
            marker: LIST_MARKERS.EXAMPLE_FULL,
            indent: exampleMatch[1],
            spaces: exampleMatch[4]
        };
    }

    const definitionMatch = isSyntaxFeatureEnabled(settings, 'enableDefinitionLists')
        ? ListPatterns.isDefinitionMarker(lineText)
        : null;
    if (definitionMatch) {
        return {
            marker: definitionMatch[2],
            indent: definitionMatch[1],
            spaces: definitionMatch[3]
        };
    }

    return null;
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

    if (ownerContext.owner.markerType.kind !== 'ordered') {
        const insertText = `\n${insertedLine}`;
        view.dispatch(state.update({
            changes: {
                from: insertPos,
                to: insertPos,
                insert: insertText
            },
            selection: EditorSelection.cursor(
                insertPos + 1 + getInsertedMarkerCursorOffset(insertedLine, ownerContext.owner.markerType)
            )
        }));
        return true;
    }

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

    const lineChanges = buildInsertedLineChanges(
        state.doc,
        allLines,
        nextLines,
        insertedLineIndex,
        insertPos
    );
    if (!lineChanges) {
        return false;
    }

    view.dispatch({
        changes: lineChanges.changes,
        selection: EditorSelection.cursor(
            getLineStartOffset(nextLines, insertedLineIndex) +
                getInsertedMarkerCursorOffset(insertedLine, ownerContext.owner.markerType)
        )
    });

    return true;
}

function getNextStandardListMarker(
    lineText: string,
    allLines: string[],
    currentLineIndex: number,
    settings: NewListItemConfig['settings']
): NewListItemConfig['markerInfo'] | null {
    const standardItem = parseStructuralListItem(lineText, settings);
    if (!standardItem) {
        return null;
    }

    if (standardItem.kind === 'unordered') {
        return {
            marker: standardItem.marker,
            indent: standardItem.indent,
            spaces: getInsertedSpaces(standardItem)
        };
    }

    if (
        standardItem.kind === 'hash' ||
        standardItem.kind === 'example' ||
        standardItem.kind === 'custom-label' ||
        standardItem.kind === 'definition'
    ) {
        return {
            marker: formatNonOrderedMarker(getNonOrderedMarkerType(standardItem)),
            indent: standardItem.indent,
            spaces: getInsertedSpaces(standardItem)
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
        spaces: getInsertedSpaces(standardItem)
    };
}

function getInsertedSpaces(
    item: NonNullable<ReturnType<typeof parseStructuralListItem>>
): string {
    return item.taskState === null ? item.spaces || ' ' : ' [ ] ';
}

function getNonOrderedMarkerType(
    item: NonNullable<ReturnType<typeof parseStructuralListItem>>
): Exclude<StandardListMarkerType, { kind: 'ordered' }> {
    if (item.kind === 'unordered') {
        return { kind: 'unordered', marker: item.marker, taskState: item.taskState };
    }

    if (item.kind === 'hash') {
        return { kind: 'hash', taskState: item.taskState };
    }

    if (item.kind === 'example') {
        return { kind: 'example', taskState: item.taskState };
    }

    if (item.kind === 'custom-label') {
        return { kind: 'custom-label', taskState: null };
    }

    return { kind: 'definition', marker: item.marker as ':' | '~', taskState: null };
}
