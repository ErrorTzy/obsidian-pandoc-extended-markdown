import { MarkdownPostProcessorContext, setTooltip } from 'obsidian';
import { getSectionInfo } from '../types/obsidian-extended';
import { CSS_CLASSES } from '../constants';
import { ListPatterns } from '../patterns';

export interface ExampleListInfo {
    indent: string;
    originalMarker: string;
    label?: string;
}

export function parseExampleListMarker(line: string): ExampleListInfo | null {
    const match = ListPatterns.isExampleList(line);
    
    if (!match) {
        return null;
    }
    
    return {
        indent: match[1],
        originalMarker: match[2],
        label: match[3]
    };
}

export function processExampleLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const exampleMap = new Map<string, number>();
    const exampleContent = new Map<string, string>();
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
    
    lines.forEach((line, index) => {
        const exampleInfo = parseExampleListMarker(line);
        if (exampleInfo) {
            if (exampleInfo.label && !exampleMap.has(exampleInfo.label)) {
                exampleMap.set(exampleInfo.label, exampleCounter);
                // Extract content after the marker
                const match = ListPatterns.isExampleList(line);
                if (match && match[1]) {
                    exampleContent.set(exampleInfo.label, match[1].trim());
                }
                exampleCounter++;
            } else if (!exampleInfo.label) {
                exampleCounter++;
            }
        }
    });
    
    const lists = element.querySelectorAll('ol');
    lists.forEach((list) => {
        processExampleOrderedList(list, exampleMap);
    });
    
    processExampleReferences(element, exampleMap, exampleContent);
}

function processExampleOrderedList(list: HTMLOListElement, exampleMap: Map<string, number>) {
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
    
    if (lines.length === 0) return;
    
    let hasExampleMarker = false;
    let listStartNumber: number | null = null;
    
    items.forEach((item, index) => {
        const sourcePos = item.getAttribute('data-line');
        if (!sourcePos) return;
        
        const lineNum = parseInt(sourcePos);
        if (lineNum >= lines.length) return;
        
        const line = lines[lineNum];
        const exampleInfo = parseExampleListMarker(line);
        
        if (exampleInfo) {
            hasExampleMarker = true;
            
            let number: number;
            if (exampleInfo.label && exampleMap.has(exampleInfo.label)) {
                number = exampleMap.get(exampleInfo.label)!;
            } else {
                const tempMap = new Map<string, number>();
                let tempCounter = 1;
                
                for (let i = 0; i <= lineNum; i++) {
                    const info = parseExampleListMarker(lines[i]);
                    if (info) {
                        if (info.label && !tempMap.has(info.label)) {
                            tempMap.set(info.label, tempCounter);
                            if (i === lineNum) {
                                number = tempCounter;
                            }
                            tempCounter++;
                        } else if (!info.label) {
                            if (i === lineNum) {
                                number = tempCounter;
                            }
                            tempCounter++;
                        }
                    }
                }
                number = tempCounter - 1;
            }
            
            if (index === 0) {
                listStartNumber = number;
            }
            
            item.setAttribute('data-example-number', String(number));
            item.classList.add(CSS_CLASSES.EXAMPLE_ITEM);
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
        null
    );
    
    const nodesToReplace: { node: Text; matches: RegExpMatchArray[] }[] = [];
    
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = node.textContent || '';
        const regex = /\(@([a-zA-Z0-9_-]+)\)/g;
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
            
            if (number !== undefined) {
                fragments.push(node.textContent!.substring(lastIndex, match.index));
                
                const span = document.createElement('span');
                span.className = CSS_CLASSES.EXAMPLE_REF;
                span.setAttribute('data-example-ref', label);
                span.textContent = `(${number})`;
                
                // Add tooltip if content is available
                const tooltipText = exampleContent.get(label);
                if (tooltipText) {
                    setTooltip(span, tooltipText, { delay: 300 });
                }
                
                fragments.push(span);
                
                lastIndex = match.index + match[0].length;
            }
        });
        
        if (lastIndex < node.textContent!.length) {
            fragments.push(node.textContent!.substring(lastIndex));
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