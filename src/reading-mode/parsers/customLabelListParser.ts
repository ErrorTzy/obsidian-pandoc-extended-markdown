import { MarkdownPostProcessorContext } from 'obsidian';
import { CSS_CLASSES } from '../../core/constants';
import { ListPatterns } from '../../shared/patterns';
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';

export interface CustomLabelInfo {
    indent: string;
    originalMarker: string;
    label: string;
    processedLabel?: string;  // Label after placeholder processing
}

export function parseCustomLabelMarker(line: string, placeholderContext?: PlaceholderContext): CustomLabelInfo | null {
    const match = ListPatterns.isCustomLabelList(line);
    
    if (!match) {
        return null;
    }
    
    const rawLabel = match[3];
    
    // Validate the label using the same logic as isValidCustomLabel
    if (!isValidCustomLabel(rawLabel)) {
        return null;
    }
    
    const processedLabel = placeholderContext ? placeholderContext.processLabel(rawLabel) : rawLabel;
    
    const result: CustomLabelInfo = {
        indent: match[1],
        originalMarker: match[2],
        label: rawLabel
    };
    
    // Only add processedLabel if it's different from the raw label
    if (processedLabel !== rawLabel) {
        result.processedLabel = processedLabel;
    }
    
    return result;
}

export function isValidCustomLabel(label: string): boolean {
    // Label must not be empty and can contain any characters except }
    if (!label || label.trim().length === 0 || label.includes('}')) {
        return false;
    }
    
    // If it contains placeholder syntax, it's valid (placeholders can have spaces and special chars)
    if (label.includes('(#')) {
        return true;
    }
    
    // For non-placeholder labels, maintain backward compatibility
    // Allow: letters, numbers, underscores, primes (')
    // Disallow: spaces, angle brackets, pipes, backslashes, forward slashes, and other special chars
    return ListPatterns.VALID_CUSTOM_LABEL_SIMPLE.test(label);
}

/**
 * Process custom label lists in reading mode.
 * Handles both single-line and multi-line custom label blocks
 */
export function processCustomLabelLists(element: HTMLElement, context: MarkdownPostProcessorContext, placeholderContext?: PlaceholderContext) {
    // Skip if element has no text content with custom labels
    if (!element.textContent || !element.textContent.includes('{::')) {
        return;
    }
    
    // First pass: Scan all custom label list markers to build the context
    // This ensures the placeholder context knows about all labels before processing references
    if (placeholderContext) {
        const allElements = element.querySelectorAll('p, li');
        allElements.forEach(elem => {
            const text = elem.textContent || '';
            // Split into lines to check each line
            const lines = text.split('\n');
            for (const line of lines) {
                // Check if this line starts with a custom label list marker
                const listMatch = ListPatterns.CUSTOM_LABEL_LIST_WITH_CONTENT.exec(line);
                if (listMatch) {
                    const labelPart = listMatch[3];
                    // This is a list marker, process it to register in context
                    placeholderContext.processLabel(labelPart);
                }
            }
        });
    }
    
    // Second pass: Process paragraphs and list items with the complete context
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
        processElement(p, placeholderContext);
    });
    
    // Process list items
    const listItems = element.querySelectorAll('li');
    listItems.forEach(li => {
        processElement(li, placeholderContext);
        // Add class if it contains a custom label list marker
        if (li.querySelector(`.${CSS_CLASSES.PANDOC_LIST_MARKER}`)) {
            li.classList.add('pandoc-custom-label-item');
        }
    });
}

function processTextNode(node: Node, container: HTMLElement, placeholderContext?: PlaceholderContext): void {
    const text = node.textContent || '';
    
    // Check if this text starts with a custom label list pattern
    const listMatch = text.match(ListPatterns.CUSTOM_LABEL_LIST_WITH_CONTENT);
    
    if (listMatch) {
        // This is a list marker at the start of a line
        const indent = listMatch[1];
        const rawLabel = listMatch[3];
        const space = listMatch[4];
        const rest = listMatch[5];
        
        // Process placeholders in the label
        const processedLabel = placeholderContext ? placeholderContext.processLabel(rawLabel) : rawLabel;
        
        // Add indent text if present
        if (indent) {
            container.appendChild(document.createTextNode(indent));
        }
        
        // Create marker span
        const markerSpan = document.createElement('span');
        markerSpan.className = CSS_CLASSES.PANDOC_LIST_MARKER;
        markerSpan.textContent = `(${processedLabel})`;
        container.appendChild(markerSpan);
        
        // Add space
        container.appendChild(document.createTextNode(space));
        
        // Process remaining text for references
        processReferencesInText(rest, container, placeholderContext);
    } else {
        // Not a list marker, process all text for references
        processReferencesInText(text, container, placeholderContext);
    }
}

function processReferencesInText(text: string, container: HTMLElement, placeholderContext?: PlaceholderContext): void {
    const refPattern = ListPatterns.CUSTOM_LABEL_REFERENCE;
    let lastIndex = 0;
    let match;
    
    while ((match = refPattern.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        
        // Create reference span
        const rawLabel = match[1];
        const processedLabel = placeholderContext ? placeholderContext.getProcessedLabel(rawLabel) : rawLabel;
        
        // If the label is undefined (null), leave it as raw text
        if (processedLabel === null) {
            container.appendChild(document.createTextNode(match[0]));
        } else {
            const refSpan = document.createElement('span');
            refSpan.className = CSS_CLASSES.EXAMPLE_REF;
            refSpan.setAttribute('data-custom-label-ref', processedLabel);
            refSpan.textContent = `(${processedLabel})`;
            container.appendChild(refSpan);
        }
        
        lastIndex = refPattern.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
}

function processElement(elem: Element, placeholderContext?: PlaceholderContext) {
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
                    processTextNode({ textContent: lines[i] } as Node, newContainer, placeholderContext);
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
                processElement(tempContainer, placeholderContext);
                
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