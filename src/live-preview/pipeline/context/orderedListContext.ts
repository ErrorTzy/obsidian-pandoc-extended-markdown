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
    const startIndex = findContainingBlockStart(documentLines, processingRange.startLine - 1);
    const endIndex = findContainingBlockEnd(documentLines, processingRange.endLine - 1);
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

    return itemsByLine;
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
