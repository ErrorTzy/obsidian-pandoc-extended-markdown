// External libraries
import { MarkdownPostProcessorContext, setTooltip } from 'obsidian';

// Types
import { getSectionInfo } from '../../shared/types/obsidian-extended';

// Constants
import { CSS_CLASSES, DECORATION_STYLES } from '../../core/constants';

// Patterns
import { ListPatterns } from '../../shared/patterns';

export interface ExampleListInfo {
    indent: string;
    originalMarker: string;
    label?: string;
}

/**
 * Parses a line to extract example list marker information.
 * Example lists use the syntax (@label) or (@) for unlabeled examples.
 * 
 * @param line - The text line to parse for example list markers
 * @returns ExampleListInfo object with parsed marker data, or null if no valid marker found
 * @throws Does not throw exceptions - returns null for invalid input
 * @example
 * const info = parseExampleListMarker('  (@theorem) This is an example');
 * // Returns: { indent: '  ', originalMarker: '(@theorem)', label: 'theorem' }
 */
export function parseExampleListMarker(line: string): ExampleListInfo | null {
    const match = ListPatterns.isExampleList(line);
    
    if (!match) {
        return null;
    }
    
    return {
        indent: match[1],
        originalMarker: match[2],
        label: match[3] || undefined
    };
}

/**
 * Processes HTML elements to identify and render Pandoc-style example lists.
 * Uses a two-pass algorithm: first assigns sequential numbers to all examples,
 * then processes references to maintain consistent numbering across the document.
 * 
 * @param element - The HTML element containing potential example lists
 * @param context - Markdown post-processor context from Obsidian for accessing source text
 * @throws Does not throw exceptions - handles malformed input gracefully
 * @example
 * // Processes markdown like:
 * // (@theorem) E = mc^2
 * // See (@theorem) for the mass-energy equivalence.
 * processExampleLists(sectionElement, context);
 */
export function processExampleLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const exampleMap = new Map<string, number>();
    const exampleContent = new Map<string, string>();
    const allExamplesMap = new Map<string, number>(); // Maps full example text to number
    let exampleCounter = 1;
    
    const section = element.closest('.markdown-preview-section') as HTMLElement;
    if (!section) return;
    
    // Try to get section info with fallback
    const sectionInfo = getSectionInfo(section);
    let lines: string[] = [];
    
    if (sectionInfo?.text) {
        lines = sectionInfo.text.split('\n');
    } else {
        // Fallback: extract text from the element
        const fullText = element.textContent || '';
        lines = fullText.split('\n');
    }
    
    if (lines.length === 0) return;
    
    // First pass: assign numbers to all examples (labeled and unlabeled)
    const lineNumberToExample = new Map<number, number>();
    
    lines.forEach((line, index) => {
        const exampleInfo = parseExampleListMarker(line);
        if (exampleInfo) {
            // Store the full line text to number mapping
            const lineContent = line.trim();
            allExamplesMap.set(lineContent, exampleCounter);
            
            if (exampleInfo.label && !exampleMap.has(exampleInfo.label)) {
                exampleMap.set(exampleInfo.label, exampleCounter);
                // Extract content after the marker
                const match = ListPatterns.isExampleList(line);
                if (match) {
                    // Content is everything after the match
                    const contentStart = match[0].length;
                    const content = line.substring(contentStart).trim();
                    if (content) {
                        exampleContent.set(exampleInfo.label, content);
                    }
                }
            }
            // Store line number to example number mapping for all examples
            lineNumberToExample.set(index, exampleCounter);
            exampleCounter++;
        }
    });
    
    const lists = element.querySelectorAll('ol');
    lists.forEach((list) => {
        processExampleOrderedList(list, exampleMap, allExamplesMap);
    });
    
    processExampleReferences(element, exampleMap, exampleContent);
}

function processExampleOrderedList(list: HTMLOListElement, exampleMap: Map<string, number>, allExamplesMap: Map<string, number>) {
    const items = list.querySelectorAll('li');
    if (items.length === 0) return;
    
    const section = list.closest('.markdown-preview-section') as HTMLElement;
    if (!section) return;
    
    // Try to get section info with fallback
    const sectionInfo = getSectionInfo(section);
    let lines: string[] = [];
    
    if (sectionInfo?.text) {
        lines = sectionInfo.text.split('\n');
    } else {
        // Fallback: extract text from the list element
        const fullText = list.textContent || '';
        lines = fullText.split('\n');
    }
    
    // Check if this list contains example markers by examining the text content
    let hasExampleMarker = false;
    let listStartNumber: number | null = null;
    let currentExampleNumber = 1;
    
    // Find the starting number for this list by looking for the first item in our map
    const firstItemText = items[0]?.textContent?.trim() || '';
    if (firstItemText && allExamplesMap.has(firstItemText)) {
        currentExampleNumber = allExamplesMap.get(firstItemText)!;
        listStartNumber = currentExampleNumber;
    }
    
    // Process each list item
    items.forEach((item, index) => {
        const itemText = item.textContent?.trim() || '';
        const exampleInfo = parseExampleListMarker(itemText);
        
        if (exampleInfo) {
            hasExampleMarker = true;
            
            // Try to find the number from our pre-computed map
            let number: number;
            if (allExamplesMap.has(itemText)) {
                // Use the pre-computed number from the first pass
                number = allExamplesMap.get(itemText)!;
            } else {
                // Fallback: use sequential numbering
                number = currentExampleNumber + index;
            }
            
            if (index === 0 && !listStartNumber) {
                listStartNumber = number;
            }
            
            item.setAttribute('data-example-number', String(number));
            item.classList.add(CSS_CLASSES.EXAMPLE_ITEM);
            
            // Update the map if this is a labeled example (for references)
            if (exampleInfo.label && !exampleMap.has(exampleInfo.label)) {
                exampleMap.set(exampleInfo.label, number);
            }
        }
    });
    
    if (hasExampleMarker && listStartNumber !== null) {
        list.classList.add(CSS_CLASSES.EXAMPLE_LIST);
        list.setAttribute('start', String(listStartNumber));
    }
}

function processExampleReferences(element: HTMLElement, exampleMap: Map<string, number>, exampleContent: Map<string, string>) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: () => NodeFilter.FILTER_ACCEPT
        }
    );
    
    const nodesToReplace: { node: Text; matches: RegExpMatchArray[] }[] = [];
    
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = node.textContent || '';
        const regex = ListPatterns.EXAMPLE_REFERENCE;
        const matches: RegExpMatchArray[] = [];
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            matches.push(match);
        }
        
        if (matches.length > 0) {
            nodesToReplace.push({ node, matches });
        }
    }
    
    nodesToReplace.forEach(({ node, matches }) => {
        const parent = node.parentNode;
        if (!parent) return;
        
        let lastIndex = 0;
        const fragments: (string | HTMLElement)[] = [];
        
        matches.forEach(match => {
            const label = match[1];
            const number = exampleMap.get(label);
            
            if (number !== undefined && node.textContent) {
                fragments.push(node.textContent.substring(lastIndex, match.index));
                
                const span = document.createElement('span');
                span.className = CSS_CLASSES.EXAMPLE_REF;
                span.setAttribute('data-example-ref', label);
                span.textContent = `(${number})`;
                
                // Add tooltip if content is available
                const tooltipText = exampleContent.get(label);
                if (tooltipText) {
                    setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
                }
                
                fragments.push(span);
                
                lastIndex = match.index + match[0].length;
            }
        });
        
        if (node.textContent && lastIndex < node.textContent.length) {
            fragments.push(node.textContent.substring(lastIndex));
        }
        
        fragments.forEach(fragment => {
            if (typeof fragment === 'string') {
                parent.insertBefore(document.createTextNode(fragment), node);
            } else {
                parent.insertBefore(fragment, node);
            }
        });
        
        parent.removeChild(node);
    });
}