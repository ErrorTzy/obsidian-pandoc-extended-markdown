import { EditorView } from '@codemirror/view';
import { Text } from '@codemirror/state';
import { NUMERIC_CONSTANTS } from '../../core/constants';
import { ListPatterns } from '../patterns';
import {
    ParsedOrderedListMarker,
    formatOrderedListMarker,
    getIndentColumns,
    parseOrderedListMarker
} from './orderedListMarkers';

interface ListBlockBoundaries {
    blockStart: number;
    blockEnd: number;
    insertedIndent: string;
}

interface RenumberableListItem {
    lineNum: number;
    spaces: string;
    content: string;
    ordered: ParsedOrderedListMarker | null;
    hashMarker: string | null;
}

function getLineIndent(line: string): string {
    return line.match(ListPatterns.INDENT_ONLY)?.[1] ?? '';
}

function parseHashListMarker(line: string): RegExpMatchArray | null {
    return line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST_WITH_CONTENT)?.[2] === '#'
        ? line.match(ListPatterns.LETTER_OR_ROMAN_OR_HASH_LIST_WITH_CONTENT)
        : null;
}

function isListLineAtOrBelowIndent(line: string, indentColumns: number): boolean {
    const ordered = parseOrderedListMarker(line);
    if (ordered) {
        return ordered.indentColumns >= indentColumns;
    }

    const hashMatch = parseHashListMarker(line);
    return hashMatch
        ? getIndentColumns(hashMatch[1]) >= indentColumns
        : false;
}

function isIndentedContinuation(line: string, indentColumns: number): boolean {
    return getIndentColumns(getLineIndent(line)) > indentColumns;
}

function findBlockBoundaries(allLines: string[], insertedLineNum: number): ListBlockBoundaries {
    let blockStart = insertedLineNum;
    let blockEnd = insertedLineNum;
    const insertedIndent = getLineIndent(allLines[insertedLineNum]);
    const insertedIndentColumns = getIndentColumns(insertedIndent);

    for (let index = insertedLineNum - 1; index >= NUMERIC_CONSTANTS.MIN_DOC_POSITION; index--) {
        if (!allLines[index].trim()) {
            continue;
        }

        if (!isListLineAtOrBelowIndent(allLines[index], insertedIndentColumns)) {
            if (isIndentedContinuation(allLines[index], insertedIndentColumns)) {
                continue;
            }
            break;
        }

        if (getIndentColumns(getLineIndent(allLines[index])) === insertedIndentColumns) {
            blockStart = index;
        }
    }

    for (let index = insertedLineNum + 1; index < allLines.length; index++) {
        if (!allLines[index].trim()) {
            continue;
        }

        if (!isListLineAtOrBelowIndent(allLines[index], insertedIndentColumns)) {
            if (isIndentedContinuation(allLines[index], insertedIndentColumns)) {
                continue;
            }
            break;
        }

        if (getIndentColumns(getLineIndent(allLines[index])) === insertedIndentColumns) {
            blockEnd = index;
        }
    }

    return { blockStart, blockEnd, insertedIndent };
}

function collectListItems(allLines: string[], boundaries: ListBlockBoundaries): RenumberableListItem[] {
    const listItems: RenumberableListItem[] = [];
    const insertedIndentColumns = getIndentColumns(boundaries.insertedIndent);

    for (let index = boundaries.blockStart; index <= boundaries.blockEnd; index++) {
        const ordered = parseOrderedListMarker(allLines[index], allLines, index);
        if (ordered?.indentColumns === insertedIndentColumns) {
            listItems.push(createOrderedItem(index, ordered));
            continue;
        }

        const hashMatch = parseHashListMarker(allLines[index]);
        if (hashMatch && getIndentColumns(hashMatch[1]) === insertedIndentColumns) {
            listItems.push(createHashItem(index, hashMatch));
        }
    }

    return listItems;
}

function createOrderedItem(lineNum: number, ordered: ParsedOrderedListMarker): RenumberableListItem {
    return {
        lineNum,
        spaces: ordered.spaces,
        content: ordered.content,
        ordered,
        hashMarker: null
    };
}

function createHashItem(lineNum: number, match: RegExpMatchArray): RenumberableListItem {
    return {
        lineNum,
        spaces: match[4],
        content: match[5],
        ordered: null,
        hashMarker: '#.'
    };
}

function getNewMarker(item: RenumberableListItem, itemIndex: number): string {
    if (item.hashMarker) {
        return item.hashMarker;
    }

    if (!item.ordered) {
        return '';
    }

    return formatOrderedListMarker(item.ordered.style, itemIndex + 1);
}

function applyNumberingChanges(
    view: EditorView,
    listItems: RenumberableListItem[],
    insertedIndent: string
): void {
    const state = view.state;
    const doc = state.doc;
    const allLines = doc.toString().split('\n');
    const changes: Array<{from: number, to: number, insert: string}> = [];

    for (let index = NUMERIC_CONSTANTS.FIRST_INDEX; index < listItems.length; index++) {
        const item = listItems[index];
        const newLine = `${insertedIndent}${getNewMarker(item, index)}${item.spaces}${item.content}`;

        if (item.ordered) {
            changes.push(...getLineChange(doc, allLines, item.lineNum, newLine));
        }
    }

    if (changes.length > NUMERIC_CONSTANTS.EMPTY_LENGTH) {
        view.dispatch(state.update({ changes }));
    }
}

function getLineChange(
    doc: Text,
    allLines: string[],
    lineNum: number,
    newLine: string
): Array<{from: number, to: number, insert: string}> {
    if (newLine === allLines[lineNum]) {
        return [];
    }

    const line = doc.line(lineNum + 1);
    return [{ from: line.from, to: line.to, insert: newLine }];
}

export function renumberListItems(view: EditorView, insertedLineNum: number): void {
    const allLines = view.state.doc.toString().split('\n');
    const boundaries = findBlockBoundaries(allLines, insertedLineNum);
    const listItems = collectListItems(allLines, boundaries);

    if (listItems.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER) {
        applyNumberingChanges(view, listItems, boundaries.insertedIndent);
    }
}
