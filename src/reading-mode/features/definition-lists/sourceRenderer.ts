import { CSS_CLASSES } from '../../../core/constants';

import {
    DefinitionListSpacingSettings,
    findPandocDefinitionListBlocks,
    normalizePlainText,
    PandocDefinitionDescription,
    PandocDefinitionListBlock,
    parseIndentedDefinitionMarker,
    parseMarkdownListItem,
    trimOuterBlankLines
} from './sourceParser';
import type { RenderContext } from '../extended-lists/lineRenderer';

type ContentAppender = (element: HTMLElement, content: string, context: RenderContext) => void;
type BlockContentAppender = (
    element: HTMLElement,
    source: string,
    context: RenderContext,
    unwrapSingleParagraph: boolean
) => void;

export function renderPandocDefinitionListBlock(
    block: PandocDefinitionListBlock,
    context: RenderContext,
    appendContent: ContentAppender,
    appendBlockContent?: BlockContentAppender
): HTMLElement {
    const dl = document.createElement('dl');
    dl.className = CSS_CLASSES.DEFINITION_LIST;

    block.items.forEach(item => {
        const dt = document.createElement('dt');
        dt.className = CSS_CLASSES.DEFINITION_TERM;
        appendInlineContent(dt, item.term, context, appendContent);
        dl.appendChild(dt);

        item.definitions.forEach(definition => {
            const dd = document.createElement('dd');
            dd.className = `${CSS_CLASSES.DEFINITION_DESC} ${CSS_CLASSES.DEFINITION_DESC_ITEM}`;
            appendDefinitionDescription(
                dd,
                definition,
                context,
                appendContent,
                appendBlockContent
            );
            dl.appendChild(dd);
        });
    });

    return dl;
}

export function renderPandocDefinitionSource(
    sourceText: string,
    context: RenderContext,
    appendContent: ContentAppender,
    settings?: DefinitionListSpacingSettings
): HTMLElement[] {
    const lines = sourceText.split('\n');
    const blocks = findPandocDefinitionListBlocks(sourceText, settings);
    const nodes: HTMLElement[] = [];
    let index = 0;

    blocks.forEach(block => {
        appendParagraphs(nodes, lines.slice(index, block.startLine), context, appendContent);
        nodes.push(renderPandocDefinitionListBlock(block, context, appendContent));
        index = block.endLine + 1;
    });

    appendParagraphs(nodes, lines.slice(index), context, appendContent);
    return nodes;
}

function appendDefinitionDescription(
    dd: HTMLElement,
    definition: PandocDefinitionDescription,
    context: RenderContext,
    appendContent: ContentAppender,
    appendBlockContent?: BlockContentAppender
): void {
    if (definition.nestedDefinitionBlocks.length > 0) {
        appendDefinitionBodyWithNestedBlocks(
            dd,
            definition,
            context,
            appendContent,
            appendBlockContent
        );
        return;
    }

    appendDefinitionBodyFragment(
        dd,
        definition.lines,
        definition.wrapParagraph,
        context,
        appendContent,
        appendBlockContent
    );
}

function appendDefinitionBodyWithNestedBlocks(
    dd: HTMLElement,
    definition: PandocDefinitionDescription,
    context: RenderContext,
    appendContent: ContentAppender,
    appendBlockContent?: BlockContentAppender
): void {
    let index = 0;
    definition.nestedDefinitionBlocks.forEach(block => {
        if (block.endLine < index) {
            return;
        }
        const blockStart = block.nativeListParentIndex ?? block.startLine;
        appendDefinitionBodyFragment(
            dd,
            definition.lines.slice(index, blockStart),
            definition.wrapParagraph,
            context,
            appendContent,
            appendBlockContent
        );
        if (block.nativeListParentIndex !== undefined) {
            const renderedList = renderListBlock(
                definition.lines.slice(blockStart),
                context,
                appendContent
            );
            if (renderedList) {
                dd.appendChild(renderedList.element);
                index = blockStart + renderedList.consumedLines;
                return;
            }

            appendDefinitionBodyFragment(
                dd,
                definition.lines.slice(blockStart, block.endLine + 1),
                definition.wrapParagraph,
                context,
                appendContent,
                appendBlockContent
            );
            index = block.endLine + 1;
            return;
        }
        dd.appendChild(renderPandocDefinitionListBlock(
            block,
            context,
            appendContent,
            appendBlockContent
        ));
        index = block.endLine + 1;
    });
    appendDefinitionBodyFragment(
        dd,
        definition.lines.slice(index),
        definition.wrapParagraph,
        context,
        appendContent,
        appendBlockContent
    );
}

function appendDefinitionBodyFragment(
    dd: HTMLElement,
    sourceLines: string[],
    wrapParagraph: boolean,
    context: RenderContext,
    appendContent: ContentAppender,
    appendBlockContent?: BlockContentAppender
): void {
    const lines = trimOuterBlankLines(sourceLines);

    if (lines.length === 0) {
        return;
    }

    if (appendBlockContent) {
        appendBlockContent(
            dd,
            lines.join('\n'),
            context,
            !wrapParagraph
        );
        return;
    }

    if (appendListBlock(dd, lines, context, appendContent)) {
        return;
    }

    if (appendBlockQuote(dd, lines, context, appendContent)) {
        return;
    }

    const content = normalizePlainText(lines);
    if (wrapParagraph) {
        const paragraph = document.createElement('p');
        appendInlineContent(paragraph, content, context, appendContent);
        dd.appendChild(paragraph);
        return;
    }

    appendInlineContent(dd, content, context, appendContent);
}

function appendParagraphs(
    nodes: HTMLElement[],
    lines: string[],
    context: RenderContext,
    appendContent: ContentAppender
): void {
    const paragraphs: string[][] = [];
    let current: string[] = [];

    lines.forEach(line => {
        if (line.trim().length === 0) {
            if (current.length > 0) {
                paragraphs.push(current);
                current = [];
            }
            return;
        }
        current.push(line);
    });

    if (current.length > 0) {
        paragraphs.push(current);
    }

    paragraphs.forEach(paragraphLines => {
        const paragraph = document.createElement('p');
        appendInlineContent(paragraph, normalizePlainText(paragraphLines), context, appendContent);
        nodes.push(paragraph);
    });
}

function appendListBlock(
    parent: HTMLElement,
    lines: string[],
    context: RenderContext,
    appendContent: ContentAppender
): boolean {
    const rendered = renderListBlock(lines, context, appendContent);
    if (!rendered || rendered.consumedLines !== lines.length) {
        return false;
    }

    parent.appendChild(rendered.element);
    return true;
}

function renderListBlock(
    lines: string[],
    context: RenderContext,
    appendContent: ContentAppender
): { element: HTMLUListElement | HTMLOListElement, consumedLines: number } | null {
    const firstItem = parseMarkdownListItem(lines[0]);
    if (!firstItem) {
        return null;
    }

    const list = document.createElement(firstItem.ordered ? 'ol' : 'ul');
    if (firstItem.ordered) {
        list.setAttribute('type', '1');
    }
    if (firstItem.checked !== undefined) {
        list.className = 'task-list';
    }

    let index = 0;
    while (index < lines.length) {
        const item = parseMarkdownListItem(lines[index]);
        if (!item || item.ordered !== firstItem.ordered) {
            break;
        }

        const li = document.createElement('li');
        index++;

        const nestedDefinitionLines: string[] = [];
        while (index < lines.length && parseIndentedDefinitionMarker(lines[index])) {
            const marker = parseIndentedDefinitionMarker(lines[index]);
            nestedDefinitionLines.push(`${marker?.marker} ${marker?.content ?? ''}`);
            index++;
        }

        if (nestedDefinitionLines.length > 0) {
            appendNestedDefinitionList(li, item.content, nestedDefinitionLines, context, appendContent);
        } else if (item.checked !== undefined) {
            appendTaskListItem(li, item.checked, item.content, context, appendContent);
        } else {
            appendInlineContent(li, item.content, context, appendContent);
        }

        list.appendChild(li);
    }

    return { element: list, consumedLines: index };
}

function appendNestedDefinitionList(
    li: HTMLElement,
    term: string,
    definitionLines: string[],
    context: RenderContext,
    appendContent: ContentAppender
): void {
    const nestedSource = [term, ...definitionLines].join('\n');
    const nestedBlock = findPandocDefinitionListBlocks(nestedSource)[0];
    if (nestedBlock) {
        li.appendChild(renderPandocDefinitionListBlock(nestedBlock, context, appendContent));
        return;
    }

    appendInlineContent(li, term, context, appendContent);
}

function appendTaskListItem(
    li: HTMLElement,
    checked: boolean,
    content: string,
    context: RenderContext,
    appendContent: ContentAppender
): void {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.disabled = true;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' '));
    appendInlineContent(label, content, context, appendContent);
    li.appendChild(label);
}

function appendBlockQuote(
    parent: HTMLElement,
    lines: string[],
    context: RenderContext,
    appendContent: ContentAppender
): boolean {
    if (!lines.every(line => line.trimStart().startsWith('>'))) {
        return false;
    }

    const quote = document.createElement('blockquote');
    const paragraph = document.createElement('p');
    const content = normalizePlainText(lines.map(line => line.trimStart().replace(/^>\s?/, '')));
    appendInlineContent(paragraph, content, context, appendContent);
    quote.appendChild(paragraph);
    parent.appendChild(quote);
    return true;
}

function appendInlineContent(
    element: HTMLElement,
    content: string,
    context: RenderContext,
    appendContent: ContentAppender
): void {
    appendContent(element, content, context);
}
