import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';
import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import { INDENTATION } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { removeIndentLevel } from '../utils/indentation';
import {
    buildExpectedMovedDocumentLines,
    LineRange,
    setPendingListBlockReconciliation
} from '../utils/listBlockReconciliation';
import { isExtendedList } from '../utils/markerDetection';
import { getMarkerForIndent } from '../utils/unorderedMarkers';
import { resolveSettings, SettingsProvider } from '../types';
import {
    formatOrderedListMarker,
    getIndentColumns,
    parseOrderedListMarker,
    resolveOrderedMarkerForTarget
} from '../../../shared/utils/orderedListMarkers';
import {
    formatStandardMarkerType,
    resolveLocalChildMarkerForMove,
    resolvePreviousTargetMarker,
    resolveStandardListItem
} from '../../../shared/utils/standardListMarkerResolution';
import type { OrderedListMarkerStyle } from '../../../shared/types/orderedListTypes';
import type { StandardListMarkerType } from '../../../shared/utils/standardListMarkerResolution';

interface MovedOrderedLine {
    lineIndex: number;
    parentLineIndex: number;
    targetIndentColumns: number;
    style: OrderedListMarkerStyle;
    ordinal: number;
}

function getTabListMatch(lineText: string, settings: PandocExtendedMarkdownSettings): RegExpMatchArray | null {
    if (ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE.test(lineText)) {
        return lineText.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE);
    }

    if (ListPatterns.ORDERED_LIST_MARKER_WITH_SPACE.test(lineText)) {
        return lineText.match(ListPatterns.ORDERED_LIST_MARKER_WITH_SPACE);
    }

    return isExtendedList(lineText, settings)
        ? lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE)
        : null;
}

function getShiftTabListMatch(lineText: string, settings: PandocExtendedMarkdownSettings): RegExpMatchArray | null {
    if (ListPatterns.UNORDERED_LIST_MARKER_WITH_INDENT_AND_SPACE.test(lineText)) {
        return lineText.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_INDENT_AND_SPACE);
    }

    if (ListPatterns.ORDERED_LIST_MARKER_WITH_INDENT_AND_SPACE.test(lineText)) {
        return lineText.match(ListPatterns.ORDERED_LIST_MARKER_WITH_INDENT_AND_SPACE);
    }

    return isExtendedList(lineText, settings)
        ? lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_INDENT_AND_SPACE)
        : null;
}

function getMarkerForTargetIndent(
    marker: string,
    currentIndent: string,
    targetIndent: string,
    lines: string[],
    lineIndex: number,
    shouldResolveOrdinal: boolean,
    direction: 'indent' | 'outdent',
    settings: PandocExtendedMarkdownSettings,
    movedOrderedLines: MovedOrderedLine[]
): string {
    const currentLineItem = resolveStandardListItem(lines, lineIndex);
    const orderedMarker = parseOrderedListMarker(`${currentIndent}${marker} `, lines, lineIndex);
    const targetIndentColumns = getIndentColumns(targetIndent);
    const previousTargetMarker = resolvePreviousTargetMarker({
        lines,
        startLineIndex: lineIndex - 1,
        targetIndentColumns,
        settings
    });

    if (!orderedMarker) {
        if (previousTargetMarker) {
            return previousTargetMarker.marker;
        }

        const overrideMarkerType = getLocalOverrideMarkerType(
            currentLineItem?.markerType ?? { kind: 'unordered', marker },
            getIndentColumns(currentIndent),
            targetIndentColumns,
            lines,
            lineIndex
        );

        return overrideMarkerType
            ? formatStandardMarkerType(overrideMarkerType)
            : getMarkerForIndent(marker, targetIndent, settings);
    }

    if (previousTargetMarker && isUnorderedMarker(previousTargetMarker.marker)) {
        return previousTargetMarker.marker;
    }

    const overrideMarkerType = getLocalOverrideMarkerType(
        currentLineItem?.markerType ?? { kind: 'ordered', style: orderedMarker.style },
        getIndentColumns(currentIndent),
        targetIndentColumns,
        lines,
        lineIndex
    );

    if (overrideMarkerType?.kind === 'unordered') {
        return overrideMarkerType.marker;
    }

    const parentLineIndex = findMovedTargetParentLineIndex(movedOrderedLines, targetIndentColumns);
    const previousMovedSibling = findPreviousMovedSibling(
        movedOrderedLines,
        targetIndentColumns,
        parentLineIndex
    );
    const resolvedMarker = resolveOrderedMarkerForTarget({
        lines,
        currentLineIndex: lineIndex,
        currentIndentColumns: getIndentColumns(currentIndent),
        targetIndentColumns,
        currentStyle: orderedMarker.style,
        direction,
        settings
    });
    const style = previousMovedSibling?.style ??
        (overrideMarkerType?.kind === 'ordered' ? overrideMarkerType.style : resolvedMarker.style);
    const ordinal = shouldResolveOrdinal
        ? previousMovedSibling
            ? previousMovedSibling.ordinal + 1
            : resolvedMarker.ordinal
        : orderedMarker.ordinal;

    movedOrderedLines.push({
        lineIndex,
        parentLineIndex,
        targetIndentColumns,
        style,
        ordinal
    });

    return formatOrderedListMarker(style, ordinal);
}

function isUnorderedMarker(marker: string): boolean {
    return marker === '-' || marker === '+' || marker === '*';
}

function getLocalOverrideMarkerType(
    currentMarkerType: StandardListMarkerType,
    currentIndentColumns: number,
    targetIndentColumns: number,
    lines: string[],
    lineIndex: number
): StandardListMarkerType | null {
    return resolveLocalChildMarkerForMove({
        lines,
        currentLineIndex: lineIndex,
        currentIndentColumns,
        targetIndentColumns,
        currentMarkerType
    });
}

function getLineIndent(lineText: string): string {
    return lineText.match(ListPatterns.INDENT_ONLY)?.[1] ?? '';
}

function findSubtreeEndLineIndex(lines: string[], lineIndex: number, indent: string): number {
    const baseColumns = getIndentColumns(indent);
    let endIndex = lineIndex;

    for (let index = lineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            endIndex = index;
            continue;
        }

        if (getIndentColumns(getLineIndent(lines[index])) <= baseColumns) {
            break;
        }

        endIndex = index;
    }

    return endIndex;
}

function findContiguousListBlock(lines: string[], lineIndex: number): LineRange {
    let startIndex = lineIndex;
    let endIndex = lineIndex;

    for (let index = lineIndex - 1; index >= 0; index--) {
        if (!lines[index].trim()) {
            break;
        }

        startIndex = index;
    }

    for (let index = lineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            break;
        }

        endIndex = index;
    }

    return { startIndex, endIndex };
}

function changeLineIndent(lineText: string, direction: 'indent' | 'outdent'): string {
    const indent = getLineIndent(lineText);
    return direction === 'indent'
        ? `${INDENTATION.FOUR_SPACES}${lineText}`
        : `${removeIndentLevel(indent)}${lineText.substring(indent.length)}`;
}

function updateMovedLineMarker(
    lineText: string,
    lineIndex: number,
    targetLineText: string,
    shouldResolveOrdinal: boolean,
    direction: 'indent' | 'outdent',
    lines: string[],
    settings: PandocExtendedMarkdownSettings,
    movedOrderedLines: MovedOrderedLine[]
): string {
    const listMatch = getTabListMatch(lineText, settings);
    if (!listMatch) {
        return targetLineText;
    }

    const marker = listMatch[2];
    const space = listMatch[3];
    const markerEnd = listMatch[1].length + marker.length + space.length;
    const targetIndent = getLineIndent(targetLineText);
    const targetMarker = getMarkerForTargetIndent(
        marker,
        listMatch[1],
        targetIndent,
        lines,
        lineIndex,
        shouldResolveOrdinal,
        direction,
        settings,
        movedOrderedLines
    );

    return `${targetIndent}${targetMarker}${space}${lineText.substring(markerEnd)}`;
}

function buildMovedSubtreeLines(
    lines: string[],
    startIndex: number,
    endIndex: number,
    direction: 'indent' | 'outdent',
    settings: PandocExtendedMarkdownSettings
): string[] {
    const workingLines = [...lines];
    const movedOrderedLines: MovedOrderedLine[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
        const targetLineText = changeLineIndent(lines[index], direction);
        const shouldResolveOrdinal = index === startIndex || settings.autoRenumberLists;
        workingLines[index] = updateMovedLineMarker(
            lines[index],
            index,
            targetLineText,
            shouldResolveOrdinal,
            direction,
            workingLines,
            settings,
            movedOrderedLines
        );
    }

    return workingLines.slice(startIndex, endIndex + 1);
}

function findMovedTargetParentLineIndex(
    movedOrderedLines: MovedOrderedLine[],
    targetIndentColumns: number
): number {
    for (let index = movedOrderedLines.length - 1; index >= 0; index--) {
        if (movedOrderedLines[index].targetIndentColumns < targetIndentColumns) {
            return movedOrderedLines[index].lineIndex;
        }
    }

    return -1;
}

function findPreviousMovedSibling(
    movedOrderedLines: MovedOrderedLine[],
    targetIndentColumns: number,
    parentLineIndex: number
): MovedOrderedLine | null {
    for (let index = movedOrderedLines.length - 1; index >= 0; index--) {
        const movedLine = movedOrderedLines[index];
        if (
            movedLine.targetIndentColumns === targetIndentColumns &&
            movedLine.parentLineIndex === parentLineIndex
        ) {
            return movedLine;
        }
    }

    return null;
}

function getCursorOffsetAfterMarker(
    oldOffset: number,
    oldMarkerEnd: number,
    newMarkerEnd: number
): number {
    return oldOffset <= oldMarkerEnd
        ? newMarkerEnd
        : Math.max(newMarkerEnd, oldOffset + newMarkerEnd - oldMarkerEnd);
}

function getMarkerEnd(lineText: string): number | null {
    return lineText.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE)?.[0].length ??
        lineText.match(ListPatterns.ORDERED_LIST_MARKER_WITH_SPACE)?.[0].length ??
        lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE)?.[0].length ??
        null;
}

function isCursorAtTabHandledPosition(
    lineText: string,
    lineFrom: number,
    selectionFrom: number,
    selectionTo: number,
    markerEnd: number,
    indentLength: number
): boolean {
    if (selectionTo !== selectionFrom) {
        return false;
    }

    if (selectionFrom === lineFrom + markerEnd) {
        return true;
    }

    const hasContent = lineText.substring(markerEnd).trim().length > 0;
    return !hasContent &&
        selectionFrom >= lineFrom + indentLength &&
        selectionFrom <= lineFrom + lineText.length;
}

function isCursorAtShiftTabHandledPosition(
    lineText: string,
    lineFrom: number,
    selectionFrom: number,
    selectionTo: number,
    markerEnd: number,
    indentLength: number
): boolean {
    const hasContent = lineText.substring(markerEnd).trim().length > 0;
    return hasContent || isCursorAtTabHandledPosition(
        lineText,
        lineFrom,
        selectionFrom,
        selectionTo,
        markerEnd,
        indentLength
    );
}

/**
 * Creates the Tab key handler for nested lists.
 *
 * @returns KeyBinding for Tab key
 */
export function createTabHandler(settingsProvider: SettingsProvider): KeyBinding {
    return {
        key: 'Tab',
        run: (view: EditorView): boolean => {
            const settings = resolveSettings(settingsProvider);
            const state = view.state;
            const selection = state.selection.main;

            // Get the current line
            const line = state.doc.lineAt(selection.from);
            const lineText = line.text;

            // Check if we're at the start of a list item (after the marker)
            const listMatch = getTabListMatch(lineText, settings);
            if (listMatch) {
                const currentIndent = listMatch[1];
                const marker = listMatch[2];
                const space = listMatch[3];
                const markerEnd = currentIndent.length + marker.length + space.length;
                const handledPosition = isCursorAtTabHandledPosition(
                    lineText,
                    line.from,
                    selection.from,
                    selection.to,
                    markerEnd,
                    currentIndent.length
                );

                // Only handle Tab if cursor is at the beginning of the content (right after marker)
                if (handledPosition) {
                    const lines = state.doc.toString().split('\n');
                    const currentLineIndex = line.number - 1;
                    const subtreeEndIndex = findSubtreeEndLineIndex(lines, currentLineIndex, currentIndent);
                    const listBlockRange = findContiguousListBlock(lines, currentLineIndex);
                    const replacementLines = buildMovedSubtreeLines(
                        lines,
                        currentLineIndex,
                        subtreeEndIndex,
                        'indent',
                        settings
                    );
                    const expectedLines = buildExpectedMovedDocumentLines(
                        lines,
                        currentLineIndex,
                        subtreeEndIndex,
                        replacementLines
                    );
                    const newLine = replacementLines[0];
                    const endLine = state.doc.line(subtreeEndIndex + 1);

                    const changes = {
                        from: line.from,
                        to: endLine.to,
                        insert: replacementLines.join('\n')
                    };

                    const newMarkerEnd = getMarkerEnd(newLine) ??
                        markerEnd + INDENTATION.TAB_SIZE;
                    setPendingListBlockReconciliation(expectedLines, listBlockRange);
                    const transaction = state.update({
                        changes,
                        selection: EditorSelection.cursor(line.from + newMarkerEnd)
                    });

                    view.dispatch(transaction);
                    return true;
                }
            }

            return false; // Let default Tab handling take over
        }
    };
}

/**
 * Creates the Shift+Tab key handler for dedenting.
 *
 * @returns KeyBinding for Shift+Tab key
 */
export function createShiftTabHandler(settingsProvider: SettingsProvider): KeyBinding {
    return {
        key: 'Shift-Tab',
        run: (view: EditorView): boolean => {
            const settings = resolveSettings(settingsProvider);
            const state = view.state;
            const selection = state.selection.main;

            // Get the current line
            const line = state.doc.lineAt(selection.from);
            const lineText = line.text;

            // Check if we're in a list item with indentation
            const listMatch = getShiftTabListMatch(lineText, settings);
            if (listMatch && listMatch[1].length > 0) {
                const currentIndent = listMatch[1];
                const marker = listMatch[2];
                const space = listMatch[3];
                const markerEnd = currentIndent.length + marker.length + space.length;

                if (!isCursorAtShiftTabHandledPosition(
                    lineText,
                    line.from,
                    selection.from,
                    selection.to,
                    markerEnd,
                    currentIndent.length
                )) {
                    return false;
                }

                const lines = state.doc.toString().split('\n');
                const currentLineIndex = line.number - 1;
                const subtreeEndIndex = findSubtreeEndLineIndex(lines, currentLineIndex, currentIndent);
                const listBlockRange = findContiguousListBlock(lines, currentLineIndex);
                const replacementLines = buildMovedSubtreeLines(
                    lines,
                    currentLineIndex,
                    subtreeEndIndex,
                    'outdent',
                    settings
                );
                const expectedLines = buildExpectedMovedDocumentLines(
                    lines,
                    currentLineIndex,
                    subtreeEndIndex,
                    replacementLines
                );
                const newLine = replacementLines[0];
                const endLine = state.doc.line(subtreeEndIndex + 1);

                const changes = {
                    from: line.from,
                    to: endLine.to,
                    insert: replacementLines.join('\n')
                };

                // Calculate new cursor position
                const oldCursorOffset = selection.from - line.from;
                const newMarkerEnd = getMarkerEnd(newLine) ??
                    Math.max(space.length, markerEnd - INDENTATION.TAB_SIZE);
                const newCursorOffset = getCursorOffsetAfterMarker(oldCursorOffset, markerEnd, newMarkerEnd);

                setPendingListBlockReconciliation(expectedLines, listBlockRange);
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
}
