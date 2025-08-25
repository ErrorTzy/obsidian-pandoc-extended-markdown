/**
 * Extended type definitions for Obsidian's internal APIs.
 * These are not officially documented but are used for compatibility.
 */

/**
 * Section information returned by getSection() method.
 */
export interface SectionInfo {
    text: string;
    lineStart: number;
    lineEnd: number;
    position?: {
        start: { line: number; col: number; offset: number };
        end: { line: number; col: number; offset: number };
    };
}

/**
 * Extended type for Obsidian's markdown preview section element.
 */
export interface MarkdownPreviewSection extends HTMLElement {
    /**
     * Gets section information for the current preview section.
     * This method may not be available in all Obsidian versions.
     */
    getSection?: () => SectionInfo | null;
}

/**
 * Type guard to check if an element is a MarkdownPreviewSection.
 */
export function isMarkdownPreviewSection(element: HTMLElement | null): element is MarkdownPreviewSection {
    return element !== null && element.classList.contains('markdown-preview-section');
}

/**
 * Safely get section information from an element.
 * Returns null if the element doesn't support getSection or if it fails.
 */
export function getSectionInfo(element: HTMLElement | null): SectionInfo | null {
    if (!isMarkdownPreviewSection(element)) {
        return null;
    }
    
    // Check if getSection method exists
    if (typeof element.getSection === 'function') {
        try {
            return element.getSection();
        } catch (error) {
            return null;
        }
    }
    
    return null;
}