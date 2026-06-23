// External libraries
import { EditorSelection } from '@codemirror/state';

// Types
import { EmptyListHandlingConfig } from '../types';

// Utils
import { isEmptyListItem } from '../../../shared/utils/listHelpers';
import {
    formatOrderedListMarker,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import { renumberOrderedGroup } from '../utils/orderedSiblingRenumbering';
import {
    findNearestNodeAtDepth,
    findTargetParentLineIndex,
    formatMarkerPrefix,
    formatNonOrderedMarker,
    getInsertedTaskState,
    getInsertedMarkerCursorOffset,
    getPreviousSiblingOrdinal,
    parseStructuralListItem,
    removeIndentLevel,
    resolveListOwnerAtLine,
    resolveMarkerTypeForDepth,
    StandardListMarkerType
} from '../utils/standardListStructure';
import {
    isEnabledStandardListLine,
    showListAutocompletionError
} from '../utils/debugNotice';
import {
    buildChangedLineChanges,
    getLineStartOffset
} from '../utils/documentChanges';

/**
 * Handles special cases for empty example and custom label lists.
 *
 * @param config - Configuration for empty list handling
 * @returns True if the empty list case was handled
 */
export function handleEmptyListSpecialCases(config: EmptyListHandlingConfig): boolean {
    const { beforeCursor, afterCursor } = config;

    // Handle empty example list between @ and )
    if (beforeCursor.endsWith('(@') && afterCursor.startsWith(')')) {
        return handleStandardEmptyListItem(config);
    }

    // Handle empty custom label list between {:: and }
    if (beforeCursor.endsWith('{::') && afterCursor.startsWith('}')) {
        return handleStandardEmptyListItem(config);
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
    const lineIndex = line.number - 1;
    const allLines = state.doc.toString().split('\n');
    const structuralItem = parseStructuralListItem(lineText, config.settings);
    const isEmptyStructuralTask = structuralItem?.taskState !== null && structuralItem?.content === '';

    if (!isEmptyListItem(lineText) && !isEmptyStructuralTask) {
        return false;
    }

    if (isEnabledStandardListLine(lineText, allLines, lineIndex, config.settings)) {
        if (handleStandardEmptyListItem(config)) {
            return true;
        }

        return showListAutocompletionError(
            'The empty structural list item could not be returned to its parent depth.',
            line.number
        );
    }

    return showListAutocompletionError(
        'Empty non-structural list items are not handled by the structural list resolver.',
        line.number
    );
}

function handleStandardEmptyListItem(config: EmptyListHandlingConfig): boolean {
    const { view, currentLine, settings } = config;
    const state = view.state;
    const lineIndex = currentLine.line.number - 1;
    const lines = state.doc.toString().split('\n');
    const ownerContext = resolveListOwnerAtLine(lines, lineIndex, settings);
    if (!ownerContext || ownerContext.owner.lineIndex !== lineIndex) {
        return false;
    }

    const { chunk, owner } = ownerContext;
    if (owner.depth <= 1) {
        view.dispatch(state.update({
            changes: {
                from: currentLine.line.from,
                to: currentLine.line.to,
                insert: owner.indent
            },
            selection: EditorSelection.cursor(currentLine.line.from + owner.indent.length)
        }));
        return true;
    }

    const targetDepth = owner.depth - 1;
    const explicitParent = chunk.nodes.find(node => node.lineIndex === owner.parentLineIndex) ?? null;
    const targetIndent = explicitParent?.indent ??
        findNearestNodeAtDepth(chunk, owner.lineIndex, targetDepth)?.indent ??
        removeIndentLevel(owner.indent);
    const targetMarkerType = resolveMarkerTypeForDepth(
        chunk,
        owner.lineIndex,
        targetDepth,
        settings,
        {
            explicitMarkerType: explicitParent?.markerType ?? null,
            fallbackMarkerType: owner.markerType
        }
    );
    const targetParentLineIndex = explicitParent?.parentLineIndex ??
        findTargetParentLineIndex(chunk, owner.lineIndex, targetDepth);
    const marker = targetMarkerType.kind !== 'ordered'
        ? formatNonOrderedMarker(targetMarkerType)
        : formatEmptyReturnOrderedMarker(
            lines,
            owner.lineIndex,
            chunk,
            targetDepth,
            targetParentLineIndex,
            targetMarkerType,
            settings
        );
    const newLine = `${targetIndent}${formatMarkerPrefix(
        marker,
        targetMarkerType,
        getInsertedTaskState(targetMarkerType)
    )}`;
    const nextLines = [...lines];
    nextLines[lineIndex] = newLine;

    if (settings.autoRenumberLists && targetMarkerType.kind === 'ordered') {
        renumberOrderedGroup(nextLines, lineIndex, {
            depth: targetDepth,
            parentLineIndex: targetParentLineIndex,
            markerType: targetMarkerType
        }, settings);
    }

    const lineChanges = buildChangedLineChanges(state.doc, lines, nextLines);
    if (!lineChanges) {
        return false;
    }

    view.dispatch({
        changes: lineChanges.changes,
        selection: EditorSelection.cursor(
            getLineStartOffset(nextLines, lineIndex) +
                getInsertedMarkerCursorOffset(newLine, targetMarkerType)
        )
    });

    return true;
}

function formatEmptyReturnOrderedMarker(
    lines: string[],
    ownerLineIndex: number,
    chunk: NonNullable<ReturnType<typeof resolveListOwnerAtLine>>['chunk'],
    targetDepth: number,
    targetParentLineIndex: number | null,
    markerType: Extract<StandardListMarkerType, { kind: 'ordered' }>,
    settings: EmptyListHandlingConfig['settings']
): string {
    const currentOrdered = parseOrderedListMarker(lines[ownerLineIndex], lines, ownerLineIndex);
    const previousOrdinal = getPreviousSiblingOrdinal(
        chunk,
        ownerLineIndex,
        targetDepth,
        markerType,
        targetParentLineIndex
    );
    const ordinal = settings.autoRenumberLists || !currentOrdered
        ? (previousOrdinal ?? 0) + 1
        : currentOrdered.ordinal;

    return formatOrderedListMarker(markerType.style, ordinal);
}
