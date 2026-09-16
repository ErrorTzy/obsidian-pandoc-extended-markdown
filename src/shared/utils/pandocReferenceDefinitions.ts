import { getPandocContainerContent } from './pandocListMarkers';

/**
 * Recognize the complete referenceKey production, not just `[label]:`.
 * Pandoc accepts a destination, title, and attributes on separate lines, but
 * any unconsumed text after a recognized title/attribute invalidates the key.
 */
export function getReferenceDefinitionEndIndex(
    lines: string[],
    startIndex: number
): number | null {
    const firstLine = getPandocContainerContent(lines[startIndex] ?? '');
    const labelStart = firstLine.match(/^ {0,3}(?=\[)/)?.[0].length;
    if (labelStart === undefined || firstLine[labelStart + 1] === '^') {
        return null;
    }
    const labelEnd = balancedEnd(firstLine, labelStart, '[', ']');
    if (labelEnd === null || firstLine[labelEnd] !== ':') {
        return null;
    }
    const source = collectReferenceSource(lines, startIndex);
    let cursor = skipOptionalNewline(source, labelEnd + 1);
    if (source[cursor] === '[') {
        return null;
    }
    cursor = destinationEnd(source, cursor);
    if (cursor < 0) {
        return null;
    }
    const titleStart = skipOptionalNewline(source, cursor);
    const titleEnd = referenceTitleEnd(source, titleStart);
    if (titleEnd !== null) {
        cursor = titleEnd;
    }
    const attributeStart = skipOptionalNewline(source, cursor);
    if (source[attributeStart] === '{') {
        const attributeEnd = balancedEnd(source, attributeStart, '{', '}');
        if (attributeEnd !== null) {
            cursor = attributeEnd;
        }
    }
    cursor = skipHorizontalSpace(source, cursor);
    if (cursor < source.length && source[cursor] !== '\n') {
        return null;
    }
    return startIndex + source.slice(0, cursor).split('\n').length - 1;
}

function collectReferenceSource(lines: string[], startIndex: number): string {
    const candidates: string[] = [];
    for (let index = startIndex; index < lines.length; index++) {
        const content = getPandocContainerContent(lines[index]);
        if (index > startIndex && /^[ \t]*$/.test(content)) {
            break;
        }
        candidates.push(content);
    }
    return candidates.join('\n');
}

function destinationEnd(source: string, start: number): number {
    if (source[start] === '<') {
        return balancedEnd(source, start, '<', '>') ?? -1;
    }
    let cursor = start;
    while (cursor < source.length && source[cursor] !== '\n') {
        const tokenStart = skipHorizontalSpace(source, cursor);
        if (source[tokenStart] === '\n' || tokenStart === source.length) {
            return cursor;
        }
        if (referenceTitleEnd(source, tokenStart) !== null ||
            (source[tokenStart] === '{' && balancedEnd(source, tokenStart, '{', '}') !== null) ||
            source[tokenStart] === '[') {
            return cursor;
        }
        cursor = tokenStart;
        while (cursor < source.length && !/[ \t\n]/.test(source[cursor])) {
            cursor += source[cursor] === '\\' && cursor + 1 < source.length ? 2 : 1;
        }
    }
    return cursor;
}

function referenceTitleEnd(source: string, start: number): number | null {
    const opening = source[start];
    if (opening === '(') {
        return balancedEnd(source, start, '(', ')');
    }
    if (opening !== '"' && opening !== "'") {
        return null;
    }
    for (let cursor = start + 1; cursor < source.length; cursor++) {
        if (source[cursor] === '\\') {
            cursor++;
        } else if (source[cursor] === opening && !/[\p{L}\p{N}]/u.test(source[cursor + 1] ?? '')) {
            return cursor + 1;
        }
    }
    return null;
}

function balancedEnd(source: string, start: number, opening: string, closing: string): number | null {
    let depth = 0;
    for (let cursor = start; cursor < source.length; cursor++) {
        if (source[cursor] === '\\') {
            cursor++;
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

function skipOptionalNewline(source: string, start: number): number {
    const cursor = skipHorizontalSpace(source, start);
    return source[cursor] === '\n' ? skipHorizontalSpace(source, cursor + 1) : cursor;
}
