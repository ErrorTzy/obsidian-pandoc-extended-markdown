/**
 * Type definitions for code region detection and processing
 */

/**
 * Represents a region of code or math that should not be processed by syntax processors
 */
export interface CodeRegion {
    /** Starting position of the code/math region in the document */
    from: number;
    /** Ending position of the code/math region in the document */
    to: number;
    /** Type of region - code block, inline code, or math expression */
    type: 'codeblock' | 'inline-code' | 'math';
}