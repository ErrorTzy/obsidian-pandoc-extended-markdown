import { CSS_CLASSES } from '../core/constants';

import type { ParsedLine, DefinitionData } from './parsers/parser';
import type { RenderContext } from './renderer';

type ContentAppender = (element: HTMLElement, content: string, context: RenderContext) => void;

interface RenderedDefinition {
    element: HTMLElement;
    nextIndex: number;
}

interface ListItemContent {
    ordered: boolean;
    content: string;
    checked?: boolean;
}

export function renderDefinitionListAt(
    parsedLines: ParsedLine[],
    startIndex: number,
    context: RenderContext,
    appendContent: ContentAppender
): RenderedDefinition | null {
    if (!canRenderDefinitionTerm(parsedLines, startIndex)) {
        return null;
    }

    const dl = createDefinitionList();
    let index = startIndex;
    let renderedTerms = 0;

    while (canRenderDefinitionTerm(parsedLines, index)) {
        appendDefinitionTerm(dl, parsedLines[index], context, appendContent);
        index = nextNonBlankIndex(parsedLines, index + 1);

        while (parsedLines[index]?.type === 'definition-item') {
            const rendered = renderDefinitionDescription(parsedLines, index, context, appendContent);
            dl.appendChild(rendered.element);
            index = rendered.nextIndex;
        }

        renderedTerms++;
        const nextTermIndex = nextNonBlankIndex(parsedLines, index);
        if (nextTermIndex !== index && canRenderDefinitionTerm(parsedLines, nextTermIndex)) {
            index = nextTermIndex;
        }
    }

    return renderedTerms > 0 ? { element: dl, nextIndex: index } : null;
}

function appendDefinitionTerm(
    dl: HTMLElement,
    parsedLine: ParsedLine,
    context: RenderContext,
    appendContent: ContentAppender
): void {
    const term = parsedLine.metadata as DefinitionData;
    const dt = document.createElement('dt');
    dt.className = CSS_CLASSES.DEFINITION_TERM;
    appendContent(dt, term.content, context);
    dl.appendChild(dt);
}

function renderDefinitionDescription(
    parsedLines: ParsedLine[],
    index: number,
    context: RenderContext,
    appendContent: ContentAppender
): RenderedDefinition {
    const definition = parsedLines[index].metadata as DefinitionData;
    const dd = createDefinitionDescription();
    const listItem = parseListItemContent(definition.content);

    if (!listItem) {
        appendContent(dd, definition.content, context);
        return { element: dd, nextIndex: index + 1 };
    }

    const list = document.createElement(listItem.ordered ? 'ol' : 'ul');
    const li = document.createElement('li');
    appendTaskCheckbox(li, listItem);

    if (hasIndentedDefinitionItem(parsedLines[index + 1], definition.indent)) {
        const nested = renderNestedDefinitionList(
            listItem.content,
            parsedLines,
            index + 1,
            definition.indent,
            context,
            appendContent
        );
        li.appendChild(nested.element);
        list.appendChild(li);
        dd.appendChild(list);
        return { element: dd, nextIndex: nested.nextIndex };
    }

    appendContent(li, listItem.content, context);
    list.appendChild(li);
    dd.appendChild(list);
    return { element: dd, nextIndex: index + 1 };
}

function renderNestedDefinitionList(
    termContent: string,
    parsedLines: ParsedLine[],
    startIndex: number,
    parentIndent: string,
    context: RenderContext,
    appendContent: ContentAppender
): RenderedDefinition {
    const dl = createDefinitionList();
    const dt = document.createElement('dt');
    dt.className = CSS_CLASSES.DEFINITION_TERM;
    appendContent(dt, termContent, context);
    dl.appendChild(dt);

    let index = startIndex;
    while (hasIndentedDefinitionItem(parsedLines[index], parentIndent)) {
        const definition = parsedLines[index].metadata as DefinitionData;
        const dd = createDefinitionDescription();
        appendContent(dd, definition.content, context);
        dl.appendChild(dd);
        index++;
    }

    return { element: dl, nextIndex: index };
}

function canRenderDefinitionTerm(parsedLines: ParsedLine[], index: number): boolean {
    if (parsedLines[index]?.type !== 'definition-term') {
        return false;
    }

    return parsedLines[nextNonBlankIndex(parsedLines, index + 1)]?.type === 'definition-item';
}

function hasIndentedDefinitionItem(parsedLine: ParsedLine | undefined, parentIndent: string): boolean {
    if (parsedLine?.type !== 'definition-item') {
        return false;
    }

    const definition = parsedLine.metadata as DefinitionData;
    return getIndentWidth(definition.indent) > getIndentWidth(parentIndent);
}

function nextNonBlankIndex(parsedLines: ParsedLine[], startIndex: number): number {
    let index = startIndex;
    while (index < parsedLines.length && parsedLines[index].content.trim().length === 0) {
        index++;
    }
    return index;
}

function createDefinitionList(): HTMLElement {
    const dl = document.createElement('dl');
    dl.className = CSS_CLASSES.DEFINITION_LIST;
    return dl;
}

function createDefinitionDescription(): HTMLElement {
    const dd = document.createElement('dd');
    dd.className = CSS_CLASSES.DEFINITION_DESC;
    return dd;
}

function parseListItemContent(content: string): ListItemContent | null {
    const taskMatch = content.match(/^[-+*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
        return {
            ordered: false,
            checked: taskMatch[1].toLowerCase() === 'x',
            content: taskMatch[2]
        };
    }

    const bulletMatch = content.match(/^[-+*]\s+(.*)$/);
    if (bulletMatch) {
        return { ordered: false, content: bulletMatch[1] };
    }

    const orderedMatch = content.match(/^\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
        return { ordered: true, content: orderedMatch[1] };
    }

    return null;
}

function appendTaskCheckbox(listItem: HTMLElement, content: ListItemContent): void {
    if (content.checked === undefined) {
        return;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = content.checked;
    checkbox.disabled = true;
    listItem.appendChild(checkbox);
    listItem.appendChild(document.createTextNode(' '));
}

function getIndentWidth(indent: string): number {
    return Array.from(indent).reduce((width, char) => width + (char === '\t' ? 4 : 1), 0);
}
