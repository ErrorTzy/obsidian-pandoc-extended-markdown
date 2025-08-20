import { MarkdownPostProcessorContext } from 'obsidian';
import { parseFancyListMarker } from './fancyListParser';
import { parseExampleListMarker } from './exampleListParser';
import { parseDefinitionListMarker } from './definitionListParser';
import { processSuperSub } from './superSubParser';
import { PandocExtendedMarkdownSettings } from '../settings';
import { isStrictPandocList, ValidationContext } from '../pandocValidator';
import { getSectionInfo } from '../types/obsidian-extended';
import { CSS_CLASSES } from '../constants';
import { ListPatterns } from '../patterns';

export function processReadingMode(element: HTMLElement, context: MarkdownPostProcessorContext, settings: PandocExtendedMarkdownSettings) {
    // Only process paragraphs and list items, not headings or other elements
    const elementsToProcess = element.querySelectorAll('p, li');
    
    // Get section info for strict mode validation with fallback
    const section = element.closest('.markdown-preview-section') as HTMLElement;
    const sectionInfo = getSectionInfo(section);
    let fullText = '';
    let lines: string[] = [];
    
    if (sectionInfo?.text) {
        fullText = sectionInfo.text;
        lines = fullText.split('\n');
    } else {
        // Fallback: extract text from the element itself
        fullText = element.textContent || '';
        lines = fullText.split('\n');
    }
    
    // Build example reference map first
    const exampleMap = new Map<string, number>();
    let exampleCounter = 1;
    
    // Scan all text for example markers
    elementsToProcess.forEach(elem => {
        const text = elem.textContent || '';
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const exampleInfo = parseExampleListMarker(line);
            if (exampleInfo) {
                if (exampleInfo.label && !exampleMap.has(exampleInfo.label)) {
                    exampleMap.set(exampleInfo.label, exampleCounter);
                    exampleCounter++;
                } else if (!exampleInfo.label) {
                    exampleCounter++;
                }
            }
        });
    });

    // Process each paragraph and list item
    elementsToProcess.forEach(elem => {
        // Skip if element is inside a heading
        if (elem.closest('h1, h2, h3, h4, h5, h6')) {
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
            
            // Skip if parent is a code block or similar
            if (parent.nodeName === 'CODE' || parent.nodeName === 'PRE') {
                return;
            }
            
            const text = node.textContent || '';
            
            // Only process if text contains our patterns
            const hasCustomSyntax = 
                ListPatterns.isFancyList(text) ||
                ListPatterns.isExampleList(text) ||
                ListPatterns.isDefinitionMarker(text) ||
                ListPatterns.findExampleReferences(text).length > 0;
            
            if (!hasCustomSyntax) {
                return;
            }
            
            const lines = text.split('\n');
            const newElements: (HTMLElement | Text)[] = [];
            
            lines.forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    newElements.push(document.createTextNode('\n'));
                }
                
                // Only process definition terms if they're followed by a definition
                let isDefinitionTerm = false;
                if (lineIndex < lines.length - 1) {
                    const nextLine = lines[lineIndex + 1];
                    if (nextLine && ListPatterns.isDefinitionMarker(nextLine)) {
                        isDefinitionTerm = true;
                    }
                }
                
                // Check for fancy list markers (but not regular numbers)
                const fancyMarker = parseFancyListMarker(line);
                if (fancyMarker) {
                    // In strict mode, validate the list formatting
                    if (settings.strictPandocMode && lines.length > 0) {
                        // Try to find the line number in the original text
                        let lineNum = -1;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes(line.trim())) {
                                lineNum = i;
                                break;
                            }
                        }
                        
                        if (lineNum >= 0) {
                            const validationContext: ValidationContext = {
                                lines: lines,
                                currentLine: lineNum
                            };
                            
                            if (!isStrictPandocList(validationContext, settings.strictPandocMode)) {
                                // Don't render as fancy list in strict mode if invalid
                                newElements.push(document.createTextNode(line));
                                return;
                            }
                        }
                    }
                    
                    const span = document.createElement('span');
                    span.className = `${CSS_CLASSES.FANCY_LIST}-${fancyMarker.type}`;
                    span.textContent = fancyMarker.marker + ' ';
                    newElements.push(span);
                    
                    const rest = line.substring(fancyMarker.indent.length + fancyMarker.marker.length + 1);
                    if (rest) {
                        newElements.push(document.createTextNode(rest));
                    }
                    return;
                }
                
                // Check for example list markers
                const exampleMarker = parseExampleListMarker(line);
                if (exampleMarker) {
                    let number = 1;
                    if (exampleMarker.label && exampleMap.has(exampleMarker.label)) {
                        number = exampleMap.get(exampleMarker.label)!;
                    }
                    
                    const span = document.createElement('span');
                    span.className = CSS_CLASSES.EXAMPLE_LIST;
                    span.textContent = `(${number}) `;
                    newElements.push(span);
                    
                    const rest = line.substring(exampleMarker.indent.length + exampleMarker.originalMarker.length + 1);
                    if (rest) {
                        newElements.push(document.createTextNode(rest));
                    }
                    return;
                }
                
                // Check for definition list markers
                const defMarker = parseDefinitionListMarker(line);
                if (defMarker && defMarker.type === 'definition') {
                    const span = document.createElement('span');
                    span.textContent = '• ';
                    newElements.push(span);
                    newElements.push(document.createTextNode(defMarker.content));
                    return;
                } else if (isDefinitionTerm && line.trim() && !ListPatterns.isDefinitionMarker(line)) {
                    const strong = document.createElement('strong');
                    const u = document.createElement('u');
                    u.textContent = line;
                    strong.appendChild(u);
                    newElements.push(strong);
                    return;
                }
                
                // Process example references inline
                const refRegex = /\(@([a-zA-Z0-9_-]+)\)/g;
                let lastIndex = 0;
                let match;
                let hasReferences = false;
                
                while ((match = refRegex.exec(line)) !== null) {
                    hasReferences = true;
                    if (match.index > lastIndex) {
                        newElements.push(document.createTextNode(line.substring(lastIndex, match.index)));
                    }
                    
                    const label = match[1];
                    if (exampleMap.has(label)) {
                        const span = document.createElement('span');
                        span.className = CSS_CLASSES.EXAMPLE_REF;
                        span.textContent = `(${exampleMap.get(label)})`;
                        newElements.push(span);
                    } else {
                        newElements.push(document.createTextNode(match[0]));
                    }
                    
                    lastIndex = match.index + match[0].length;
                }
                
                if (hasReferences && lastIndex < line.length) {
                    newElements.push(document.createTextNode(line.substring(lastIndex)));
                } else if (!hasReferences) {
                    newElements.push(document.createTextNode(line));
                }
            });
            
            // Only replace if we actually created new elements
            if (newElements.length > 0) {
                newElements.forEach(elem => {
                    parent.insertBefore(elem, node);
                });
                parent.removeChild(node);
            }
        });
    });
    
    // Process superscripts and subscripts across the entire element
    processSuperSub(element);
}