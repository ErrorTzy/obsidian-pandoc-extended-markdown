/**
 * Type definitions for list-related interfaces and types
 */

export type FancyListType = 'upper-alpha' | 'lower-alpha' | 'upper-roman' | 'lower-roman' | 'decimal' | 'hash';

export interface FancyListMarker {
    indent: string;
    marker: string;
    type: FancyListType;
    delimiter: '.' | ')' | '';
    value?: string;
}

/**
 * Suggestion data for custom label references with placeholder rendering
 */
export interface CustomLabelSuggestion {
    /** The raw label text as it appears in the document */
    label: string;
    /** The processed label with placeholders replaced by numbers */
    displayLabel: string | null;
    /** Information about placeholder replacements for rendering */
    placeholderParts: Array<{
        original: string;      // Original placeholder text like "(#a)"
        replacement: string;   // Replacement number like "1"
        index: number;        // Position in the original label
    }> | null;
    /** Preview text from the label's content */
    previewText: string;
}