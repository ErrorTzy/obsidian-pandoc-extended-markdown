import { Text } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from '../core/settings';
import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from './pipeline/structural/fencedDiv/parser';
import { FencedDivLineRange } from './fencedDivDragSource';

interface StackItem {
    startLine: number;
    depth: number;
}

export function findFencedDivRangeAtDepth(
    doc: Text,
    lineNumber: number,
    railDepth: number,
    settings: PandocExtendedMarkdownSettings
): FencedDivLineRange | null {
    const stack: StackItem[] = [];
    let canOpenAtLine = true;
    let boundaryLine = 0;

    for (let currentLine = 1; currentLine <= doc.lines; currentLine++) {
        const text = doc.line(currentLine).text;
        if (canOpenAtLine && parseFencedDivOpening(text, settings)) {
            stack.push({ startLine: currentLine, depth: stack.length + 1 });
            boundaryLine = currentLine;
        } else if (isFencedDivClosing(text) && stack.length > 0) {
            const item = stack.pop() as StackItem;
            boundaryLine = currentLine;
            if (containsLine(item.startLine, currentLine, lineNumber) && item.depth === railDepth) {
                return { startLine: item.startLine, endLine: currentLine };
            }
        }

        canOpenAtLine = allowsFencedDivOpeningAfterLine(text) || boundaryLine === currentLine;
    }

    return null;
}

export function containsLine(startLine: number, endLine: number, lineNumber: number): boolean {
    return lineNumber >= startLine && lineNumber <= endLine;
}
