import { INDENTATION } from '../../core/constants';

export type StandardListMarkerKind = 'ordered' | 'unordered';
export type TaskState = 'unchecked' | 'checked' | null;

export interface ParsedStandardListItem {
    kind: StandardListMarkerKind;
    indent: string;
    indentColumns: number;
    marker: string;
    spaces: string;
    content: string;
    taskState: TaskState;
    lineIndex?: number;
    lineText?: string;
}

const STANDARD_LIST_ITEM = /^(\s*)((?:\d+|[A-Za-z]+)[.)]|[-+*])(\s*)(.*)$/;
const ORDERED_MARKER = /^(?:\d+|[A-Za-z]+)[.)]$/;
const TASK_CHECKBOX_PREFIX = /^(\s+)\[([ xX])\](?:(\s+)(.*))?$/;

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

    const taskPrefix = parseTaskCheckboxPrefix(spaces, content);

    return {
        kind: ORDERED_MARKER.test(marker) ? 'ordered' : 'unordered',
        indent,
        indentColumns: getListIndentColumns(indent),
        marker,
        spaces: taskPrefix?.spaces ?? spaces,
        content: taskPrefix?.content ?? content,
        taskState: taskPrefix?.taskState ?? null
    };
}

export function parseTaskCheckboxPrefix(
    markerSpaces: string,
    content: string
): { spaces: string; content: string; taskState: Exclude<TaskState, null> } | null {
    const match = `${markerSpaces}${content}`.match(TASK_CHECKBOX_PREFIX);
    if (!match) {
        return null;
    }

    const taskState = match[2].toLowerCase() === 'x' ? 'checked' : 'unchecked';
    return {
        spaces: `${match[1]}[${taskState === 'checked' ? 'x' : ' '}]${match[3] ?? ''}`,
        content: match[4] ?? '',
        taskState
    };
}
