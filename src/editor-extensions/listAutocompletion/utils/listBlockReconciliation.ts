import {
    EditorState,
    Extension,
    Text,
    TransactionSpec
} from '@codemirror/state';

export interface LineRange {
    startIndex: number;
    endIndex: number;
}

interface PendingListBlockReconciliation {
    expectedLines: string[];
    range: LineRange;
}

let pendingListBlockReconciliation: PendingListBlockReconciliation | null = null;

export function buildExpectedMovedDocumentLines(
    lines: string[],
    startIndex: number,
    endIndex: number,
    replacementLines: string[]
): string[] {
    const expectedLines = [...lines];
    expectedLines.splice(startIndex, endIndex - startIndex + 1, ...replacementLines);
    return expectedLines;
}

export function setPendingListBlockReconciliation(
    expectedLines: string[],
    range: LineRange
): void {
    pendingListBlockReconciliation = { expectedLines, range };
}

export function createListBlockReconciliationExtension(): Extension {
    return EditorState.transactionFilter.of((transaction) => {
        const pending = pendingListBlockReconciliation;
        if (!pending) {
            return transaction;
        }

        pendingListBlockReconciliation = null;
        const repairSpec = buildListBlockRepairSpec(
            transaction,
            pending.expectedLines,
            pending.range
        );

        return repairSpec ? [transaction, repairSpec] : transaction;
    });
}

function buildListBlockRepairSpec(
    transaction: { newDoc: Text },
    expectedLines: string[],
    range: LineRange
): TransactionSpec | null {
    const currentLines = transaction.newDoc.toString().split('\n');

    if (currentLines.length !== expectedLines.length) {
        return null;
    }

    const changes: Array<{ from: number; to: number; insert: string }> = [];
    for (let index = range.startIndex; index <= range.endIndex; index++) {
        if (currentLines[index] === expectedLines[index]) {
            continue;
        }

        const line = transaction.newDoc.line(index + 1);
        changes.push({
            from: line.from,
            to: line.to,
            insert: expectedLines[index]
        });
    }

    if (changes.length === 0) {
        return null;
    }

    return {
        changes,
        sequential: true
    };
}
