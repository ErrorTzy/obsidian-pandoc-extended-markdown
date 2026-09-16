import { getPandocContainerContent } from './pandocListMarkers';
import { isPandocInlineTexCommand } from './pandocTexCommandNames';

/** A raw command block starts in column zero and contains complete commands. */
export function getRawTexCommandBlockEndIndex(lines: string[], index: number): number | null {
    const firstLine = getPandocContainerContent(lines[index] ?? '');
    if (!/^\\[A-Za-z]/.test(firstLine)) {
        return null;
    }
    const firstCommand = firstLine.match(/^\\([A-Za-z]+)/)?.[1] ?? '';
    if (isPandocInlineTexCommand(firstCommand)) {
        return null;
    }
    const firstLineEnd = commandSequenceEnd(firstLine);
    if (firstLineEnd !== null) {
        return index;
    }
    // The usual one-line command must not copy the rest of a large document.
    if (!/[{[<]/.test(firstLine)) {
        return null;
    }
    const source = lines.slice(index).map(getPandocContainerContent).join('\n');
    const end = commandSequenceEnd(source);
    return end === null ? null : index + source.slice(0, end).split('\n').length - 1;
}

function commandSequenceEnd(source: string): number | null {
    let cursor = 0;
    while (cursor < source.length) {
        const command = source.slice(cursor).match(/^\\([A-Za-z]+)\*?/);
        if (!command || isPandocInlineTexCommand(command[1]) ||
            command[1] === 'begin' || command[1] === 'end' || command[1] === 'and') {
            return null;
        }
        cursor += command[0].length;
        if (command[1] === 'let') {
            const assignment = source.slice(cursor).match(/^[ \t]*\\(?:[A-Za-z]+|.)[ \t]*=?[ \t]*(?:\\(?:[A-Za-z]+|.)|[^\s])/);
            if (!assignment) {
                return null;
            }
            cursor += assignment[0].length;
        }
        if (/^[egx]?def$/.test(command[1])) {
            while (cursor < source.length && source[cursor] !== '{' && source[cursor] !== '\n') {
                cursor++;
            }
        }
        cursor = skipHorizontalSpace(source, cursor);
        const dimension = source.slice(cursor).match(/^=?-?(?:\d+(?:\.\d*)?|\.\d+)(?:pt|pc|in|bp|cm|mm|dd|cc|sp|ex|em|mu|px)?(?=$|[^\w.])/);
        if (dimension) {
            cursor = skipHorizontalSpace(source, cursor + dimension[0].length);
        }
        while (source[cursor] === '[' || source[cursor] === '{' || source[cursor] === '<') {
            const end = argumentEnd(source, cursor);
            if (end === null) {
                return null;
            }
            if (source[cursor] === '<' &&
                /^[A-Za-z]+$/.test(source.slice(cursor + 1, end - 1)) &&
                !/^(?:beamer|presentation|trans|handout|article|second)$/.test(source.slice(cursor + 1, end - 1))) {
                return null;
            }
            cursor = skipHorizontalSpace(source, end);
        }
        if (cursor === source.length || source[cursor] === '\n') {
            return cursor;
        }
        if (source[cursor] !== '\\') {
            return null;
        }
    }
    return null;
}

function argumentEnd(source: string, start: number): number | null {
    const opening = source[start];
    const closing = opening === '[' ? ']' : opening === '<' ? '>' : '}';
    let depth = 1;
    for (let cursor = start + 1; cursor < source.length; cursor++) {
        if (source[cursor] === '\\') {
            cursor++;
        } else if (source[cursor] === '%') {
            const nextLine = source.indexOf('\n', cursor);
            if (nextLine < 0) {
                return null;
            }
            cursor = nextLine;
        } else if (source[cursor] === opening) {
            depth++;
        } else if (source[cursor] === closing && --depth === 0) {
            return cursor + 1;
        }
    }
    return null;
}

function skipHorizontalSpace(source: string, start: number): number {
    let cursor = start;
    while (source[cursor] === ' ' || source[cursor] === '\t') {
        cursor++;
    }
    return cursor;
}
