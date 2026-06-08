import type { OrderedListMarkerStyle } from '../types/orderedListTypes';
import type { PandocExtendedMarkdownSettings } from '../types/settingsTypes';
import type { ListMarkerInfo } from '../types/listTypes';
import { parseStandardListItem, ParsedStandardListItem } from './listContext';
import { getNextListMarker } from './listMarkerDetector';
import {
    formatOrderedListMarker,
    parseOrderedListMarker
} from './orderedListMarkers';

export type StandardListMarkerType =
    | { kind: 'ordered'; style: OrderedListMarkerStyle }
    | { kind: 'unordered'; marker: string };

export interface ResolvedStandardListItem extends ParsedStandardListItem {
    lineIndex: number;
    lineText: string;
    markerType: StandardListMarkerType;
}

export interface LocalChildMarkerOverrideContext {
    lines: string[];
    currentLineIndex: number;
    parentIndentColumns: number;
    childIndentColumns: number;
    parentMarkerType: StandardListMarkerType;
}

export interface PreviousTargetMarkerContext {
    lines: string[];
    startLineIndex: number;
    targetIndentColumns: number;
    settings: Partial<PandocExtendedMarkdownSettings>;
}

export interface LocalChildMarkerForMoveContext {
    lines: string[];
    currentLineIndex: number;
    currentIndentColumns: number;
    targetIndentColumns: number;
    currentMarkerType: StandardListMarkerType;
}

export function resolveStandardListItem(
    lines: string[],
    lineIndex: number
): ResolvedStandardListItem | null {
    const item = parseStandardListItem(lines[lineIndex]);
    if (!item) {
        return null;
    }

    const markerType = resolveMarkerType(lines, lineIndex, item);
    if (!markerType) {
        return null;
    }

    return {
        ...item,
        lineIndex,
        lineText: lines[lineIndex],
        markerType
    };
}

export function findPreviousStandardListItemAtIndent(
    lines: string[],
    startLineIndex: number,
    targetIndentColumns: number
): ResolvedStandardListItem | null {
    for (let index = startLineIndex; index >= 0; index--) {
        if (!lines[index].trim()) {
            break;
        }

        const item = parseStandardListItem(lines[index]);
        const indentColumns = item?.indentColumns ?? getLineIndentColumns(lines[index]);

        if (item?.indentColumns === targetIndentColumns) {
            return resolveStandardListItem(lines, index);
        }

        if (indentColumns < targetIndentColumns) {
            break;
        }
    }

    return null;
}

export function findLocalChildMarkerOverride(
    context: LocalChildMarkerOverrideContext
): StandardListMarkerType | null {
    const startIndex = findChunkStart(context.lines, context.currentLineIndex);
    const stack: ResolvedStandardListItem[] = [];

    for (let index = startIndex; index < context.currentLineIndex; index++) {
        const item = resolveStandardListItem(context.lines, index);
        if (!item) {
            continue;
        }

        while (
            stack.length > 0 &&
            stack[stack.length - 1].indentColumns >= item.indentColumns
        ) {
            stack.pop();
        }

        const parent = stack[stack.length - 1];
        if (
            parent &&
            parent.indentColumns === context.parentIndentColumns &&
            item.indentColumns === context.childIndentColumns &&
            markerTypesEqual(parent.markerType, context.parentMarkerType)
        ) {
            return item.markerType;
        }

        stack.push(item);
    }

    return null;
}

export function resolvePreviousTargetMarker(
    context: PreviousTargetMarkerContext
): ListMarkerInfo | null {
    const targetItem = findPreviousStandardListItemAtIndent(
        context.lines,
        context.startLineIndex,
        context.targetIndentColumns
    );

    if (!targetItem) {
        return null;
    }

    if (targetItem.markerType.kind === 'unordered') {
        return {
            marker: targetItem.markerType.marker,
            indent: targetItem.indent,
            spaces: targetItem.spaces || ' '
        };
    }

    return getNextListMarker(
        targetItem.lineText,
        context.lines,
        targetItem.lineIndex,
        context.settings
    );
}

export function resolveLocalChildMarkerForMove(
    context: LocalChildMarkerForMoveContext
): StandardListMarkerType | null {
    if (context.targetIndentColumns <= context.currentIndentColumns) {
        return null;
    }

    return findLocalChildMarkerOverride({
        lines: context.lines,
        currentLineIndex: context.currentLineIndex,
        parentIndentColumns: context.currentIndentColumns,
        childIndentColumns: context.targetIndentColumns,
        parentMarkerType: context.currentMarkerType
    });
}

export function formatStandardMarkerType(
    markerType: StandardListMarkerType,
    orderedOrdinal = 1
): string {
    return markerType.kind === 'unordered'
        ? markerType.marker
        : formatOrderedListMarker(markerType.style, orderedOrdinal);
}

export function markerTypesEqual(
    left: StandardListMarkerType,
    right: StandardListMarkerType
): boolean {
    if (left.kind !== right.kind) {
        return false;
    }

    return left.kind === 'ordered'
        ? left.style === (right as { kind: 'ordered'; style: OrderedListMarkerStyle }).style
        : left.marker === (right as { kind: 'unordered'; marker: string }).marker;
}

function resolveMarkerType(
    lines: string[],
    lineIndex: number,
    item: ParsedStandardListItem
): StandardListMarkerType | null {
    if (item.kind === 'unordered') {
        return { kind: 'unordered', marker: item.marker };
    }

    const ordered = parseOrderedListMarker(lines[lineIndex], lines, lineIndex);
    return ordered
        ? { kind: 'ordered', style: ordered.style }
        : null;
}

function findChunkStart(lines: string[], currentLineIndex: number): number {
    for (let index = currentLineIndex - 1; index >= 0; index--) {
        if (!lines[index].trim()) {
            return index + 1;
        }
    }

    return 0;
}

function getLineIndentColumns(line: string): number {
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    return Array.from(indent).reduce((columns, character) => {
        return columns + (character === '\t' ? 4 : 1);
    }, 0);
}
