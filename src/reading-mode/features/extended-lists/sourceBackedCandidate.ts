import { ListPatterns } from '../../../shared/patterns';
import { ProcessorConfig } from '../../../shared/types/processorConfig';

import { ReadingModeContext } from '../../pipeline/types';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList
} from '../definition-lists/sourceParser';
import { ReadingModeParser } from './lineParser';
import { resolveSourceDataLines } from './sourceDataLineResolver';

/** Resolve each rendered candidate independently while preserving document source order. */
export function resolveCandidateSourceDataLines(
    elements: Element[],
    context: ReadingModeContext,
    candidateListLines: Set<number>
): Map<Element, Array<number | undefined>> {
    const result = new Map<Element, Array<number | undefined>>();
    let nextDisjointSourceLine = 0;

    elements.forEach(element => {
        const lines = getTextWithLineBreaks(element).split('\n');
        const isNestedCandidate = Boolean(element.parentElement?.closest('p, li'));
        const dataLines = resolveSourceDataLines(
            lines,
            context,
            element,
            isNestedCandidate ? 0 : nextDisjointSourceLine,
            candidateListLines
        );
        result.set(element, dataLines);

        if (!isNestedCandidate) {
            const resolvedLines = dataLines.filter(
                (line): line is number => line !== undefined
            );
            if (resolvedLines.length > 0) {
                nextDisjointSourceLine = Math.max(...resolvedLines) + 1;
            }
        }
    });

    return result;
}

export function getTextNodeSourceDataLines(
    node: Text,
    container: Element,
    elementDataLines: Array<number | undefined> | undefined
): Array<number | undefined> {
    const lineCount = (node.textContent?.match(/\n/g)?.length ?? 0) + 1;
    if (!elementDataLines) {
        return Array.from({ length: lineCount }, () => undefined);
    }

    const startLine = getTextNodeLineIndex(node, container);
    return Array.from(
        { length: lineCount },
        (_, index) => elementDataLines[startLine + index]
    );
}

function getTextNodeLineIndex(target: Text, container: Element): number {
    let lineIndex = 0;
    let targetLineIndex = 0;
    let found = false;

    const visit = (node: Node): void => {
        if (found) {
            return;
        }
        if (node === target) {
            targetLineIndex = lineIndex;
            found = true;
            return;
        }
        if (node.nodeName === 'BR') {
            lineIndex++;
            return;
        }
        if (node.nodeType === Node.TEXT_NODE) {
            lineIndex += node.textContent?.match(/\n/g)?.length ?? 0;
            return;
        }
        node.childNodes.forEach(visit);
    };

    container.childNodes.forEach(visit);
    return targetLineIndex;
}

export function getStandaloneDefinitionListSource(
    text: string,
    context: ReadingModeContext
): string {
    const sectionText = context.sectionInfo?.text;
    if (!sectionText || sectionText === text) {
        return text;
    }

    const blocks = findPandocDefinitionListBlocks(sectionText, context.config);
    if (!isStandalonePandocDefinitionList(sectionText, blocks)) {
        return text;
    }

    return matchesCompleteDefinitionListSection(text, blocks) ? sectionText : text;
}

function matchesCompleteDefinitionListSection(
    text: string,
    blocks: ReturnType<typeof findPandocDefinitionListBlocks>
): boolean {
    const normalizedText = normalizeCandidateText(text);
    return blocks.every(block => {
        const requiredTexts = [...block.termTexts, ...block.definitionTexts]
            .map(normalizeCandidateText)
            .filter(requiredText => requiredText.length > 0);

        return requiredTexts.every(requiredText => normalizedText.includes(requiredText));
    });
}

export function shouldKeepSourceBackedDefinitionMarkerPlain(
    element: Element,
    context: ReadingModeContext
): boolean {
    if (
        context.config.enableDefinitionLists === false ||
        element.nodeName !== 'P' ||
        !context.sectionInfo?.text
    ) {
        return false;
    }

    const markerTexts = getTextWithLineBreaks(element)
        .split('\n')
        .map(normalizeCandidateText)
        .filter(line => Boolean(ListPatterns.isDefinitionMarker(line)));
    if (markerTexts.length === 0) {
        return false;
    }

    // The host renderer owns source-backed markers because rendered marker text
    // has already lost source formatting such as emphasis.
    if (context.app) {
        return true;
    }

    const sourceLines = context.sectionInfo.text.split('\n');
    const matchingSourceLineIndexes = sourceLines
        .map((line, index) => ({ line: normalizeCandidateText(line), index }))
        .filter(item => markerTexts.includes(item.line))
        .map(item => item.index);

    if (matchingSourceLineIndexes.length === 0) {
        return false;
    }

    const blocks = findPandocDefinitionListBlocks(context.sectionInfo.text, context.config);
    const isInBlock = (index: number): boolean => blocks.some(block =>
        index >= block.startLine && index <= block.endLine
    );
    const isInLazyContainerBlock = (index: number): boolean => blocks.some(block =>
        block.joinsLazyContainer && index >= block.startLine && index <= block.endLine
    );

    return matchingSourceLineIndexes.some(index =>
        !isInBlock(index) || isInLazyContainerBlock(index)
    );
}

export function applySourceDefinitionBoundaries(
    parsedLines: ReturnType<ReadingModeParser['parseLines']>,
    lines: string[],
    context: ReadingModeContext
): void {
    if (context.config.enableDefinitionLists === false || !context.sectionInfo?.text) {
        return;
    }

    parsedLines.forEach((parsedLine, index) => {
        if (
            parsedLine.type !== 'definition-item' ||
            isSourceLineInDefinitionBlock(
                lines[index],
                context.sectionInfo?.text ?? '',
                context.config
            )
        ) {
            return;
        }

        parsedLine.type = 'plain';
        parsedLine.metadata = undefined;
    });
}

function isSourceLineInDefinitionBlock(
    line: string,
    sourceText: string,
    config: ProcessorConfig
): boolean {
    const normalizedLine = normalizeCandidateText(line);
    const sourceLines = sourceText.split('\n');
    const matchingSourceLineIndexes = sourceLines
        .map((sourceLine, index) => ({ line: normalizeCandidateText(sourceLine), index }))
        .filter(item => item.line === normalizedLine)
        .map(item => item.index);

    if (matchingSourceLineIndexes.length === 0) {
        return true;
    }

    const blocks = findPandocDefinitionListBlocks(sourceText, config);
    return matchingSourceLineIndexes.some(index =>
        blocks.some(block => index >= block.startLine && index <= block.endLine)
    );
}

function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** Read visible candidate text while preserving rendered line breaks and skipping code. */
export function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function appendNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push('\n');
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '');
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && !isCodeElement(node as Element)) {
        node.childNodes.forEach(child => appendNodeText(child, parts));
    }
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
}
