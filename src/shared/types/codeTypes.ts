/**
 * Type definitions for code region detection and processing
 */

/**
 * Represents a region of code that should not be processed by syntax processors
 */
export interface CodeRegion {
    /** Starting position of the code region in the document */
    from: number;
    /** Ending position of the code region in the document */
    to: number;
    /** Type of code region - either a multi-line code block or inline code */
    type: 'codeblock' | 'inline-code';
}