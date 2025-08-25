/**
 * Type definitions for list-related interfaces and types
 */

export type FancyListType = 'upper-alpha' | 'lower-alpha' | 'upper-roman' | 'lower-roman' | 'decimal' | 'hash';

/**
 * List item for renumbering operations
 */
export interface ListItem {
    lineNum: number;
    marker: string;
    punctuation: string;
    spaces: string;
    content: string;
    isRoman: boolean;
    isAlpha: boolean;
}

/**
 * Validation context for pandoc formatting
 */
export interface ValidationContext {
    lines: string[];
    currentLine: number;
}

/**
 * Linting issue found during validation
 */
export interface LintingIssue {
    line: number;
    message: string;
}

/**
 * Custom label information for parsing
 */
export interface CustomLabelInfo {
    indent: string;
    originalMarker: string;
    label: string;
    processedLabel?: string;  // Label after placeholder processing
}

/**
 * Definition list structure
 */
export interface DefinitionList {
    terms: DefinitionTerm[];
}

/**
 * Definition term with associated definitions
 */
export interface DefinitionTerm {
    text: string;
    lineNumber: number;
    definitions: DefinitionItem[];
}

/**
 * Individual definition item
 */
export interface DefinitionItem {
    text: string;
    lineNumber: number;
    marker: string;
}

/**
 * List marker information for detection
 */
export interface ListMarkerInfo {
    marker: string;
    indent: string;
    spaces?: string;
}

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