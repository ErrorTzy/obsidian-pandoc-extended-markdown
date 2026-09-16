import { CSS_CLASSES } from '../../../core/constants';
import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { ListPatterns } from '../../../shared/patterns';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList
} from '../../features/definition-lists/sourceParser';
import { renderPandocDefinitionSource } from '../../features/definition-lists/sourceRenderer';
import { ReadingModeParser, ExampleListData } from '../../features/extended-lists/lineParser';
import { ReadingModeRenderer } from '../../features/extended-lists/lineRenderer';
import { BlockDomProcessor, ReadingModeContext } from '../types';
import {
    resolveSourceDataLines,
    tryRenderSemanticListParagraph
} from '../../features/extended-lists/semanticBlockRenderer';

export class ExtendedListBlockProcessor implements BlockDomProcessor {
    name = 'extended-list-blocks';
    phase = 'block' as const;
    priority = 120;

    private readonly parser = new ReadingModeParser();
    private readonly renderer = new ReadingModeRenderer();

    process(context: ReadingModeContext): void {
        const elementsToProcess = getCandidateTextContainers(context.element);
        const validation = ListBlockValidator.analyzeListBlocks(
            context.validationLines,
            {
                enableListsWithoutPrecedingBlankline:
                    context.config.enableListsWithoutPrecedingBlankline
            },
            true
        );
        const sourceDataLines = resolveCandidateSourceDataLines(
            elementsToProcess,
            context,
            validation.candidateListLines ?? new Set()
        );

        elementsToProcess.forEach(element => {
            if (shouldSkipElement(element, context.sourcePath)) {
                return;
            }

            const containsProcessableSyntax = getTextWithLineBreaks(element)
                .split('\n')
                .some(line => containsPandocSyntax(line, context.config));
            this.processElementTextNodes(
                element,
                context,
                sourceDataLines.get(element),
                validation.invalidLines
            );
            if (containsProcessableSyntax) {
                pluginStateManager.markElementProcessed(element, 'pem-processed', true);
            }
        });
    }

    private processElementTextNodes(
        elem: Element,
        context: ReadingModeContext,
        elementDataLines: Array<number | undefined> | undefined,
        invalidListLines: Set<number>
    ): void {
        if (shouldKeepSourceBackedDefinitionMarkerPlain(elem, context)) {
            return;
        }

        if (context.config.enableDefinitionLists !== false &&
            elem.nodeName === 'P' &&
            this.processDefinitionListParagraph(elem, context)) {
            return;
        }

        if ((elem.nodeName === 'P' || elem.nodeName === 'LI') && this.processExtendedListParagraph(
            elem,
            context,
            elementDataLines,
            invalidListLines
        )) {
            return;
        }

        const walker = document.createTreeWalker(
            elem,
            NodeFilter.SHOW_TEXT,
            null
        );

        const nodesToProcess: Array<{
            node: Text;
            dataLines: Array<number | undefined>;
        }> = [];
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            nodesToProcess.push({
                node,
                dataLines: getTextNodeSourceDataLines(node, elem, elementDataLines)
            });
        }

        nodesToProcess.forEach(item => this.processTextNode(
            item.node,
            context,
            item.dataLines,
            invalidListLines
        ));
    }

    private processTextNode(
        node: Text,
        context: ReadingModeContext,
        dataLines: Array<number | undefined>,
        invalidListLines: Set<number>
    ): void {
        const parent = node.parentNode;
        if (!parent || parent.nodeName === 'CODE' || parent.nodeName === 'PRE') {
            return;
        }

        const text = node.textContent || '';
        if (!containsPandocSyntax(text, context.config)) {
            return;
        }

        const isInParagraph = parent.nodeName === 'P';
        const isAtParagraphStart = parent.firstChild === node;
        const lines = text.split('\n');
        const parsedLines = this.parser.parseLines(
            lines,
            isInParagraph,
            isAtParagraphStart,
            context.config,
            dataLines
        );

        applySourceDefinitionBoundaries(parsedLines, lines, context);

        parsedLines.forEach((parsedLine, index) => {
            if (isOrderedListSyntax(parsedLine.type) &&
                context.validationLines.length > 0 &&
                (parsedLine.dataLine === undefined ||
                    invalidListLines.has(parsedLine.dataLine))) {
                parsedLine.type = 'plain';
            }
        });

        const numberProvider = (type: string, index: number): number => {
            const parsedLine = parsedLines[index];

            if (type === 'hash') {
                return pluginStateManager.incrementHashCounter(context.sourcePath);
            }

            if (type === 'example' && parsedLine.type === 'example') {
                const metadata = parsedLine.metadata as ExampleListData;
                const number = pluginStateManager.incrementExampleCounter(context.sourcePath);

                if (metadata.label) {
                    pluginStateManager.setLabeledExample(
                        context.sourcePath,
                        metadata.label,
                        number,
                        metadata.content?.trim()
                    );
                }

                return number;
            }

            return 0;
        };

        const newElements = this.renderer.renderLines(
            parsedLines,
            context.renderContext,
            numberProvider
        );

        if (newElements.length > 0) {
            newElements.forEach(element => parent.insertBefore(element, node));
            parent.removeChild(node);
        }
    }

    private processDefinitionListParagraph(
        elem: Element,
        context: ReadingModeContext
    ): boolean {
        const text = getTextWithLineBreaks(elem);
        const sourceText = getStandaloneDefinitionListSource(text, context);

        if (!sourceText.includes('\n') ||
            findPandocDefinitionListBlocks(sourceText, context.config).length === 0) {
            return false;
        }

        const rendered = renderPandocDefinitionSource(
            sourceText,
            context.renderContext,
            (target, content, renderContext) => {
                this.renderer.appendContent(target, content, renderContext);
            },
            context.config
        );

        if (sourceText !== text) {
            const section = elem.closest('.markdown-preview-section');
            if (section instanceof HTMLElement) {
                section.replaceChildren(...rendered);
                return true;
            }

            const blockContainer = elem.closest('.el-p');
            if (blockContainer) {
                blockContainer.replaceChildren(...rendered);
                return true;
            }
        }

        if (elem.parentNode) {
            elem.replaceWith(...rendered);
        } else {
            elem.replaceChildren(...rendered);
        }
        return true;
    }

    private processExtendedListParagraph(
        elem: Element,
        context: ReadingModeContext,
        sourceDataLines: Array<number | undefined> | undefined,
        invalidListLines: Set<number>
    ): boolean {
        // Obsidian has already established the semantics of a source-less LI.
        // Do not reinterpret literal text at its start as a new Pandoc list.
        if (elem.nodeName === 'LI' &&
            !sourceDataLines?.some(line => line !== undefined)) {
            return false;
        }

        const text = getTextWithLineBreaks(elem);
        return tryRenderSemanticListParagraph(
            elem,
            context,
            this.parser,
            this.renderer,
            text,
            sourceDataLines,
            invalidListLines
        );
    }
}

function resolveCandidateSourceDataLines(
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
            const resolvedLines = dataLines.filter((line): line is number => line !== undefined);
            if (resolvedLines.length > 0) {
                nextDisjointSourceLine = Math.max(...resolvedLines) + 1;
            }
        }
    });

    return result;
}

function getTextNodeSourceDataLines(
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

function getCandidateTextContainers(element: HTMLElement): Element[] {
    const descendants = Array.from(element.querySelectorAll('p, li'));
    if (element.matches('p, li')) {
        return [element, ...descendants];
    }

    return descendants;
}

function getStandaloneDefinitionListSource(text: string, context: ReadingModeContext): string {
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

function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function shouldSkipElement(element: Element, sourcePath: string): boolean {
    return Boolean(
        element.closest('h1, h2, h3, h4, h5, h6') ||
        element.closest(`.${CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST}`) ||
        pluginStateManager.isElementProcessed(element, 'pem-processed', sourcePath)
    );
}

function shouldKeepSourceBackedDefinitionMarkerPlain(
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

    // Rendered marker text has already lost source formatting such as emphasis,
    // so it cannot be matched byte-for-byte to the source reliably. Defer every
    // marker paragraph when the full-source host renderer is available; that
    // owner performs source validation and leaves rejected markers unchanged.
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

function applySourceDefinitionBoundaries(
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

function getTextWithLineBreaks(elem: Element): string {
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

function containsPandocSyntax(text: string, config?: ProcessorConfig): boolean {
    const hasBasicSyntax = (config?.enableHashLists !== false && !!ListPatterns.isHashList(text)) ||
        (config?.enableFancyLists !== false && !!ListPatterns.isFancyList(text)) ||
        (config?.enableExampleLists !== false && !!ListPatterns.isExampleList(text)) ||
        (config?.enableDefinitionLists !== false && !!ListPatterns.isDefinitionMarker(text)) ||
        (config?.enableExampleLists !== false && ListPatterns.findExampleReferences(text).length > 0);

    const hasCustomLabelSyntax = config?.enableCustomLabelLists &&
        (ListPatterns.isCustomLabelList(text) ||
            ListPatterns.findCustomLabelReferences(text).length > 0);

    return hasBasicSyntax || Boolean(hasCustomLabelSyntax);
}

function isOrderedListSyntax(type: string): boolean {
    return type === 'hash' || type === 'fancy' || type === 'example';
}
