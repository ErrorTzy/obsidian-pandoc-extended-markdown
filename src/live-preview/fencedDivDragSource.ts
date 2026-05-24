import { PandocExtendedMarkdownSettings } from '../core/settings';
import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from './pipeline/structural/fencedDiv/parser';

export interface FencedDivLineRange {
    startLine: number;
    endLine: number;
}

export interface FencedDivMoveResult {
    changed: boolean;
    docText: string;
    selectionAnchor: number;
}

export function moveFencedDivBlockText(
    docText: string,
    range: FencedDivLineRange,
    insertLine: number,
    settings?: PandocExtendedMarkdownSettings
): FencedDivMoveResult {
    const lines = docText.split('\n');
    const startIndex = range.startLine - 1;
    const endIndex = range.endLine;
    const insertIndex = Math.max(0, Math.min(insertLine - 1, lines.length));

    if (insertIndex >= startIndex && insertIndex <= endIndex) {
        return unchangedMove(docText);
    }

    const removal = getRemovalRange(lines, startIndex, endIndex);
    if (insertIndex >= removal.start && insertIndex <= removal.end) {
        return unchangedMove(docText);
    }

    const blockLines = lines.slice(startIndex, endIndex);
    const preservedOldSeparator = shouldPreserveOldSeparator(lines, removal, settings);
    const remainingLines = [
        ...lines.slice(0, removal.start),
        ...(preservedOldSeparator ? [''] : []),
        ...lines.slice(removal.end)
    ];
    const adjustedInsertIndex = insertIndex > removal.end
        ? insertIndex - (removal.end - removal.start) + (preservedOldSeparator ? 1 : 0)
        : insertIndex;
    const { nextLines, insertedAt } = insertWithBlankSeparators(
        remainingLines,
        blockLines,
        adjustedInsertIndex
    );

    return {
        changed: true,
        docText: nextLines.join('\n'),
        selectionAnchor: getLineStartOffset(nextLines, insertedAt)
    };
}

function shouldPreserveOldSeparator(
    lines: string[],
    removal: { start: number; end: number },
    settings?: PandocExtendedMarkdownSettings
): boolean {
    if (!didRemoveSeparator(lines, removal)) {
        return false;
    }

    const previousLine = removal.start > 0 ? lines[removal.start - 1] : undefined;
    const nextLine = removal.end < lines.length ? lines[removal.end] : undefined;
    if (!previousLine || !nextLine || isBlankLine(previousLine) || isBlankLine(nextLine)) {
        return false;
    }

    return Boolean(parseFencedDivOpening(nextLine, settings)) &&
        !isFencedDivClosing(previousLine) &&
        !allowsFencedDivOpeningAfterLine(previousLine);
}

function didRemoveSeparator(
    lines: string[],
    removal: { start: number; end: number }
): boolean {
    return (removal.start < lines.length && isBlankLine(lines[removal.start])) ||
        (removal.end > 0 && isBlankLine(lines[removal.end - 1]));
}

function unchangedMove(docText: string): FencedDivMoveResult {
    return {
        changed: false,
        docText,
        selectionAnchor: 0
    };
}

function getRemovalRange(
    lines: string[],
    startIndex: number,
    endIndex: number
): { start: number; end: number } {
    return {
        start: startIndex > 0 && isBlankLine(lines[startIndex - 1])
            ? startIndex - 1
            : startIndex,
        end: endIndex
    };
}

function insertWithBlankSeparators(
    lines: string[],
    blockLines: string[],
    insertIndex: number
): { nextLines: string[]; insertedAt: number } {
    const prefix = needsBlankBefore(lines, insertIndex) ? [''] : [];
    const suffix = needsBlankAfter(lines, insertIndex) ? [''] : [];
    const insertedAt = insertIndex + prefix.length;

    return {
        nextLines: [
            ...lines.slice(0, insertIndex),
            ...prefix,
            ...blockLines,
            ...suffix,
            ...lines.slice(insertIndex)
        ],
        insertedAt
    };
}

function needsBlankBefore(lines: string[], insertIndex: number): boolean {
    return insertIndex > 0 && !isBlankLine(lines[insertIndex - 1]);
}

function needsBlankAfter(lines: string[], insertIndex: number): boolean {
    return insertIndex < lines.length && !isBlankLine(lines[insertIndex]);
}

function isBlankLine(line: string): boolean {
    return line.trim() === '';
}

function getLineStartOffset(lines: string[], lineIndex: number): number {
    return lines
        .slice(0, lineIndex)
        .reduce((offset, line) => offset + line.length + 1, 0);
}
