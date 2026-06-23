import { CSS_CLASSES, getFancyListClass } from '../../../core/constants';
import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { isStrictPandocFormatting } from '../../../editor-extensions/pandocValidator';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import { ValidationContext } from '../../../shared/types/listTypes';
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
import { getIndentColumns } from '../../../shared/utils/orderedListMarkers';

export function tryRenderSemanticListParagraph(
    elem: Element,
    context: ReadingModeContext,
    parser: ReadingModeParser,
    renderer: ReadingModeRenderer,
    text: string
): boolean {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const dataLines = resolveSourceDataLines(lines, context);
    const parsedLines = parser.parseLines(lines, true, true, context.config, dataLines);

    applyStrictFancyValidation(parsedLines, lines, context);

    if (!isSemanticListBlock(parsedLines)) {
        return false;
    }

    const rendered = groupListLines(parsedLines)
        .flatMap(group => renderSemanticList(group, context, renderer));

    if (elem.parentNode) {
        elem.replaceWith(...rendered);
    } else {
        elem.replaceChildren(...rendered);
    }
    return true;
}

function applyStrictFancyValidation(
    parsedLines: ParsedLine[],
    lines: string[],
    context: ReadingModeContext
): void {
    if (!context.config.enforcePandocListSpacing) {
        return;
    }

    parsedLines.forEach((parsedLine, index) => {
        if (parsedLine.type === 'fancy' &&
            context.validationLines.length > 0 &&
            !validateListInStrictMode(lines[index], context.validationLines, context.config)) {
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

function validateListInStrictMode(
    line: string,
    documentLines: string[],
    config: ProcessorConfig
): boolean {
    let lineNum = -1;
    for (let index = 0; index < documentLines.length; index++) {
        if (documentLines[index].includes(line.trim())) {
            lineNum = index;
            break;
        }
    }

    if (lineNum < 0) {
        return true;
    }

    const validationContext: ValidationContext = {
        lines: documentLines,
        currentLine: lineNum
    };

    return isStrictPandocFormatting(validationContext, config.enforcePandocListSpacing);
}

function isSemanticListBlock(parsedLines: ParsedLine[]): boolean {
    return parsedLines.length > 0 &&
        parsedLines.every(line => line.content.trim().length > 0) &&
        parsedLines.every(line => isListLine(line));
}

function isListLine(parsedLine: ParsedLine): boolean {
    return parsedLine.type === 'hash' ||
        parsedLine.type === 'fancy' ||
        parsedLine.type === 'example';
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

function resolveSourceDataLines(
    lines: string[],
    context: ReadingModeContext
): Array<number | undefined> {
    const sectionInfo = context.sectionInfo;
    if (!sectionInfo?.text) {
        return lines.map(() => undefined);
    }

    const sourceLines = sectionInfo.text.split('\n');
    const startLine = Math.max(0, sectionInfo.lineStart);
    const endLine = Math.min(sourceLines.length - 1, sectionInfo.lineEnd);
    const dataLines: Array<number | undefined> = [];
    let sourceIndex = startLine;

    for (const line of lines) {
        const normalizedLine = line.trim();
        while (
            sourceIndex <= endLine &&
            sourceLines[sourceIndex].trim() !== normalizedLine
        ) {
            sourceIndex++;
        }

        if (sourceIndex > endLine) {
            dataLines.push(undefined);
            continue;
        }

        dataLines.push(sourceIndex - startLine);
        sourceIndex++;
    }

    return dataLines;
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
