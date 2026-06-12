import { INDENTATION } from '../../../core/constants';
import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import type { OrderedListMarkerStyle } from '../../../shared/types/orderedListTypes';
import { getAvailableOrderedMarkerStyles, parseOrderedListMarker } from '../../../shared/utils/orderedListMarkers';
import { parseStandardListItem, ParsedStandardListItem } from '../../../shared/utils/listContext';
import {
    StandardListMarkerType,
    markerTypesEqual
} from '../../../shared/utils/standardListMarkerResolution';

export interface StandardListNode extends ParsedStandardListItem {
    lineIndex: number;
    lineText: string;
    depth: number;
    parentLineIndex: number | null;
    markerType: StandardListMarkerType;
}

export interface StandardListChunk {
    startIndex: number;
    endIndex: number;
    nodes: StandardListNode[];
}

export interface ListOwnerContext {
    chunk: StandardListChunk;
    owner: StandardListNode;
    cursorLineIndex: number;
}

export interface ExplicitChildBlock {
    indent: string;
    indentColumns: number;
    markerType: StandardListMarkerType | null;
}

interface ListStackEntry {
    indentColumns: number;
    lineIndex: number;
    depth: number;
}

export function getLineIndent(line: string): string {
    return line.match(/^(\s*)/)?.[1] ?? '';
}

export function getIndentColumns(indent: string): number {
    return Array.from(indent).reduce((columns, character) => {
        return columns + (character === INDENTATION.TAB ? INDENTATION.TAB_SIZE : 1);
    }, 0);
}

export function getLineIndentColumns(line: string): number {
    return getIndentColumns(getLineIndent(line));
}

export function addIndentLevel(indent: string): string {
    return `${indent}${INDENTATION.FOUR_SPACES}`;
}

export function removeIndentLevel(indent: string): string {
    if (indent.endsWith(INDENTATION.FOUR_SPACES)) {
        return indent.slice(0, -INDENTATION.TAB_SIZE);
    }

    if (indent.endsWith(INDENTATION.TAB)) {
        return indent.slice(0, -1);
    }

    return indent.length <= INDENTATION.TAB_SIZE
        ? ''
        : indent.slice(0, -INDENTATION.TAB_SIZE);
}

export function parseStandardListChunk(
    lines: string[],
    lineIndex: number,
    settings: PandocExtendedMarkdownSettings
): StandardListChunk {
    const startIndex = findChunkStart(lines, lineIndex);
    const endIndex = findChunkEnd(lines, lineIndex);
    const nodes: StandardListNode[] = [];
    const stack: ListStackEntry[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
        const item = parseStandardListItem(lines[index]);
        if (!item) {
            continue;
        }

        while (stack.length > 0 && stack[stack.length - 1].indentColumns >= item.indentColumns) {
            stack.pop();
        }

        const parent = stack[stack.length - 1] ?? null;
        const markerType = resolveMarkerType(lines, index, item, settings);
        if (!markerType) {
            continue;
        }

        const node: StandardListNode = {
            ...item,
            lineIndex: index,
            lineText: lines[index],
            depth: parent ? parent.depth + 1 : 1,
            parentLineIndex: parent?.lineIndex ?? null,
            markerType
        };
        nodes.push(node);
        stack.push({
            indentColumns: item.indentColumns,
            lineIndex: index,
            depth: node.depth
        });
    }

    return { startIndex, endIndex, nodes };
}

export function resolveListOwnerAtLine(
    lines: string[],
    lineIndex: number,
    settings: PandocExtendedMarkdownSettings
): ListOwnerContext | null {
    if (!lines[lineIndex]?.trim()) {
        return null;
    }

    const chunk = parseStandardListChunk(lines, lineIndex, settings);
    const directNode = chunk.nodes.find(node => node.lineIndex === lineIndex);
    if (directNode) {
        return {
            chunk,
            owner: directNode,
            cursorLineIndex: lineIndex
        };
    }

    const lineIndentColumns = getLineIndentColumns(lines[lineIndex]);
    for (let index = chunk.nodes.length - 1; index >= 0; index--) {
        const candidate = chunk.nodes[index];
        if (candidate.lineIndex >= lineIndex || candidate.indentColumns >= lineIndentColumns) {
            continue;
        }

        const firstNestedChild = chunk.nodes.find(node =>
            node.lineIndex > candidate.lineIndex &&
            node.lineIndex < lineIndex &&
            node.indentColumns > candidate.indentColumns
        );
        if (firstNestedChild) {
            continue;
        }

        return {
            chunk,
            owner: candidate,
            cursorLineIndex: lineIndex
        };
    }

    return null;
}

export function getDirectContinuationLineIndices(
    lines: string[],
    owner: StandardListNode
): number[] {
    const lineIndices: number[] = [];

    for (let index = owner.lineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            break;
        }

        const item = parseStandardListItem(lines[index]);
        if (item) {
            break;
        }

        if (getLineIndentColumns(lines[index]) <= owner.indentColumns) {
            break;
        }

        lineIndices.push(index);
    }

    return lineIndices;
}

export function findExplicitChildBlock(
    lines: string[],
    owner: StandardListNode,
    settings: PandocExtendedMarkdownSettings
): ExplicitChildBlock | null {
    const firstLineIndex = owner.lineIndex + 1;
    if (firstLineIndex >= lines.length || !lines[firstLineIndex].trim()) {
        return null;
    }

    const firstIndent = getLineIndent(lines[firstLineIndex]);
    const firstIndentColumns = getIndentColumns(firstIndent);
    if (firstIndentColumns <= owner.indentColumns) {
        return null;
    }

    for (let index = firstLineIndex; index < lines.length; index++) {
        if (!lines[index].trim()) {
            break;
        }

        if (getLineIndentColumns(lines[index]) <= owner.indentColumns) {
            break;
        }

        const item = parseStandardListItem(lines[index]);
        if (!item) {
            continue;
        }

        return {
            indent: item.indent,
            indentColumns: item.indentColumns,
            markerType: resolveMarkerType(lines, index, item, settings)
        };
    }

    return {
        indent: firstIndent,
        indentColumns: firstIndentColumns,
        markerType: null
    };
}

export function resolveMarkerTypeForDepth(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number,
    settings: PandocExtendedMarkdownSettings,
    explicitMarkerType?: StandardListMarkerType | null
): StandardListMarkerType {
    if (explicitMarkerType) {
        return explicitMarkerType;
    }

    const previous = findPreviousNodeAtDepth(chunk, editLineIndex, targetDepth);
    if (previous) {
        return previous.markerType;
    }

    const following = findFollowingNodeAtDepth(chunk, editLineIndex, targetDepth);
    if (following) {
        return following.markerType;
    }

    return {
        kind: 'ordered',
        style: resolveDefaultOrderedStyle(chunk, targetDepth, settings)
    };
}

export function findNearestNodeAtDepth(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number
): StandardListNode | null {
    return findPreviousNodeAtDepth(chunk, editLineIndex, targetDepth) ??
        findFollowingNodeAtDepth(chunk, editLineIndex, targetDepth);
}

export function getPreviousSiblingOrdinal(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number,
    markerType: StandardListMarkerType,
    targetParentLineIndex: number | null
): number | null {
    for (let index = chunk.nodes.length - 1; index >= 0; index--) {
        const node = chunk.nodes[index];
        if (node.lineIndex >= editLineIndex) {
            continue;
        }

        if (
            node.depth === targetDepth &&
            node.parentLineIndex === targetParentLineIndex &&
            markerTypesEqual(node.markerType, markerType)
        ) {
            const parsed = parseOrderedListMarker(node.lineText);
            return parsed?.ordinal ?? null;
        }
    }

    return null;
}

export function findTargetParentLineIndex(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number
): number | null {
    if (targetDepth <= 1) {
        return null;
    }

    for (let index = chunk.nodes.length - 1; index >= 0; index--) {
        const node = chunk.nodes[index];
        if (node.lineIndex >= editLineIndex) {
            continue;
        }

        if (node.depth === targetDepth - 1) {
            return node.lineIndex;
        }
    }

    return null;
}

function resolveMarkerType(
    lines: string[],
    lineIndex: number,
    item: ParsedStandardListItem,
    settings: PandocExtendedMarkdownSettings
): StandardListMarkerType | null {
    if (item.kind === 'unordered') {
        return { kind: 'unordered', marker: item.marker };
    }

    const ordered = parseOrderedListMarker(lines[lineIndex], lines, lineIndex);
    if (!ordered) {
        return null;
    }

    if (!settings.enableOrderedListMarkerCycling) {
        return { kind: 'ordered', style: ordered.style };
    }

    return { kind: 'ordered', style: ordered.style };
}

function findPreviousNodeAtDepth(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number
): StandardListNode | null {
    for (let index = chunk.nodes.length - 1; index >= 0; index--) {
        const node = chunk.nodes[index];
        if (node.lineIndex < editLineIndex && node.depth === targetDepth) {
            return node;
        }
    }

    return null;
}

function findFollowingNodeAtDepth(
    chunk: StandardListChunk,
    editLineIndex: number,
    targetDepth: number
): StandardListNode | null {
    for (const node of chunk.nodes) {
        if (node.lineIndex > editLineIndex && node.depth === targetDepth) {
            return node;
        }
    }

    return null;
}

function resolveDefaultOrderedStyle(
    chunk: StandardListChunk,
    targetDepth: number,
    settings: PandocExtendedMarkdownSettings
): OrderedListMarkerStyle {
    const order = getAvailableOrderedMarkerStyles(settings);
    const fallbackOrder = order.length > 0 ? order : ['decimal-period' as OrderedListMarkerStyle];
    const deepestOrdered = [...chunk.nodes]
        .filter(node => node.depth < targetDepth && node.markerType.kind === 'ordered')
        .sort((left, right) => right.depth - left.depth)[0];

    if (deepestOrdered?.markerType.kind === 'ordered') {
        const startIndex = fallbackOrder.indexOf(deepestOrdered.markerType.style);
        const normalizedStartIndex = startIndex >= 0 ? startIndex : 0;
        return fallbackOrder[
            (normalizedStartIndex + targetDepth - deepestOrdered.depth) % fallbackOrder.length
        ];
    }

    return fallbackOrder[(targetDepth - 1) % fallbackOrder.length];
}

function findChunkStart(lines: string[], lineIndex: number): number {
    for (let index = lineIndex - 1; index >= 0; index--) {
        if (!lines[index].trim()) {
            return index + 1;
        }
    }

    return 0;
}

function findChunkEnd(lines: string[], lineIndex: number): number {
    for (let index = lineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            return index - 1;
        }
    }

    return lines.length - 1;
}
