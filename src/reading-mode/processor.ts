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
import { pluginStateManager } from '../core/state/pluginStateManager';
import { isStrictPandocFormatting, ValidationContext } from '../editor-extensions/pandocValidator';

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
    
    // Process each paragraph
    elementsToProcess.forEach(elem => {
        // Skip if element is inside a heading
        if (elem.closest('h1, h2, h3, h4, h5, h6')) {
            return;
        }
        
        // Check if we've already processed this element (pass docPath for reprocess check)
        if (pluginStateManager.isElementProcessed(elem, 'pandoc-processed', docPath)) {
            return;
        }
        
        // Process text nodes in the element
        processElementTextNodes(elem, parser, renderer, config, docPath, validationLines);
        
        // Mark element as processed
        pluginStateManager.markElementProcessed(elem, 'pandoc-processed', true);
    });
    
    // Process superscripts and subscripts across the entire element
    if (config.enableSuperSubscripts) {
        processSuperSub(element);
    }
    
    // Process custom label lists if More Extended Syntax is enabled
    if (config.enableCustomLabelLists) {
        const counters = pluginStateManager.getDocumentCounters(docPath);
        processCustomLabelLists(element, context, counters.placeholderContext);
    }
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
        const lines = text.split('\n');
        
        // Parse all lines
        const parsedLines = parser.parseLines(lines, isInParagraph);
        
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

function containsPandocSyntax(text: string, config?: ProcessorConfig): boolean {
    const hasBasicSyntax = ListPatterns.isHashList(text) ||
           ListPatterns.isFancyList(text) ||
           ListPatterns.isExampleList(text) ||
           ListPatterns.isDefinitionMarker(text) ||
           ListPatterns.findExampleReferences(text).length > 0;
    
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