import { MarkdownPostProcessorContext } from 'obsidian';
import { CSS_CLASSES } from '../constants';
import { ListPatterns } from '../patterns';

export interface CustomLabelInfo {
    indent: string;
    originalMarker: string;
    label: string;
}

export function parseCustomLabelMarker(line: string): CustomLabelInfo | null {
    const match = ListPatterns.isCustomLabelList(line);
    
    if (!match) {
        return null;
    }
    
    return {
        indent: match[1],
        originalMarker: match[2],
        label: match[3]
    };
}

export function isValidCustomLabel(label: string): boolean {
    return ListPatterns.isValidCustomLabel(label);
}

/**
 * Process custom label lists in reading mode.
 * Handles both single-line and multi-line custom label blocks
 */
export function processCustomLabelLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    // Skip if element has no text content with custom labels
    if (!element.textContent || !element.textContent.includes('{::')) {
        return;
    }
    
    // Process paragraphs
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
        processElement(p);
    });
    
    // Process list items
    const listItems = element.querySelectorAll('li');
    listItems.forEach(li => {
        processElement(li);
        // Add class if it contains a custom label list marker
        if (li.querySelector(`.${CSS_CLASSES.PANDOC_LIST_MARKER}`)) {
            li.classList.add('pandoc-custom-label-item');
        }
    });
}

function processTextNode(node: Node, container: HTMLElement): void {
    const text = node.textContent || '';
    
    // Check if this text starts with a custom label list pattern
    const listMatch = text.match(ListPatterns.CUSTOM_LABEL_LIST_WITH_CONTENT);
    
    if (listMatch) {
        // This is a list marker at the start of a line
        const indent = listMatch[1];
        const label = listMatch[3];
        const space = listMatch[4];
        const rest = listMatch[5];
        
        // Add indent text if present
        if (indent) {
            container.appendChild(document.createTextNode(indent));
        }
        
        // Create marker span
        const markerSpan = document.createElement('span');
        markerSpan.className = CSS_CLASSES.PANDOC_LIST_MARKER;
        markerSpan.textContent = `(${label})`;
        container.appendChild(markerSpan);
        
        // Add space
        container.appendChild(document.createTextNode(space));
        
        // Process remaining text for references
        processReferencesInText(rest, container);
    } else {
        // Not a list marker, process all text for references
        processReferencesInText(text, container);
    }
}

function processReferencesInText(text: string, container: HTMLElement): void {
    const refPattern = /\{::([a-zA-Z][a-zA-Z0-9_']*)\}/g;
    let lastIndex = 0;
    let match;
    
    while ((match = refPattern.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        
        // Create reference span
        const refSpan = document.createElement('span');
        refSpan.className = CSS_CLASSES.EXAMPLE_REF;
        refSpan.setAttribute('data-custom-label-ref', match[1]);
        refSpan.textContent = `(${match[1]})`;
        container.appendChild(refSpan);
        
        lastIndex = refPattern.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
}

function processElement(elem: Element) {
    // Skip code blocks and pre elements
    if (elem.querySelector('code, pre') || elem.closest('code, pre')) {
        return;
    }
    
    // Skip if no custom labels in text content
    if (!elem.textContent || !elem.textContent.includes('{::')) {
        return;
    }
    
    // Create a new container to build the processed content
    const newContainer = document.createElement('div');
    
    // Process each child node
    const childNodes = Array.from(elem.childNodes);
    
    for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            // Process text nodes line by line
            const text = node.textContent || '';
            const lines = text.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) {
                    // Add line break between lines
                    newContainer.appendChild(document.createTextNode('\n'));
                }
                
                if (lines[i]) {
                    processTextNode({ textContent: lines[i] } as Node, newContainer);
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
            // Preserve BR elements
            newContainer.appendChild(node.cloneNode(true));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // For other elements, recursively process if they contain custom labels
            const elemNode = node as Element;
            if (elemNode.textContent && elemNode.textContent.includes('{::')) {
                // Clone the element and process its content
                const clonedElem = elemNode.cloneNode(false) as Element;
                
                // Process the element's children
                const tempContainer = document.createElement('div');
                Array.from(elemNode.childNodes).forEach(child => {
                    tempContainer.appendChild(child.cloneNode(true));
                });
                processElement(tempContainer);
                
                // Move processed content to cloned element
                while (tempContainer.firstChild) {
                    clonedElem.appendChild(tempContainer.firstChild);
                }
                
                newContainer.appendChild(clonedElem);
            } else {
                // No custom labels, just clone the element
                newContainer.appendChild(node.cloneNode(true));
            }
        } else {
            // Other node types (comments, etc.) - preserve as is
            newContainer.appendChild(node.cloneNode(true));
        }
    }
    
    // Replace the element's content with processed content
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
    while (newContainer.firstChild) {
        elem.appendChild(newContainer.firstChild);
    }
}