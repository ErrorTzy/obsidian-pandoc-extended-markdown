// External libraries
import { getSectionInfo } from 'obsidian';

/**
 * Extract lines of text from the section containing the given element
 * @param element The HTML element within a section
 * @returns Array of text lines, or null if section info cannot be obtained
 */
export function extractSectionLines(element: HTMLElement): string[] | null {
    const section = element.closest('.markdown-preview-section') as HTMLElement;
    if (!section) return null;

    const sectionInfo = getSectionInfo(section);
    if (!sectionInfo) return null;

    return sectionInfo.text.split('\n');
}

/**
 * Create a text node tree walker for traversing text content in an element
 * @param element The root element to traverse
 * @param filter Optional filter function for accepting/rejecting nodes
 * @returns A configured TreeWalker instance
 */
export function createTextNodeWalker(
    element: HTMLElement | Element,
    filter?: (node: Node) => number
): TreeWalker {
    return document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: filter || (() => NodeFilter.FILTER_ACCEPT)
        }
    );
}

/**
 * Create a tree walker that skips code blocks and math elements
 * @param element The root element to traverse
 * @returns A configured TreeWalker that skips code and math
 */
export function createSmartTextNodeWalker(element: HTMLElement | Element): TreeWalker {
    return createTextNodeWalker(element, (node) => {
        const parent = node.parentElement;
        if (parent && (
            parent.matches('code, .cm-math, .math, mjx-container') ||
            parent.closest('code, .cm-math, .math, mjx-container')
        )) {
            return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
    });
}