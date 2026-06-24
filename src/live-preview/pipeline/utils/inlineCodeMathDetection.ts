// External libraries
import { Text } from '@codemirror/state';

// Types
import { CodeRegion } from '../../../shared/types/codeTypes';

export function detectInlineCodeAndMathRegionsInRange(
    doc: Text,
    from: number,
    to: number
): CodeRegion[] {
    const safeFrom = Math.max(0, Math.min(from, doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, doc.length));
    if (safeFrom === safeTo) {
        return [];
    }

    const startLine = doc.lineAt(safeFrom);
    const endLine = doc.lineAt(Math.max(safeFrom, safeTo - 1));
    const regions: CodeRegion[] = [];

    for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
        const line = doc.line(lineNumber);
        collectInlineCodeRegions(line.text, line.from, regions);
    }
    collectMathRegions(doc.sliceString(startLine.from, endLine.to), startLine.from, regions);

    return mergeRegions(regions, false)
        .filter(region => rangesOverlap(region.from, region.to, safeFrom, safeTo));
}

function collectInlineCodeRegions(lineText: string, lineFrom: number, regions: CodeRegion[]): void {
    let index = 0;

    while (index < lineText.length) {
        if (lineText[index] !== '`' || isEscaped(lineText, index)) {
            index++;
            continue;
        }

        const runLength = countRepeated(lineText, index, '`');
        const closingIndex = findClosingBacktickRun(lineText, index + runLength, runLength);
        if (closingIndex === -1) {
            index += runLength;
            continue;
        }

        regions.push({
            from: lineFrom + index,
            to: lineFrom + closingIndex + runLength,
            type: 'inline-code'
        });
        index = closingIndex + runLength;
    }
}

function collectMathRegions(text: string, offset: number, regions: CodeRegion[]): void {
    let index = 0;

    while (index < text.length) {
        if (text[index] !== '$' || isEscaped(text, index)) {
            index++;
            continue;
        }

        const delimiter = text[index + 1] === '$' ? '$$' : '$';
        const closingIndex = findClosingDelimiter(text, delimiter, index + delimiter.length);
        if (closingIndex === -1) {
            index += delimiter.length;
            continue;
        }

        regions.push({
            from: offset + index,
            to: offset + closingIndex + delimiter.length,
            type: 'math'
        });
        index = closingIndex + delimiter.length;
    }
}

function countRepeated(text: string, index: number, character: string): number {
    let count = 0;
    while (text[index + count] === character) {
        count++;
    }
    return count;
}

function findClosingBacktickRun(text: string, start: number, runLength: number): number {
    let index = start;
    while (index < text.length) {
        if (text[index] !== '`' || isEscaped(text, index)) {
            index++;
            continue;
        }

        const candidateLength = countRepeated(text, index, '`');
        if (candidateLength === runLength) {
            return index;
        }
        index += candidateLength;
    }
    return -1;
}

function findClosingDelimiter(text: string, delimiter: '$' | '$$', start: number): number {
    let index = start;
    while (index < text.length) {
        if (text[index] !== '$' || isEscaped(text, index)) {
            index++;
            continue;
        }

        if (delimiter === '$$' && text[index + 1] === '$') {
            return index;
        }
        if (delimiter === '$' && text[index + 1] !== '$') {
            return index;
        }
        index += delimiter.length;
    }
    return -1;
}

function isEscaped(text: string, index: number): boolean {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
        slashCount++;
    }
    return slashCount % 2 === 1;
}

function rangesOverlap(leftFrom: number, leftTo: number, rightFrom: number, rightTo: number): boolean {
    return leftFrom < rightTo && leftTo > rightFrom;
}

function mergeRegions(regions: CodeRegion[], mergeAdjacent: boolean): CodeRegion[] {
    if (regions.length === 0) {
        return regions;
    }

    const sorted = [...regions].sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: CodeRegion[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];
        const overlaps = current.from <= (mergeAdjacent ? last.to : last.to - 1);

        if (current.type === last.type && overlaps) {
            last.to = Math.max(last.to, current.to);
        } else if (!(current.from === last.from && current.to === last.to && current.type === last.type)) {
            merged.push(current);
        }
    }

    return merged;
}
