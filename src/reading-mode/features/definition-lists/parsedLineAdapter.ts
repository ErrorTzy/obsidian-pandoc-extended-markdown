import {
    findPandocDefinitionListBlocks
} from './sourceParser';
import {
    renderPandocDefinitionListBlock
} from './sourceRenderer';

import type { ParsedLine, DefinitionData } from '../extended-lists/lineParser';
import type { RenderContext } from '../extended-lists/lineRenderer';

type ContentAppender = (element: HTMLElement, content: string, context: RenderContext) => void;

interface RenderedDefinition {
    element: HTMLElement;
    nextIndex: number;
}

export function renderDefinitionListAt(
    parsedLines: ParsedLine[],
    startIndex: number,
    context: RenderContext,
    appendContent: ContentAppender
): RenderedDefinition | null {
    const sourceBlock = collectDefinitionListSource(parsedLines, startIndex);
    if (!sourceBlock) {
        return null;
    }

    const block = findPandocDefinitionListBlocks(sourceBlock.source)[0];
    if (!block) {
        return null;
    }

    return {
        element: renderPandocDefinitionListBlock(block, context, appendContent),
        nextIndex: sourceBlock.nextIndex
    };
}

function collectDefinitionListSource(
    parsedLines: ParsedLine[],
    startIndex: number
): { source: string, nextIndex: number } | null {
    if (!canRenderDefinitionTerm(parsedLines, startIndex)) {
        return null;
    }

    const sourceLines: string[] = [];
    let index = startIndex;

    while (canRenderDefinitionTerm(parsedLines, index)) {
        sourceLines.push(definitionTermSourceLine(parsedLines[index]));
        index = nextNonBlankIndex(parsedLines, index + 1);

        while (parsedLines[index]?.type === 'definition-item') {
            sourceLines.push(definitionItemSourceLine(parsedLines[index]));
            index++;
        }

        const nextTermIndex = nextNonBlankIndex(parsedLines, index);
        if (nextTermIndex === index || !canRenderDefinitionTerm(parsedLines, nextTermIndex)) {
            break;
        }

        sourceLines.push('');
        index = nextTermIndex;
    }

    return {
        source: sourceLines.join('\n'),
        nextIndex: index
    };
}

function canRenderDefinitionTerm(parsedLines: ParsedLine[], index: number): boolean {
    if (parsedLines[index]?.type !== 'definition-term') {
        return false;
    }

    return parsedLines[nextNonBlankIndex(parsedLines, index + 1)]?.type === 'definition-item';
}

function definitionTermSourceLine(parsedLine: ParsedLine): string {
    const term = parsedLine.metadata as DefinitionData;
    return term.content;
}

function definitionItemSourceLine(parsedLine: ParsedLine): string {
    const definition = parsedLine.metadata as DefinitionData;
    return `${definition.indent}${definition.marker} ${definition.content}`;
}

function nextNonBlankIndex(parsedLines: ParsedLine[], startIndex: number): number {
    let index = startIndex;
    while (index < parsedLines.length && parsedLines[index].content.trim().length === 0) {
        index++;
    }
    return index;
}
