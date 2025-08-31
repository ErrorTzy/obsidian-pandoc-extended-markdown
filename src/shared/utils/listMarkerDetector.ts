import { ListMarkerInfo } from '../types/listTypes';

import { ListPatterns } from '../patterns';
import { NUMERIC_CONSTANTS, LIST_MARKERS, LIST_TYPES } from '../../core/constants';

import { getNextLetter, getNextRoman } from './listHelpers';

/**
 * Types of list markers that can be detected
 */
export type ListType = 'hash' | 'custom-label' | 'letter' | 'roman' | 'example' | 'definition' | 'unknown';

/**
 * Parsed components of a list marker
 */
export interface MarkerComponents {
    type: ListType;
    indent: string;
    marker: string;
    punctuation?: string;
    spaces: string;
}

/**
 * Context information for determining list type
 */
export interface ListContext {
    currentLine: string;
    allLines?: string[];
    currentLineIndex?: number;
}

/**
 * Parse a line to extract its marker components.
 * 
 * This function examines a line of text and identifies the type of list marker present,
 * extracting the relevant components (indentation, marker text, punctuation, spaces).
 * 
 * @param line - The line of text to parse
 * @returns The parsed marker components, or null if no list marker is found
 * 
 * @example
 * ```typescript
 * parseMarkerParts("  A. some content");
 * // Returns: { type: 'unknown', indent: '  ', marker: 'A', punctuation: '.', spaces: ' ' }
 * 
 * parseMarkerParts("#. hash list item");
 * // Returns: { type: 'hash', indent: '', marker: '#.', spaces: ' ' }
 * ```
 */
function parseMarkerParts(line: string): MarkerComponents | null {
    // Check for hash auto-numbering
    const hashMatch = ListPatterns.isHashList(line);
    if (hashMatch) {
        return {
            type: 'hash',
            indent: hashMatch[1],
            marker: '#.',
            spaces: hashMatch[3]
        };
    }
    
    // Check for custom label lists
    const customLabelMatch = ListPatterns.isCustomLabelList(line);
    if (customLabelMatch) {
        return {
            type: 'custom-label',
            indent: customLabelMatch[1],
            marker: '{::}',
            spaces: customLabelMatch[4] // Group 4 is spaces in CUSTOM_LABEL_LIST pattern
        };
    }
    
    // Check for letters or roman numerals
    const listMatch = line.match(ListPatterns.LETTER_OR_ROMAN_LIST);
    if (listMatch) {
        return {
            type: 'unknown', // Will be determined by detectListType
            indent: listMatch[1],
            marker: listMatch[2],
            punctuation: listMatch[3],
            spaces: listMatch[4]
        };
    }
    
    // Check for example lists with required spaces
    const exampleMatch = line.match(ListPatterns.EXAMPLE_LIST);
    if (exampleMatch) {
        return {
            type: LIST_TYPES.EXAMPLE,
            indent: exampleMatch[1],
            marker: LIST_MARKERS.EXAMPLE_FULL,
            spaces: exampleMatch[4] // Group 4 is spaces in EXAMPLE_LIST pattern
        };
    }
    
    // Try optional space pattern if the first one didn't match
    const altMatch = line.match(ListPatterns.EXAMPLE_LIST_OPTIONAL_SPACE);
    if (altMatch && line.length > altMatch[0].length) {
        // There's content after the marker even without explicit spaces
        return {
            type: LIST_TYPES.EXAMPLE,
            indent: altMatch[1],
            marker: LIST_MARKERS.EXAMPLE_FULL,
            spaces: altMatch[3] || ' ' // Group 3 is spaces in EXAMPLE_LIST_OPTIONAL_SPACE pattern
        };
    }
    
    // Check for definition lists
    const definitionMatch = line.match(ListPatterns.DEFINITION_MARKER);
    if (definitionMatch) {
        return {
            type: LIST_TYPES.DEFINITION,
            indent: definitionMatch[1],
            marker: definitionMatch[2],
            spaces: definitionMatch[3]
        };
    }
    
    return null;
}

/**
 * Detect whether a letter/roman marker should be treated as alphabetic or roman.
 * 
 * This function analyzes marker components and their context to determine if an
 * ambiguous marker (like 'i' or 'v') should be interpreted as alphabetic or roman.
 * 
 * @param components - The parsed marker components
 * @param context - The context information including surrounding lines
 * @returns The determined list type ('letter', 'roman', or the original type if unambiguous)
 * 
 * @example
 * ```typescript
 * const components = { type: 'unknown', marker: 'i', ... };
 * const context = { currentLine: 'i. item', allLines: ['h. previous', 'i. current'], currentLineIndex: 1 };
 * detectListType(components, context); // Returns: 'letter' (alphabetic sequence)
 * ```
 */
function detectListType(components: MarkerComponents, context: ListContext): ListType {
    if (components.type !== 'unknown') {
        return components.type;
    }
    
    const { marker, indent, punctuation } = components;
    const { allLines, currentLineIndex } = context;
    
    // Multi-character patterns that are valid roman numerals are always roman
    if (marker.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER && marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
        return 'roman';
    }
    
    // Single character - need to check context
    if (marker.length === NUMERIC_CONSTANTS.SINGLE_CHARACTER && allLines && currentLineIndex !== undefined) {
        return detectSingleCharacterType(marker, indent, punctuation || '', allLines, currentLineIndex);
    }
    
    // Default fallback
    return 'letter';
}

/**
 * Detect the type of a single character marker by examining context.
 * 
 * For single character markers that could be either alphabetic or roman,
 * this function examines the surrounding context to make the determination.
 * 
 * @param marker - The single character marker
 * @param indent - The indentation of the current line
 * @param punctuation - The punctuation following the marker (. or ))
 * @param allLines - All lines in the document
 * @param currentLineIndex - Index of the current line
 * @returns The determined list type ('letter' or 'roman')
 */
function detectSingleCharacterType(
    marker: string,
    indent: string,
    punctuation: string,
    allLines: string[],
    currentLineIndex: number
): ListType {
    // Special case: 'I' or 'i' should default to roman unless preceded by 'H' or 'h'
    if (marker.match(ListPatterns.SINGLE_I)) {
        return detectIMarkerType(indent, punctuation, allLines, currentLineIndex);
    }
    
    // For other single characters, check context
    return detectGeneralSingleCharType(indent, punctuation, allLines, currentLineIndex);
}

/**
 * Detect type for 'I' or 'i' markers by checking for alphabetic sequence.
 * 
 * The letter 'I' is ambiguous as it can be both alphabetic (9th letter) and roman (1).
 * This function defaults to roman but checks if preceded by 'H' to determine alphabetic sequence.
 * 
 * @param indent - The indentation of the current line
 * @param punctuation - The punctuation following the marker
 * @param allLines - All lines in the document
 * @param currentLineIndex - Index of the current line
 * @returns 'roman' or 'letter' based on context analysis
 */
function detectIMarkerType(
    indent: string,
    punctuation: string,
    allLines: string[],
    currentLineIndex: number
): ListType {
    // Default to roman for 'I' or 'i'
    let isRoman = true;
    
    // Check if preceded by 'H' or 'h' - if so, it's alphabetic
    for (let i = currentLineIndex - 1; i >= NUMERIC_CONSTANTS.FIRST_INDEX; i--) {
        const prevLine = allLines[i];
        
        // Skip empty lines
        if (!prevLine.trim()) continue;
        
        // If we find a non-list line, stop looking
        if (!prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST)) break;
        
        const prevMatch = prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
        if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
            const prevMarker = prevMatch[2];
            
            // If preceded by 'H' or 'h', it's alphabetic
            if (prevMarker.match(ListPatterns.SINGLE_H)) {
                isRoman = false;
                break;
            }
            // If previous marker is multi-char roman, keep as roman
            else if (prevMarker.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                isRoman = true;
                break;
            }
            // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
            else if (!prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                isRoman = false;
                break;
            }
        }
    }
    
    return isRoman ? 'roman' : 'letter';
}

/**
 * Detect type for general single character markers.
 * 
 * For single character markers other than 'I'/'i', this function examines
 * previous markers in the same list to determine the pattern.
 * 
 * @param indent - The indentation of the current line
 * @param punctuation - The punctuation following the marker
 * @param allLines - All lines in the document
 * @param currentLineIndex - Index of the current line
 * @returns 'roman' or 'letter' based on context, defaults to 'letter'
 */
function detectGeneralSingleCharType(
    indent: string,
    punctuation: string,
    allLines: string[],
    currentLineIndex: number
): ListType {
    for (let i = currentLineIndex - 1; i >= NUMERIC_CONSTANTS.FIRST_INDEX; i--) {
        const prevLine = allLines[i];
        
        // Skip empty lines
        if (!prevLine.trim()) continue;
        
        // If we find a non-list line, stop looking
        if (!prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST)) break;
        
        const prevMatch = prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
        if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
            const prevMarker = prevMatch[2];
            
            // If previous marker is multi-char roman, this is roman too
            if (prevMarker.length > NUMERIC_CONSTANTS.SINGLE_CHARACTER && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                return 'roman';
            }
            // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
            else if (!prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                return 'letter';
            }
            // If we found 'A' or 'B' before, it's alphabetic
            else if (prevMarker.match(ListPatterns.SINGLE_AB)) {
                return 'letter';
            }
        }
    }
    
    // Default to alphabetic if no context found
    return 'letter';
}

/**
 * Increment a numeric (hash) list marker.
 * 
 * Hash markers (#.) are auto-numbered and don't change their marker text.
 * This function simply returns the same marker with preserved formatting.
 * 
 * @param components - The parsed marker components
 * @returns ListMarkerInfo with the same hash marker
 */
function incrementNumericMarker(components: MarkerComponents): ListMarkerInfo | null {
    return {
        marker: components.marker, // '#.' stays the same
        indent: components.indent,
        spaces: components.spaces
    };
}

/**
 * Increment an alphabetic list marker.
 * 
 * Advances the alphabetic marker to the next letter (A->B, b->c, etc.).
 * Returns null if already at the end of the alphabet (Z or z).
 * 
 * @param components - The parsed marker components containing the letter
 * @returns ListMarkerInfo with the next letter, or null if at end of alphabet
 * 
 * @example
 * ```typescript
 * incrementAlphabeticMarker({ marker: 'A', punctuation: '.', ... });
 * // Returns: { marker: 'B.', indent: '...', spaces: '...' }
 * ```
 */
function incrementAlphabeticMarker(components: MarkerComponents): ListMarkerInfo | null {
    const nextLetter = getNextLetter(components.marker);
    if (nextLetter) {
        return {
            marker: `${nextLetter}${components.punctuation}`,
            indent: components.indent,
            spaces: components.spaces
        };
    }
    return null; // Can't continue past Z
}

/**
 * Increment a roman numeral list marker.
 * 
 * Advances the roman numeral to the next value (i->ii, IV->V, etc.).
 * Validates that the marker is a proper roman numeral before incrementing.
 * 
 * @param components - The parsed marker components containing the roman numeral
 * @returns ListMarkerInfo with the next roman numeral, or null if invalid
 * 
 * @example
 * ```typescript
 * incrementRomanMarker({ marker: 'iv', punctuation: ')', ... });
 * // Returns: { marker: 'v)', indent: '...', spaces: '...' }
 * ```
 */
function incrementRomanMarker(components: MarkerComponents): ListMarkerInfo | null {
    // Validate and continue as roman
    if (components.marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
        const nextRoman = getNextRoman(components.marker);
        return {
            marker: `${nextRoman}${components.punctuation}`,
            indent: components.indent,
            spaces: components.spaces
        };
    }
    return null;
}

/**
 * Handle special cases for list markers (example, definition, custom label).
 * 
 * These marker types don't increment in the traditional sense - they maintain
 * their format for continuation. This includes example lists (@), definition
 * markers (:, ~), and custom label markers ({::}).
 * 
 * @param components - The parsed marker components
 * @returns ListMarkerInfo with the same marker, or null for unknown types
 * 
 * @example
 * ```typescript
 * handleSpecialCases({ type: 'example', marker: '(@)', ... });
 * // Returns: { marker: '(@)', indent: '...', spaces: '...' }
 * ```
 */
function handleSpecialCases(components: MarkerComponents): ListMarkerInfo | null {
    switch (components.type) {
        case 'example':
            return {
                marker: components.marker, // '(@)' stays the same
                indent: components.indent,
                spaces: components.spaces
            };
            
        case 'definition':
            return {
                marker: components.marker, // ':' or '~' stays the same
                indent: components.indent,
                spaces: components.spaces
            };
            
        case 'custom-label':
            return {
                marker: components.marker, // '{::}' stays the same
                indent: components.indent,
                spaces: components.spaces
            };
            
        default:
            return null;
    }
}

/**
 * Helper function to detect list type and get next marker.
 * 
 * Main entry point for list marker detection and increment logic.
 * Parses the current line, determines the list type, and returns the
 * appropriate next marker for list continuation.
 * 
 * @param currentLine - The current line containing a list marker
 * @param allLines - Optional array of all document lines for context analysis
 * @param currentLineIndex - Optional index of current line in allLines
 * @returns ListMarkerInfo for the next marker, or null if no valid continuation
 * 
 * @example
 * ```typescript
 * getNextListMarker("A. first item");
 * // Returns: { marker: 'B.', indent: '', spaces: ' ' }
 * 
 * getNextListMarker("  i. roman item", allLines, 5);
 * // Returns: { marker: 'ii.', indent: '  ', spaces: ' ' }
 * ```
 */
export function getNextListMarker(currentLine: string, allLines?: string[], currentLineIndex?: number): ListMarkerInfo | null {
    const context: ListContext = { currentLine, allLines, currentLineIndex };
    
    // Parse the marker components from the current line
    const components = parseMarkerParts(currentLine);
    if (!components) {
        return null;
    }
    
    // Detect the specific list type for ambiguous cases
    const listType = detectListType(components, context);
    components.type = listType;
    
    // Process different types of markers
    switch (listType) {
        case 'hash':
            return incrementNumericMarker(components);
            
        case 'letter':
            return incrementAlphabeticMarker(components);
            
        case 'roman':
            return incrementRomanMarker(components);
            
        case 'example':
        case 'definition':
        case 'custom-label':
            return handleSpecialCases(components);
            
        default:
            return null;
    }
}