import { INDENTATION } from '../../core/constants';

export type StandardListMarkerKind = 'ordered' | 'unordered';

export interface ParsedStandardListItem {
    kind: StandardListMarkerKind;
    indent: string;
    indentColumns: number;
    marker: string;
    spaces: string;
    content: string;
    lineIndex?: number;
    lineText?: string;
}

const STANDARD_LIST_ITEM = /^(\s*)((?:\d+|[A-Za-z]+)[.)]|[-+*])(\s*)(.*)$/;
const ORDERED_MARKER = /^(?:\d+|[A-Za-z]+)[.)]$/;

export function getListIndentColumns(indent: string): number {
    return Array.from(indent).reduce((columns, character) => {
        return columns + (character === INDENTATION.TAB ? INDENTATION.TAB_SIZE : 1);
    }, 0);
}

export function parseStandardListItem(line: string): ParsedStandardListItem | null {
    const match = line.match(STANDARD_LIST_ITEM);
    if (!match) {
        return null;
    }

    const [, indent, marker, spaces, content] = match;
    if (spaces.length === 0 && content.length > 0) {
        return null;
    }

    return {
        kind: ORDERED_MARKER.test(marker) ? 'ordered' : 'unordered',
        indent,
        indentColumns: getListIndentColumns(indent),
        marker,
        spaces,
        content
    };
}
