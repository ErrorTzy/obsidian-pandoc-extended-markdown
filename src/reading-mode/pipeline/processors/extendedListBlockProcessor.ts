import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { isStrictPandocFormatting } from '../../../editor-extensions/pandocValidator';
import { ListPatterns } from '../../../shared/patterns';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import { ValidationContext } from '../../../shared/types/listTypes';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList
} from '../../pandocDefinitionListParser';
import { renderPandocDefinitionSource } from '../../pandocDefinitionListRenderer';
import { ReadingModeParser, ExampleListData } from '../../parsers/parser';
import { ReadingModeRenderer } from '../../renderer';
import { BlockDomProcessor, ReadingModeContext } from '../types';
import { tryRenderSemanticListParagraph } from './semanticListBlockRenderer';

export class ExtendedListBlockProcessor implements BlockDomProcessor {
    name = 'extended-list-blocks';
    phase = 'block' as const;
    priority = 120;

    private readonly parser = new ReadingModeParser();
    private readonly renderer = new ReadingModeRenderer();

    process(context: ReadingModeContext): void {
        const elementsToProcess = getCandidateTextContainers(context.element);

        elementsToProcess.forEach(element => {
            if (shouldSkipElement(element, context.sourcePath)) {
                return;
            }

            this.processElementTextNodes(element, context);
            pluginStateManager.markElementProcessed(element, 'pem-processed', true);
        });
    }

    private processElementTextNodes(elem: Element, context: ReadingModeContext): void {
        if (context.config.enableDefinitionLists !== false &&
            elem.nodeName === 'P' &&
            this.processDefinitionListParagraph(elem, context)) {
            return;
        }

        if (elem.nodeName === 'P' && this.processExtendedListParagraph(elem, context)) {
            return;
        }

        const walker = document.createTreeWalker(
            elem,
            NodeFilter.SHOW_TEXT,
            null
        );

        const nodesToProcess: Text[] = [];
        while (walker.nextNode()) {
            nodesToProcess.push(walker.currentNode as Text);
        }

        nodesToProcess.forEach(node => this.processTextNode(node, context));
    }

    private processTextNode(node: Text, context: ReadingModeContext): void {
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
            context.config
        );

        if (context.config.strictPandocMode) {
            parsedLines.forEach((parsedLine, index) => {
                if (parsedLine.type === 'fancy' &&
                    context.validationLines.length > 0 &&
                    !validateListInStrictMode(lines[index], context.validationLines, context.config)) {
                    parsedLine.type = 'plain';
                }
            });
        }

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

        if (!sourceText.includes('\n') || findPandocDefinitionListBlocks(sourceText).length === 0) {
            return false;
        }

        const rendered = renderPandocDefinitionSource(
            sourceText,
            context.renderContext,
            (target, content, renderContext) => {
                this.renderer.appendContent(target, content, renderContext);
            }
        );

        if (sourceText !== text) {
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
        context: ReadingModeContext
    ): boolean {
        const text = getTextWithLineBreaks(elem);
        return tryRenderSemanticListParagraph(elem, context, this.parser, this.renderer, text);
    }
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

    const blocks = findPandocDefinitionListBlocks(sectionText);
    if (!isStandalonePandocDefinitionList(sectionText, blocks)) {
        return text;
    }

    return matchesDefinitionListSection(text, blocks) ? sectionText : text;
}

function matchesDefinitionListSection(
    text: string,
    blocks: ReturnType<typeof findPandocDefinitionListBlocks>
): boolean {
    const normalizedText = normalizeCandidateText(text);
    return blocks.some(block =>
        block.termTexts.some(term => normalizedText.includes(normalizeCandidateText(term))) ||
        block.definitionTexts.some(definition => normalizedText.includes(normalizeCandidateText(definition)))
    );
}

function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function shouldSkipElement(element: Element, sourcePath: string): boolean {
    return Boolean(
        element.closest('h1, h2, h3, h4, h5, h6') ||
        pluginStateManager.isElementProcessed(element, 'pem-processed', sourcePath)
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

    const hasCustomLabelSyntax = !config?.strictPandocMode && config?.enableCustomLabelLists &&
        (ListPatterns.isCustomLabelList(text) ||
            ListPatterns.findCustomLabelReferences(text).length > 0);

    return hasBasicSyntax || Boolean(hasCustomLabelSyntax);
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

    if (lineNum >= 0) {
        const validationContext: ValidationContext = {
            lines: documentLines,
            currentLine: lineNum
        };

        return isStrictPandocFormatting(validationContext, config.strictPandocMode);
    }

    return true;
}
