import { MarkdownPostProcessorContext } from 'obsidian';
import { CSS_CLASSES } from '../../core/constants';
import { ListPatterns } from '../../shared/patterns';
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';
import { CustomLabelInfo } from '../../shared/types/listTypes';
import { createTextNodeWalker } from '../utils/domUtils';
import { processCustomLabelDefinitionParagraph } from './customLabelDefinitionRenderer';

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

export function processCustomLabelLists(element: HTMLElement, context: MarkdownPostProcessorContext, placeholderContext?: PlaceholderContext) {
    // Skip if element has no text content with custom labels
    if (!element.textContent || !element.textContent.includes('{::')) {
        return;
    }
    
    // First pass: Scan all custom label list markers to build the context
    // This ensures the placeholder context knows about all labels before processing references
    if (placeholderContext) {
        const allElements = getCandidateTextContainers(element);
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
    const paragraphs = getCandidateTextContainers(element)
        .filter((candidate): candidate is HTMLParagraphElement => candidate.tagName === 'P');
    paragraphs.forEach(p => {
        if (processCustomLabelDefinitionParagraph(p, placeholderContext, processReferencesInText)) {
            return;
        }
        processElement(p, placeholderContext);
    });
    
    // Process list items
    const listItems = getCandidateTextContainers(element)
        .filter((candidate): candidate is HTMLLIElement => candidate.tagName === 'LI');
    listItems.forEach(li => {
        processElement(li, placeholderContext);
        // Add class if it contains a custom label list marker
        if (li.querySelector(`.${CSS_CLASSES.PANDOC_LIST_MARKER}`)) {
            li.classList.add('pem-custom-label-item');
        }
    });
}

function getCandidateTextContainers(element: HTMLElement): Element[] {
    const descendants = Array.from(element.querySelectorAll('p, li'));
    if (element.matches('p, li')) {
        return [element, ...descendants];
    }

    return descendants;
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
        
        // Add indent text if present using safe methods
        if (indent) {
            container.appendChild(document.createTextNode(indent));
        }
        
        // Create marker span using safe methods
        const markerSpan = document.createElement('span');
        markerSpan.className = CSS_CLASSES.PANDOC_LIST_MARKER;
        markerSpan.textContent = `(${processedLabel})`;
        container.appendChild(markerSpan);
        
        // Add space using safe methods
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
        // Add text before the match using safe methods
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
            refSpan.className = CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED;
            refSpan.setAttribute('data-custom-label-ref', processedLabel);
            refSpan.textContent = `(${processedLabel})`;
            container.appendChild(refSpan);
        }
        
        lastIndex = refPattern.lastIndex;
    }
    
    // Add remaining text using safe methods
    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
}

function processElementPreservingSpans(elem: Element, placeholderContext?: PlaceholderContext): void {
    // Walk through text nodes only and process custom label references
    const walker = createTextNodeWalker(elem, (node) => {
                // Skip text nodes inside already-processed spans
                const parent = node.parentElement;
                if (parent && (
                    parent.className === CSS_CLASSES.EXAMPLE_REF ||
                    parent.className === CSS_CLASSES.PANDOC_LIST_MARKER ||
                    parent.className.includes('pem-list-fancy') ||
                    parent.className === CSS_CLASSES.EXAMPLE_LIST ||
                    parent.className === CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED ||
                    parent.tagName === 'STRONG' ||  // Skip text inside strong tags that might contain processed content
                    parent.tagName === 'EM'          // Skip text inside em tags that might contain processed content
                )) {
                    return NodeFilter.FILTER_SKIP;
                }
                // Also check if the parent's parent contains processed spans (for nested elements)
                const grandParent = parent?.parentElement;
                if (grandParent && (
                    grandParent.className === CSS_CLASSES.EXAMPLE_REF ||
                    grandParent.className === CSS_CLASSES.EXAMPLE_LIST
                )) {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            });
    
    const nodesToProcess: Text[] = [];
    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
        if (currentNode.textContent && currentNode.textContent.includes('{::')) {
            nodesToProcess.push(currentNode as Text);
        }
    }
    
    // Process each text node for custom label references only
    // Do NOT process other syntax like (@a) - those should already be handled
    nodesToProcess.forEach(textNode => {
        const text = textNode.textContent || '';
        const parent = textNode.parentNode;
        if (!parent) return;
        
        // Only process custom label references, not example references
        if (!text.includes('{::')) return;
        
        // Create a temporary container for processed content
        const tempContainer = document.createElement('span');
        processReferencesInText(text, tempContainer, placeholderContext);
        
        // Replace the text node with the processed content
        while (tempContainer.firstChild) {
            parent.insertBefore(tempContainer.firstChild, textNode);
        }
        parent.removeChild(textNode);
    });
}

/**
 * Checks if element should be skipped for processing
 */
function shouldSkipElement(elem: Element): boolean {
    // Skip code blocks and pre elements
    if (elem.querySelector('code, pre') || elem.closest('code, pre')) {
        return true;
    }

    // Skip if no custom labels in text content
    if (!elem.textContent || !elem.textContent.includes('{::')) {
        return true;
    }

    return false;
}

/**
 * Checks if element has already processed content
 */
function hasProcessedContent(elem: Element): boolean {
    return !!(elem.querySelector('span') ||
              elem.querySelector('strong') ||
              elem.querySelector('em'));
}

/**
 * Checks if a span element is already processed
 */
function isProcessedSpan(elemNode: Element): boolean {
    return elemNode.tagName === 'SPAN' &&
           (elemNode.className === CSS_CLASSES.EXAMPLE_REF ||
            elemNode.className === CSS_CLASSES.PANDOC_LIST_MARKER ||
            elemNode.className.includes('pem-list-fancy') ||
            elemNode.className === CSS_CLASSES.EXAMPLE_LIST ||
            elemNode.className === CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED);
}

/**
 * Processes a text node and appends to container
 */
function processTextNodeLines(
    node: Node,
    container: HTMLElement,
    placeholderContext?: PlaceholderContext
): void {
    const text = node.textContent || '';
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
            container.appendChild(document.createTextNode('\n'));
        }

        if (lines[i]) {
            processTextNode({ textContent: lines[i] } as Node, container, placeholderContext);
        }
    }
}

/**
 * Processes an element node and appends to container
 */
function processElementNode(
    node: Element,
    container: HTMLElement,
    placeholderContext?: PlaceholderContext
): void {
    if (isProcessedSpan(node)) {
        // Already-processed element, preserve it as-is
        container.appendChild(node.cloneNode(true));
    } else if (node.textContent && node.textContent.includes('{::')) {
        // Clone the element and process its content
        const clonedElem = node.cloneNode(false) as Element;

        // Process the element's children
        const tempContainer = document.createElement('div');
        Array.from(node.childNodes).forEach(child => {
            tempContainer.appendChild(child.cloneNode(true));
        });
        processElement(tempContainer, placeholderContext);

        // Move processed content to cloned element
        while (tempContainer.firstChild) {
            clonedElem.appendChild(tempContainer.firstChild);
        }

        container.appendChild(clonedElem);
    } else {
        // No custom labels, just clone the element
        container.appendChild(node.cloneNode(true));
    }
}

/**
 * Main function to process custom labels in an element
 */
function processElement(elem: Element, placeholderContext?: PlaceholderContext) {
    if (shouldSkipElement(elem)) {
        return;
    }

    // Use preserving method if element has processed content
    if (hasProcessedContent(elem)) {
        return processElementPreservingSpans(elem, placeholderContext);
    }

    // Create a new container to build the processed content
    const newContainer = document.createElement('div');

    // Process each child node
    const childNodes = Array.from(elem.childNodes);

    for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            processTextNodeLines(node, newContainer, placeholderContext);
        } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
            newContainer.appendChild(document.createElement('br'));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            processElementNode(node as Element, newContainer, placeholderContext);
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
