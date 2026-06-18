import type { ChangeSpec, Text } from '@codemirror/state';
import type { LineRange } from './listBlockReconciliation';

export interface ChangedLineChanges {
    changes: ChangeSpec[];
    range: LineRange;
}

interface PlainChangeSpec {
    from: number;
    to: number;
    insert: string;
}

export function buildChangedLineChanges(
    doc: Text,
    originalLines: string[],
    nextLines: string[]
): ChangedLineChanges | null {
    if (originalLines.length !== nextLines.length) {
        return null;
    }

    const changes: PlainChangeSpec[] = [];
    let startIndex: number | null = null;
    let endIndex: number | null = null;

    for (let index = 0; index < originalLines.length; index++) {
        if (originalLines[index] === nextLines[index]) {
            continue;
        }

        const line = doc.line(index + 1);
        changes.push({
            from: line.from,
            to: line.to,
            insert: nextLines[index]
        });
        startIndex = startIndex ?? index;
        endIndex = index;
    }

    return changes.length > 0 && startIndex !== null && endIndex !== null
        ? {
            changes,
            range: { startIndex, endIndex }
        }
        : null;
}

export function buildInsertedLineChanges(
    doc: Text,
    originalLines: string[],
    nextLines: string[],
    insertedLineIndex: number,
    insertPosition: number
): ChangedLineChanges | null {
    if (
        nextLines.length !== originalLines.length + 1 ||
        insertedLineIndex <= 0 ||
        insertedLineIndex >= nextLines.length
    ) {
        return null;
    }

    const changes: PlainChangeSpec[] = [];
    const anchorLineIndex = insertedLineIndex - 1;
    let insertedLineCovered = false;
    let startIndex = insertedLineIndex;
    let endIndex = insertedLineIndex;

    for (let index = 0; index < originalLines.length; index++) {
        const nextIndex = index < insertedLineIndex ? index : index + 1;
        if (originalLines[index] === nextLines[nextIndex]) {
            continue;
        }

        const line = doc.line(index + 1);
        const insert = index === anchorLineIndex
            ? `${nextLines[nextIndex]}\n${nextLines[insertedLineIndex]}`
            : nextLines[nextIndex];
        changes.push({
            from: line.from,
            to: line.to,
            insert
        });
        insertedLineCovered = insertedLineCovered || index === anchorLineIndex;
        startIndex = Math.min(startIndex, nextIndex);
        endIndex = Math.max(endIndex, nextIndex);
    }

    if (!insertedLineCovered) {
        changes.push({
            from: insertPosition,
            to: insertPosition,
            insert: `\n${nextLines[insertedLineIndex]}`
        });
    }

    return {
        changes: changes.sort((left, right) => left.from - right.from),
        range: {
            startIndex,
            endIndex
        }
    };
}

export function getLineStartOffset(lines: string[], lineIndex: number): number {
    let offset = 0;
    for (let index = 0; index < lineIndex; index++) {
        offset += lines[index].length + 1;
    }

    return offset;
}
