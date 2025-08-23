/**
 * Reading Mode Processor
 * 
 * Coordinates parsing, state management, and rendering for reading mode.
 * This is now a thin orchestration layer that delegates to specialized modules.
 */

import { MarkdownPostProcessorContext } from 'obsidian';
import { ReadingModeParser, ExampleListData } from './readingModeParser';
import { ReadingModeRenderer, RenderContext } from '../renderers/readingModeRenderer';
import { pluginStateManager } from '../state/pluginStateManager';
import { ProcessorConfig } from '../types/processorConfig';
import { processSuperSub } from './superSubParser';
import { processCustomLabelLists } from './customLabelListParser';
import { isStrictPandocFormatting, ValidationContext } from '../pandocValidator';
import { getSectionInfo } from '../types/obsidian-extended';
import { ListPatterns } from '../patterns';

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