import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';
import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import { INDENTATION } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { removeIndentLevel } from '../utils/indentation';
import { isExtendedList } from '../utils/markerDetection';
import { getMarkerForIndent } from '../utils/unorderedMarkers';
import { resolveSettings, SettingsProvider } from '../types';
import {
    formatOrderedListMarker,
    getIndentColumns,
    parseOrderedListMarker,
    resolveOrderedListMarkerStyle
} from '../../../shared/utils/orderedListMarkers';

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
    direction: 'indent' | 'outdent',
    settings: PandocExtendedMarkdownSettings
): string {
    const unorderedMarker = getMarkerForIndent(marker, targetIndent, settings);
    const orderedMarker = parseOrderedListMarker(`${currentIndent}${marker} `, lines, lineIndex);

    if (!orderedMarker) {
        return unorderedMarker;
    }

    const style = resolveOrderedListMarkerStyle({
        lines,
        currentLineIndex: lineIndex,
        currentIndentColumns: getIndentColumns(currentIndent),
        targetIndentColumns: getIndentColumns(targetIndent),
        currentStyle: orderedMarker.style,
        direction,
        settings
    });

    return formatOrderedListMarker(style, 1);
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
    direction: 'indent' | 'outdent',
    lines: string[],
    settings: PandocExtendedMarkdownSettings
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
        direction,
        settings
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

    for (let index = startIndex; index <= endIndex; index++) {
        const targetLineText = changeLineIndent(lines[index], direction);
        workingLines[index] = updateMovedLineMarker(
            lines[index],
            index,
            targetLineText,
            direction,
            workingLines,
            settings
        );
    }

    return workingLines.slice(startIndex, endIndex + 1);
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

                // Only handle Tab if cursor is at the beginning of the content (right after marker)
                if (selection.from === line.from + markerEnd && selection.to === selection.from) {
                    const lines = state.doc.toString().split('\n');
                    const currentLineIndex = line.number - 1;
                    const subtreeEndIndex = findSubtreeEndLineIndex(lines, currentLineIndex, currentIndent);
                    const replacementLines = buildMovedSubtreeLines(
                        lines,
                        currentLineIndex,
                        subtreeEndIndex,
                        'indent',
                        settings
                    );
                    const newLine = replacementLines[0];
                    const endLine = state.doc.line(subtreeEndIndex + 1);

                    const changes = {
                        from: line.from,
                        to: endLine.to,
                        insert: replacementLines.join('\n')
                    };

                    const newMarkerEnd = newLine.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE)?.[0].length ??
                        markerEnd + INDENTATION.TAB_SIZE;
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

                const lines = state.doc.toString().split('\n');
                const currentLineIndex = line.number - 1;
                const subtreeEndIndex = findSubtreeEndLineIndex(lines, currentLineIndex, currentIndent);
                const replacementLines = buildMovedSubtreeLines(
                    lines,
                    currentLineIndex,
                    subtreeEndIndex,
                    'outdent',
                    settings
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
                const newMarkerEnd = newLine.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE)?.[0].length ??
                    Math.max(space.length, markerEnd - INDENTATION.TAB_SIZE);
                const newCursorOffset = getCursorOffsetAfterMarker(oldCursorOffset, markerEnd, newMarkerEnd);

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
