import { CSS_CLASSES, getFancyListClass } from '../../../core/constants';
import { pluginStateManager } from '../../../core/state/pluginStateManager';
import {
    ExampleListData,
    FancyListData,
    HashListData,
    ParsedLine,
    ReadingModeParser
} from './lineParser';
import { ReadingModeRenderer } from './lineRenderer';
import { appendExtendedListItemContent } from './taskListItem';

import { ReadingModeContext } from '../../pipeline/types';
import {
    findSourceItemSubtreeEnd,
    parseNativeListLine
} from '../native-lists/sourceLine';
import { getIndentColumns } from '../../../shared/utils/orderedListMarkers';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';

export function tryRenderSemanticListParagraph(
    elem: Element,
    context: ReadingModeContext,
    parser: ReadingModeParser,
    renderer: ReadingModeRenderer,
    text: string,
    sourceDataLines?: Array<number | undefined>,
    invalidListLines?: Set<number>
): boolean {
    const sourceEntries = text.split('\n')
        .map((line, index) => ({ line, index }))
        .filter(entry => entry.line.trim().length > 0);
    const lines = sourceEntries.map(entry => entry.line);
    const dataLines = sourceDataLines
        ? sourceEntries.map(entry => sourceDataLines[entry.index])
        : resolveSourceDataLines(lines, context, elem);
    const parsedLines = parser.parseLines(lines, true, true, context.config, dataLines);

    applyPandocListValidation(parsedLines, context, invalidListLines);
    makeRenderedDataLinesSectionRelative(parsedLines, elem, context);

    const firstListLine = parsedLines.findIndex(isListLine);
    if (firstListLine < 0 || !isSemanticListSuffix(parsedLines, firstListLine)) {
        return false;
    }

    const rendered = groupListLines(parsedLines.slice(firstListLine))
        .flatMap(group => renderSemanticList(group, context, renderer));

    if (firstListLine > 0) {
        return replaceTrailingSourceLinesWithLists(
            elem,
            sourceEntries[firstListLine].index,
            rendered
        );
    }

    if (elem.parentNode) {
        elem.replaceWith(...rendered);
    } else {
        elem.replaceChildren(...rendered);
    }
    return true;
}

function makeRenderedDataLinesSectionRelative(
    parsedLines: ParsedLine[],
    element: Element,
    context: ReadingModeContext
): void {
    const sectionStart = context.postProcessorContext.getSectionInfo?.(element)?.lineStart ??
        context.sectionInfo?.lineStart ??
        0;
    if (sectionStart <= 0) {
        return;
    }

    parsedLines.forEach(line => {
        if (line.dataLine !== undefined && line.dataLine >= sectionStart) {
            line.dataLine -= sectionStart;
        }
    });
}

function applyPandocListValidation(
    parsedLines: ParsedLine[],
    context: ReadingModeContext,
    knownInvalidListLines?: Set<number>
): void {
    const invalidListLines = knownInvalidListLines ??
        ListBlockValidator.validateListBlocks(context.validationLines, {
            enableListsWithoutPrecedingBlankline:
                context.config.enableListsWithoutPrecedingBlankline
        });
    parsedLines.forEach((parsedLine, index) => {
        if (isListLine(parsedLine) &&
            context.validationLines.length > 0 &&
            (parsedLine.dataLine === undefined || invalidListLines.has(parsedLine.dataLine))) {
            parsedLine.type = 'plain';
        }
    });
}

function renderSemanticList(
    parsedLines: ParsedLine[],
    context: ReadingModeContext,
    renderer: ReadingModeRenderer
): HTMLOListElement[] {
    if (parsedLines.some(line => line.type === 'fancy') && hasNestedIndent(parsedLines)) {
        return renderNestedFancyLists(parsedLines, context, renderer);
    }

    const list = document.createElement('ol');
    const firstLine = parsedLines[0];

    configureListElement(list, firstLine);

    parsedLines.forEach(parsedLine => {
        const item = document.createElement('li');
        updateCountersForListItem(item, parsedLine, context);
        appendExtendedListItemContent(
            item,
            getRenderedTaskItem(parsedLine),
            renderer,
            context.renderContext
        );
        list.appendChild(item);
    });

    return [list];
}

interface RenderedListFrame {
    indentColumns: number;
    typeKey: string;
    list: HTMLOListElement;
    lastItem?: HTMLLIElement;
}

function renderNestedFancyLists(
    parsedLines: ParsedLine[],
    context: ReadingModeContext,
    renderer: ReadingModeRenderer
): HTMLOListElement[] {
    const roots: HTMLOListElement[] = [];
    const stack: RenderedListFrame[] = [];

    parsedLines.forEach(parsedLine => {
        const indentColumns = getParsedLineIndentColumns(parsedLine);
        const typeKey = getNestedListFrameKey(parsedLine);

        while (stack.length > 0 && stack[stack.length - 1].indentColumns > indentColumns) {
            stack.pop();
        }

        let frame = stack[stack.length - 1];
        if (!frame || frame.indentColumns < indentColumns || frame.typeKey !== typeKey) {
            const list = document.createElement('ol');
            configureListElement(list, parsedLine);

            if (frame?.lastItem && frame.indentColumns < indentColumns) {
                frame.lastItem.appendChild(list);
            } else {
                roots.push(list);
                stack.length = 0;
            }

            frame = { indentColumns, typeKey, list };
            stack.push(frame);
        }

        const item = document.createElement('li');
        updateCountersForListItem(item, parsedLine, context);
        appendExtendedListItemContent(
            item,
            getRenderedTaskItem(parsedLine),
            renderer,
            context.renderContext
        );
        frame.list.appendChild(item);
        frame.lastItem = item;
    });

    return roots;
}

function hasNestedIndent(parsedLines: ParsedLine[]): boolean {
    const indents = parsedLines.map(getParsedLineIndentColumns);
    return indents.some(indent => indent !== indents[0]);
}

function getParsedLineIndentColumns(parsedLine: ParsedLine): number {
    if (parsedLine.type === 'hash') {
        return getIndentColumns((parsedLine.metadata as HashListData).indent);
    }

    if (parsedLine.type === 'fancy') {
        return getIndentColumns((parsedLine.metadata as FancyListData).indent);
    }

    if (parsedLine.type === 'example') {
        return getIndentColumns((parsedLine.metadata as ExampleListData).indent);
    }

    return 0;
}

function configureListElement(list: HTMLOListElement, firstLine: ParsedLine): void {
    if (firstLine.type === 'example') {
        list.classList.add('example', CSS_CLASSES.EXAMPLE_LIST);
        list.setAttribute('type', '1');
        return;
    }

    if (firstLine.type !== 'fancy') {
        return;
    }

    const data = firstLine.metadata as FancyListData;
    list.classList.add(getFancyListClass(data.type));

    const typeAttribute = getOrderedListTypeAttribute(data.type);
    if (typeAttribute) {
        list.setAttribute('type', typeAttribute);
    }

    const start = getFancyListStart(data);
    if (start !== 1) {
        list.setAttribute('start', String(start));
    }

    if (data.marker.endsWith(')')) {
        list.classList.add(CSS_CLASSES.FANCY_LIST_PAREN);
    }
}

function updateCountersForListItem(
    item: HTMLLIElement,
    parsedLine: ParsedLine,
    context: ReadingModeContext
): void {
    if (parsedLine.type === 'hash') {
        pluginStateManager.incrementHashCounter(context.sourcePath);
        return;
    }

    if (parsedLine.type !== 'example') {
        return;
    }

    const data = parsedLine.metadata as ExampleListData;
    const number = pluginStateManager.incrementExampleCounter(context.sourcePath);
    item.classList.add(CSS_CLASSES.EXAMPLE_ITEM);
    item.setAttribute('data-example-number', String(number));

    if (data.label) {
        pluginStateManager.setLabeledExample(
            context.sourcePath,
            data.label,
            number,
            data.content?.trim()
        );
    }
}

function isSemanticListSuffix(parsedLines: ParsedLine[], startIndex: number): boolean {
    return parsedLines.slice(startIndex).every(line =>
        line.content.trim().length > 0 && isListLine(line)
    );
}

function isListLine(parsedLine: ParsedLine): boolean {
    return parsedLine.type === 'hash' ||
        parsedLine.type === 'fancy' ||
        parsedLine.type === 'example';
}

function replaceTrailingSourceLinesWithLists(
    element: Element,
    firstListLine: number,
    lists: HTMLOListElement[]
): boolean {
    const boundary = findLogicalLineBoundary(element, firstListLine);
    if (!boundary) {
        return false;
    }
    if (!element.instanceOf(HTMLLIElement) && !element.parentNode) {
        return false;
    }

    const range = document.createRange();
    range.setStart(boundary.container, boundary.offset);
    range.setEnd(element, element.childNodes.length);
    range.deleteContents();

    if (element.instanceOf(HTMLLIElement)) {
        element.append(...lists);
        return true;
    }

    element.after(...lists);
    return true;
}

interface DomBoundary {
    container: Node;
    offset: number;
}

function findLogicalLineBoundary(
    element: Element,
    targetLine: number
): DomBoundary | null {
    if (targetLine <= 0) {
        return { container: element, offset: 0 };
    }

    let linesRemaining = targetLine;
    let boundary: DomBoundary | null = null;

    const visit = (node: Node): void => {
        if (boundary) {
            return;
        }

        if (node.nodeName === 'BR') {
            linesRemaining--;
            if (linesRemaining === 0 && node.parentNode) {
                boundary = {
                    container: node.parentNode,
                    offset: Array.from(node.parentNode.childNodes).indexOf(node)
                };
            }
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? '';
            for (let index = 0; index < text.length; index++) {
                if (text[index] !== '\n') {
                    continue;
                }
                linesRemaining--;
                if (linesRemaining === 0) {
                    boundary = { container: node, offset: index };
                    return;
                }
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE ||
            node.nodeName === 'CODE' || node.nodeName === 'PRE') {
            return;
        }

        node.childNodes.forEach(visit);
    };

    element.childNodes.forEach(visit);
    return boundary;
}

function groupListLines(parsedLines: ParsedLine[]): ParsedLine[][] {
    const groups: ParsedLine[][] = [];

    parsedLines.forEach(parsedLine => {
        const current = groups[groups.length - 1];
        if (current && canShareListGroup(current[current.length - 1], parsedLine)) {
            current.push(parsedLine);
            return;
        }

        groups.push([parsedLine]);
    });

    return groups;
}

function canShareListGroup(previous: ParsedLine, current: ParsedLine): boolean {
    if (previous.type === 'fancy' && current.type === 'fancy') {
        return getParsedLineIndentColumns(previous) !== getParsedLineIndentColumns(current) ||
            getNestedListFrameKey(previous) === getNestedListFrameKey(current);
    }

    return getListGroupKey(previous) === getListGroupKey(current);
}

function getListGroupKey(parsedLine: ParsedLine): string {
    if (parsedLine.type === 'fancy') {
        return parsedLine.type;
    }

    return parsedLine.type;
}

function getNestedListFrameKey(parsedLine: ParsedLine): string {
    if (parsedLine.type === 'fancy') {
        const data = parsedLine.metadata as FancyListData;
        return `${parsedLine.type}:${data.type}:${data.marker.endsWith(')') ? ')' : '.'}`;
    }

    return getListGroupKey(parsedLine);
}

function getListItemContent(parsedLine: ParsedLine): string {
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

function getRenderedTaskItem(parsedLine: ParsedLine): {
    taskState: HashListData['taskState'];
    taskCharacter?: HashListData['taskCharacter'];
    dataLine?: number;
    content: string;
} {
    const data = parsedLine.metadata as HashListData | FancyListData | ExampleListData;
    return {
        taskState: data.taskState,
        taskCharacter: data.taskCharacter,
        dataLine: parsedLine.dataLine,
        content: getListItemContent(parsedLine)
    };
}

export function resolveSourceDataLines(
    lines: string[],
    context: ReadingModeContext,
    element?: Element,
    minimumSourceLine: number = 0,
    knownCandidateListLines?: Set<number>
): Array<number | undefined> {
    if (context.validationLines.length === 0) {
        return lines.map(() => undefined);
    }

    const sourceLines = context.validationLines;
    const candidateListLines = knownCandidateListLines ??
        ListBlockValidator.getListMarkerCandidateLines(sourceLines, {
            enableListsWithoutPrecedingBlankline:
                context.config.enableListsWithoutPrecedingBlankline
        });
    const bounds = getElementSourceBounds(element, context, sourceLines.length);
    const startLine = Math.max(bounds.startLine, minimumSourceLine);
    const endLine = getCandidateSourceEndLine(
        element,
        sourceLines,
        startLine,
        bounds.endLine
    );
    const dataLines: Array<number | undefined> = [];
    let sourceIndex = startLine;

    for (const line of lines) {
        let matchIndex = sourceIndex;
        while (
            matchIndex <= endLine &&
            !sourceLinesCorrespond(
                line,
                sourceLines[matchIndex],
                matchIndex,
                candidateListLines
            )
        ) {
            matchIndex++;
        }

        if (matchIndex > endLine) {
            dataLines.push(undefined);
            continue;
        }

        dataLines.push(matchIndex);
        sourceIndex = matchIndex + 1;
    }

    return dataLines;
}

function getCandidateSourceEndLine(
    element: Element | undefined,
    sourceLines: string[],
    startLine: number,
    reportedEndLine: number
): number {
    if (!element?.instanceOf(HTMLLIElement)) {
        return reportedEndLine;
    }

    const owner = parseNativeListLine(sourceLines[startLine] ?? '');
    if (!owner) {
        return reportedEndLine >= startLine
            ? reportedEndLine
            : sourceLines.length - 1;
    }

    return Math.max(
        reportedEndLine,
        findSourceItemSubtreeEnd(startLine, owner.indentColumns, sourceLines)
    );
}

function getElementSourceBounds(
    element: Element | undefined,
    context: ReadingModeContext,
    sourceLineCount: number
): { startLine: number; endLine: number } {
    const fallback = { startLine: 0, endLine: sourceLineCount - 1 };
    if (!element || !context.sectionInfo) {
        return fallback;
    }

    const elementInfo = context.postProcessorContext.getSectionInfo?.(element);
    if (!elementInfo) {
        return fallback;
    }

    const absoluteBounds = {
        startLine: elementInfo.lineStart,
        endLine: elementInfo.lineEnd
    };
    if (areValidSourceBounds(absoluteBounds, sourceLineCount)) {
        return absoluteBounds;
    }

    const sectionRelativeBounds = {
        startLine: elementInfo.lineStart - context.sectionInfo.lineStart,
        endLine: elementInfo.lineEnd - context.sectionInfo.lineStart
    };
    return areValidSourceBounds(sectionRelativeBounds, sourceLineCount)
        ? sectionRelativeBounds
        : fallback;
}

function areValidSourceBounds(
    bounds: { startLine: number; endLine: number },
    sourceLineCount: number
): boolean {
    return bounds.startLine >= 0 &&
        bounds.endLine >= bounds.startLine &&
        bounds.endLine < sourceLineCount;
}

function sourceLinesCorrespond(
    renderedLine: string,
    sourceLine: string,
    sourceIndex: number,
    candidateListLines: Set<number>
): boolean {
    const renderedMarker = parsePandocListMarker(renderedLine, true);
    const sourceMarker = parsePandocListMarker(sourceLine, true);
    if (!renderedMarker && !sourceMarker) {
        return renderedLine.trim() === sourceLine.trim();
    }
    if (!renderedMarker || !sourceMarker || renderedMarker.kind !== sourceMarker.kind) {
        return false;
    }
    if (!candidateListLines.has(sourceIndex)) {
        return false;
    }

    const renderedMarkerText = renderedLine.slice(
        renderedMarker.markerStart,
        renderedMarker.markerEnd
    );
    const sourceMarkerText = sourceLine.slice(sourceMarker.markerStart, sourceMarker.markerEnd);
    return renderedMarkerText === sourceMarkerText &&
        renderedMarker.orderedGroup === sourceMarker.orderedGroup;
}

function getOrderedListTypeAttribute(type: string): string | null {
    switch (type) {
        case 'decimal':
            return '1';
        case 'upper-alpha':
            return 'A';
        case 'lower-alpha':
            return 'a';
        case 'upper-roman':
            return 'I';
        case 'lower-roman':
            return 'i';
        default:
            return null;
    }
}

function getFancyListStart(data: FancyListData): number {
    const value = data.marker.slice(0, -1);

    if (data.type === 'upper-alpha' || data.type === 'lower-alpha') {
        return alphaToDecimal(value);
    }

    if (data.type === 'upper-roman' || data.type === 'lower-roman') {
        return romanToDecimal(value);
    }

    return 1;
}

function alphaToDecimal(value: string): number {
    return value.toLowerCase().split('').reduce((total, char) =>
        total * 26 + char.charCodeAt(0) - 'a'.charCodeAt(0) + 1,
    0);
}

function romanToDecimal(value: string): number {
    const romanNumerals: Record<string, number> = {
        i: 1,
        v: 5,
        x: 10,
        l: 50,
        c: 100,
        d: 500,
        m: 1000
    };

    return value.toLowerCase().split('').reduce((total, char, index, chars) => {
        const current = romanNumerals[char] ?? 0;
        const next = romanNumerals[chars[index + 1]] ?? 0;
        return current < next ? total - current : total + current;
    }, 0);
}
