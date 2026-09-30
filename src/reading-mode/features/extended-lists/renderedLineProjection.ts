import {
    ExampleListData,
    FancyListData,
    HashListData,
    ParsedLine
} from './lineParser';
import { appendMathContent } from './mathContentRenderer';

interface DomBoundary {
    container: Node;
    offset: number;
}

interface LogicalLine {
    start: DomBoundary;
    end: DomBoundary;
}

export interface ProjectedLine {
    line: ParsedLine;
    range: Range;
    prefixLength: number;
}

export function projectRenderedLines(
    element: Element,
    entries: Array<{ line: string; index: number }>,
    parsedLines: ParsedLine[],
    firstListLine: number
): ProjectedLine[] | null {
    const boundaries = getRenderedLineBoundaries(element);
    const projected: ProjectedLine[] = [];

    for (let index = firstListLine; index < parsedLines.length; index++) {
        const entry = entries[index];
        const boundary = boundaries[entry.index];
        if (!boundary) {
            return null;
        }

        const line = parsedLines[index];
        const prefix = entry.line.slice(0, entry.line.length - getListItemContent(line).length);
        const range = document.createRange();
        range.setStart(boundary.start.container, boundary.start.offset);
        range.setEnd(boundary.end.container, boundary.end.offset);
        const preview = range.cloneContents();
        const previewText = preview.textContent ?? '';
        if (!prefix || !previewText.startsWith(prefix) ||
            (!previewText.slice(prefix.length).trim() && !preview.querySelector('*:not(br)'))) {
            return null;
        }

        projected.push({ line, range, prefixLength: prefix.length });
    }

    return projected;
}

export function getLogicalLineBoundary(element: Element, lineIndex: number): DomBoundary | null {
    if (lineIndex <= 0) {
        return { container: element, offset: 0 };
    }

    return getRenderedLineBoundaries(element)[lineIndex - 1]?.end ?? null;
}

export function extractRenderedLineContent(projected: ProjectedLine[]): Map<ParsedLine, DocumentFragment> {
    const contents = new Map<ParsedLine, DocumentFragment>();
    // Later extraction cannot shift the DOM offsets of earlier line ranges.
    for (let index = projected.length - 1; index >= 0; index--) {
        const { line, range, prefixLength } = projected[index];
        const fragment = range.extractContents();
        removeFirstTextPrefix(fragment, prefixLength);
        renderUnprocessedMath(fragment);
        contents.set(line, fragment);
    }
    return contents;
}

export function getListItemContent(parsedLine: ParsedLine): string {
    if (parsedLine.type === 'hash') {
        return (parsedLine.metadata as HashListData).content;
    }
    if (parsedLine.type === 'fancy') {
        return (parsedLine.metadata as FancyListData).content;
    }
    if (parsedLine.type === 'example') {
        return (parsedLine.metadata as ExampleListData).content;
    }
    return parsedLine.content;
}

function getRenderedLineBoundaries(element: Element): LogicalLine[] {
    const lines: LogicalLine[] = [];
    let start: DomBoundary = { container: element, offset: 0 };

    const visit = (node: Node): void => {
        if (node.nodeName === 'BR' && node.parentNode) {
            const offset = Array.from(node.parentNode.childNodes).indexOf(node);
            lines.push({ start, end: { container: node.parentNode, offset } });
            start = { container: node.parentNode, offset: offset + 1 };
        } else if (node.nodeType === Node.TEXT_NODE) {
            const value = node.textContent ?? '';
            for (let offset = 0; offset < value.length; offset++) {
                if (value[offset] === '\n') {
                    lines.push({ start, end: { container: node, offset } });
                    start = { container: node, offset: offset + 1 };
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE &&
            node.nodeName !== 'CODE' && node.nodeName !== 'PRE') {
            node.childNodes.forEach(visit);
        }
    };

    element.childNodes.forEach(visit);
    lines.push({ start, end: { container: element, offset: element.childNodes.length } });
    return lines;
}

function removeFirstTextPrefix(fragment: DocumentFragment, length: number): void {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    let remaining = length;
    while (remaining > 0 && walker.nextNode()) {
        const node = walker.currentNode as Text;
        const removed = Math.min(remaining, node.length);
        node.deleteData(0, removed);
        remaining -= removed;
    }
}

function renderUnprocessedMath(fragment: DocumentFragment): void {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const candidates: Text[] = [];
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.textContent?.includes('$') &&
            !node.parentElement?.closest('code, pre, .math, .cm-math, mjx-container')) {
            candidates.push(node);
        }
    }

    candidates.forEach(node => {
        const container = document.createElement('span');
        if (appendMathContent(container, node.textContent ?? '', text => {
            container.appendChild(document.createTextNode(text));
        })) {
            node.replaceWith(...Array.from(container.childNodes));
        }
    });
}
