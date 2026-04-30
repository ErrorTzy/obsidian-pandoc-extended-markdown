/**
 * Reading Mode Processor
 * 
 * Coordinates parsing, state management, and rendering for reading mode.
 * This is now a thin orchestration layer that delegates to specialized modules.
 */

import { MarkdownPostProcessorContext } from 'obsidian';

import { getSectionInfo } from '../shared/types/obsidian-extended';
import { ProcessorConfig } from '../shared/types/processorConfig';

import { ListPatterns } from '../shared/patterns';

import { ReadingModeParser, ExampleListData } from './parsers/parser';
import { ReadingModeRenderer, RenderContext } from './renderer';
import { processSuperSub } from './parsers/superSubParser';
import { processCustomLabelLists } from './parsers/customLabelListParser';
import {
    applyUnorderedListMarkerClasses,
    clearUnorderedListMarkerClasses
} from './parsers/unorderedListMarkerParser';
import { normalizeExistingDefinitionLists } from './utils/definitionListDom';
import { pluginStateManager } from '../core/state/pluginStateManager';
import { isStrictPandocFormatting } from '../editor-extensions/pandocValidator';
import { ValidationContext } from '../shared/types/listTypes';

export function processReadingMode(
    element: HTMLElement, 
    context: MarkdownPostProcessorContext, 
    config: ProcessorConfig
) {
    const docPath = context.sourcePath || 'unknown';
    const parser = new ReadingModeParser();
    const renderer = new ReadingModeRenderer();
    
    // Process only paragraphs and list items, not headings or other elements
    const elementsToProcess = element.querySelectorAll('p, li');
    
    // Get section info for validation if needed
    let validationLines: string[] = [];
    if (config.strictPandocMode) {
        const section = element.closest('.markdown-preview-section') as HTMLElement;
        const sectionInfo = getSectionInfo(section);
        if (sectionInfo?.text) {
            validationLines = sectionInfo.text.split('\n');
        }
    }

    if (config.enableUnorderedListMarkerStyles !== false) {
        applyUnorderedListMarkerClasses(element, context);
    } else {
        clearUnorderedListMarkerClasses(element);
    }

    if (config.enableDefinitionLists !== false) {
        const definitionRoot = getDefinitionListNormalizationRoot(element);
        window.setTimeout(() => normalizeExistingDefinitionLists(definitionRoot), 0);
    }
    
    // Process each paragraph
    elementsToProcess.forEach(elem => {
        // Skip if element is inside a heading
        if (elem.closest('h1, h2, h3, h4, h5, h6')) {
            return;
        }
        
        // Check if we've already processed this element (pass docPath for reprocess check)
        if (pluginStateManager.isElementProcessed(elem, 'pem-processed', docPath)) {
            return;
        }
        
        // Process text nodes in the element
        processElementTextNodes(elem, parser, renderer, config, docPath, validationLines);
        
        // Mark element as processed
        pluginStateManager.markElementProcessed(elem, 'pem-processed', true);
    });
    
    // Process superscripts and subscripts across the entire element
    if (config.enableSuperSubscripts) {
        processSuperSub(element, {
            enableSuperscript: config.enableSuperscript !== false,
            enableSubscript: config.enableSubscript !== false
        });
    }
    
    // Process custom label lists if More Extended Syntax is enabled
    if (config.enableCustomLabelLists) {
        const counters = pluginStateManager.getDocumentCounters(docPath);
        processCustomLabelLists(element, context, counters.placeholderContext);
    }
}

function getDefinitionListNormalizationRoot(element: HTMLElement): HTMLElement {
    return element.closest('.el-p, .markdown-preview-section') as HTMLElement || element;
}

/**
 * Processes all text nodes within a DOM element to transform Pandoc syntax into rendered HTML.
 * Uses a tree walker to find text nodes, parses them for Pandoc patterns, validates in strict mode,
 * and replaces the nodes with rendered elements while maintaining document structure.
 * 
 * @param elem - The DOM element containing text nodes to process
 * @param parser - ReadingModeParser instance for syntax parsing
 * @param renderer - ReadingModeRenderer instance for DOM generation
 * @param config - Processor configuration including strict mode settings
 * @param docPath - Document path for state management and counter tracking
 * @param validationLines - Array of document lines for strict mode validation
 * @throws Does not throw exceptions - handles malformed nodes gracefully
 * @example
 * processElementTextNodes(paragraphEl, parser, renderer, config, '/path/doc.md', lines);
 */
function processElementTextNodes(
    elem: Element,
    parser: ReadingModeParser,
    renderer: ReadingModeRenderer,
    config: ProcessorConfig,
    docPath: string,
    validationLines: string[]
): void {
    if (config.enableDefinitionLists !== false &&
        elem.nodeName === 'P' &&
        processDefinitionListParagraph(elem, parser, renderer, config, docPath)) {
        return;
    }

    // Get all text nodes in this element
    const walker = document.createTreeWalker(
        elem,
        NodeFilter.SHOW_TEXT,
        null
    );
    
    const nodesToProcess: Text[] = [];
    while (walker.nextNode()) {
        nodesToProcess.push(walker.currentNode as Text);
    }
    
    // Process each text node
    nodesToProcess.forEach(node => {
        const parent = node.parentNode;
        if (!parent) return;
        
        // Skip if parent is a code block
        if (parent.nodeName === 'CODE' || parent.nodeName === 'PRE') {
            return;
        }
        
        const text = node.textContent || '';
        
        // Quick check if text contains our patterns
        if (!containsPandocSyntax(text, config)) {
            return;
        }
        
        const isInParagraph = parent.nodeName === 'P';
        
        // Check if this text node is at the beginning of the paragraph
        // If it's not the first child, it's likely after an inline element like <strong>
        // In that case, (@a) should be treated as a reference, not an example list
        const isAtParagraphStart = parent.firstChild === node;
        
        const lines = text.split('\n');
        
        // Parse all lines with additional context
        const parsedLines = parser.parseLines(lines, isInParagraph, isAtParagraphStart, config);
        
        // Validate if needed
        if (config.strictPandocMode) {
            parsedLines.forEach((parsedLine, index) => {
                if (parsedLine.type === 'fancy' && validationLines.length > 0) {
                    if (!validateListInStrictMode(lines[index], validationLines, config)) {
                        // Change to plain text if validation fails
                        parsedLine.type = 'plain';
                    }
                }
            });
        }
        
        // Create render context with state access
        const renderContext: RenderContext = {
            strictLineBreaks: config.strictLineBreaks,
            getExampleNumber: (label: string) => 
                pluginStateManager.getLabeledExampleNumber(docPath, label),
            getExampleContent: (label: string) => 
                pluginStateManager.getLabeledExampleContent(docPath, label)
        };
        
        // Number provider for counters
        const numberProvider = (type: string, index: number): number => {
            const parsedLine = parsedLines[index];
            
            if (type === 'hash') {
                return pluginStateManager.incrementHashCounter(docPath);
            }
            
            if (type === 'example' && parsedLine.type === 'example') {
                const metadata = parsedLine.metadata as ExampleListData;
                const number = pluginStateManager.incrementExampleCounter(docPath);
                
                // Store labeled examples
                if (metadata.label) {
                    pluginStateManager.setLabeledExample(
                        docPath, 
                        metadata.label, 
                        number, 
                        metadata.content?.trim()
                    );
                }
                
                return number;
            }
            
            return 0;
        };
        
        // Render the parsed lines
        const newElements = renderer.renderLines(parsedLines, renderContext, numberProvider);
        
        // Replace the text node with new elements
        if (newElements.length > 0) {
            newElements.forEach(elem => {
                parent.insertBefore(elem, node);
            });
            parent.removeChild(node);
        }
    });
}

function processDefinitionListParagraph(
    elem: Element,
    parser: ReadingModeParser,
    renderer: ReadingModeRenderer,
    config: ProcessorConfig,
    docPath: string
): boolean {
    const text = getTextWithLineBreaks(elem);
    if (!text.includes('\n')) {
        return false;
    }

    const lines = text.split('\n');
    const parsedLines = parser.parseLines(lines, true, true, config);
    if (!isStandaloneDefinitionList(parsedLines)) {
        return false;
    }

    const renderContext: RenderContext = {
        strictLineBreaks: config.strictLineBreaks,
        getExampleNumber: (label: string) =>
            pluginStateManager.getLabeledExampleNumber(docPath, label),
        getExampleContent: (label: string) =>
            pluginStateManager.getLabeledExampleContent(docPath, label)
    };
    const rendered = renderer.renderLines(parsedLines, renderContext);
    elem.replaceChildren(...rendered);
    return true;
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

function isStandaloneDefinitionList(parsedLines: ReturnType<ReadingModeParser['parseLines']>): boolean {
    const lines = parsedLines.filter(line => line.content.trim().length > 0);
    let index = 0;
    let hasDefinitionGroup = false;

    while (index < lines.length) {
        if (lines[index].type !== 'definition-term') {
            return false;
        }

        index++;
        let itemCount = 0;
        while (lines[index]?.type === 'definition-item') {
            itemCount++;
            index++;
        }

        if (itemCount === 0) {
            return false;
        }
        hasDefinitionGroup = true;
    }

    return hasDefinitionGroup;
}

function containsPandocSyntax(text: string, config?: ProcessorConfig): boolean {
    const hasBasicSyntax = (config?.enableHashLists !== false && !!ListPatterns.isHashList(text)) ||
           (config?.enableFancyLists !== false && !!ListPatterns.isFancyList(text)) ||
           (config?.enableExampleLists !== false && !!ListPatterns.isExampleList(text)) ||
           (config?.enableDefinitionLists !== false && !!ListPatterns.isDefinitionMarker(text)) ||
           (config?.enableExampleLists !== false && ListPatterns.findExampleReferences(text).length > 0);
    
    // Check for custom label syntax if enabled
    const hasCustomLabelSyntax = config?.enableCustomLabelLists && 
           (ListPatterns.isCustomLabelList(text) || 
            ListPatterns.findCustomLabelReferences(text).length > 0);
    
    return hasBasicSyntax || hasCustomLabelSyntax;
}

/**
 * Validates whether a list line complies with strict Pandoc formatting rules.
 * Searches for the line within the document context and applies validation
 * rules for proper spacing and formatting around lists and headings.
 * 
 * @param line - The individual line to validate for Pandoc compliance
 * @param documentLines - Complete array of document lines for context analysis
 * @param config - Processor configuration containing strict mode settings
 * @returns True if the line passes strict validation or if line cannot be found
 * @throws Does not throw exceptions - returns true for unfindable lines
 * @example
 * const isValid = validateListInStrictMode('A. First item', docLines, config);
 * // Returns false if missing required empty lines around the list
 */
function validateListInStrictMode(
    line: string,
    documentLines: string[],
    config: ProcessorConfig
): boolean {
    // Find line in document
    let lineNum = -1;
    for (let i = 0; i < documentLines.length; i++) {
        if (documentLines[i].includes(line.trim())) {
            lineNum = i;
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
    
    return true; // Allow if we can't find the line
}
