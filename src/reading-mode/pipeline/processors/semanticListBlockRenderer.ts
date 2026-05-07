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
} from '../../parsers/parser';
import { ReadingModeRenderer } from '../../renderer';
import { ReadingModeContext } from '../types';

export function tryRenderSemanticListParagraph(
    elem: Element,
    context: ReadingModeContext,
    parser: ReadingModeParser,
    renderer: ReadingModeRenderer,
    text: string
): boolean {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const parsedLines = parser.parseLines(lines, true, true, context.config);

    applyStrictFancyValidation(parsedLines, lines, context);

    if (!isSemanticListBlock(parsedLines)) {
        return false;
    }

    const rendered = groupListLines(parsedLines)
        .map(group => renderSemanticList(group, context, renderer));

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
    if (!context.config.strictPandocMode) {
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
): HTMLOListElement {
    const list = document.createElement('ol');
    const firstLine = parsedLines[0];

    configureListElement(list, firstLine);

    parsedLines.forEach(parsedLine => {
        const item = document.createElement('li');
        const content = getListItemContent(parsedLine);

        updateCountersForListItem(item, parsedLine, context);
        renderer.appendContent(item, content.trimStart(), context.renderContext);
        list.appendChild(item);
    });

    return list;
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

    return isStrictPandocFormatting(validationContext, config.strictPandocMode);
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
        if (current && getListGroupKey(current[0]) === getListGroupKey(parsedLine)) {
            current.push(parsedLine);
            return;
        }

        groups.push([parsedLine]);
    });

    return groups;
}

function getListGroupKey(parsedLine: ParsedLine): string {
    if (parsedLine.type === 'fancy') {
        const data = parsedLine.metadata as FancyListData;
        return `${parsedLine.type}:${data.type}`;
    }

    return parsedLine.type;
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

function getOrderedListTypeAttribute(type: string): string | null {
    switch (type) {
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
