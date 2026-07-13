// Types
import { ProcessingRange } from '../types';
import { PandocExtendedMarkdownSettings } from '../../../core/settings';
import type { ResolvedOrderedListItem } from '../../../shared/utils/orderedListMarkers';

// Utils
import { resolveOrderedListItems } from '../../../shared/utils/orderedListMarkers';

export function resolveOrderedListItemsByLine(
    documentLines: string[],
    settings: Partial<PandocExtendedMarkdownSettings>,
    processingRange: ProcessingRange
): Map<number, ResolvedOrderedListItem> {
    const itemsByLine = new Map<number, ResolvedOrderedListItem>();
    const indexRanges = mergeIndexRanges(processingRange.lineRanges.map(range => ({
        startIndex: findContainingBlockStart(documentLines, range.startLine - 1),
        endIndex: findContainingBlockEnd(documentLines, range.endLine - 1)
    })));

    for (const { startIndex, endIndex } of indexRanges) {
        addResolvedItems(itemsByLine, documentLines, settings, startIndex, endIndex);
    }

    return itemsByLine;
}

function addResolvedItems(
    itemsByLine: Map<number, ResolvedOrderedListItem>,
    documentLines: string[],
    settings: Partial<PandocExtendedMarkdownSettings>,
    startIndex: number,
    endIndex: number
): void {
    const items = resolveOrderedListItems(documentLines.slice(startIndex, endIndex + 1), settings);
    for (const item of items) {
        itemsByLine.set(startIndex + item.lineIndex + 1, {
            ...item,
            lineIndex: startIndex + item.lineIndex,
            parentLineIndex: item.parentLineIndex === undefined
                ? undefined
                : startIndex + item.parentLineIndex
        });
    }
}

function mergeIndexRanges(
    ranges: Array<{ startIndex: number; endIndex: number }>
): Array<{ startIndex: number; endIndex: number }> {
    const merged: Array<{ startIndex: number; endIndex: number }> = [];
    for (const range of ranges) {
        const previous = merged[merged.length - 1];
        if (previous && range.startIndex <= previous.endIndex + 1) {
            previous.endIndex = Math.max(previous.endIndex, range.endIndex);
        } else {
            merged.push({ ...range });
        }
    }
    return merged;
}

function findContainingBlockStart(documentLines: string[], startIndex: number): number {
    let index = Math.max(0, Math.min(startIndex, documentLines.length - 1));
    while (index > 0 && documentLines[index - 1].trim() !== '') {
        index--;
    }
    return index;
}

function findContainingBlockEnd(documentLines: string[], endIndex: number): number {
    let index = Math.max(0, Math.min(endIndex, documentLines.length - 1));
    while (index + 1 < documentLines.length && documentLines[index + 1].trim() !== '') {
        index++;
    }
    return index;
}
