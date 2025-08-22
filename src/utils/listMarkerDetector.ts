import { ListPatterns } from '../patterns';
import { getNextLetter, getNextRoman } from './listHelpers';

export interface ListMarkerInfo {
    marker: string;
    indent: string;
    spaces?: string;
}

// Helper function to detect list type and get next marker
export function getNextListMarker(currentLine: string, allLines?: string[], currentLineIndex?: number): ListMarkerInfo | null {
    // Check for hash auto-numbering
    const hashMatch = ListPatterns.isHashList(currentLine);
    if (hashMatch) {
        return { marker: '#.', indent: hashMatch[1], spaces: hashMatch[3] };
    }
    
    // Check for custom label lists
    const customLabelMatch = ListPatterns.isCustomLabelList(currentLine);
    if (customLabelMatch) {
        const indent = customLabelMatch[1];
        const spaces = customLabelMatch[4]; // Group 4 is spaces in CUSTOM_LABEL_LIST pattern
        return { marker: '{::}', indent, spaces };
    }
    
    // Check for letters or roman numerals
    const listMatch = currentLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
    if (listMatch) {
        const indent = listMatch[1];
        const marker = listMatch[2];
        const punctuation = listMatch[3];
        const spaces = listMatch[4];
        
        // Determine if this is alphabetic or roman by looking at context
        let isRoman = false;
        
        // Multi-character patterns that are valid roman numerals are always roman
        if (marker.length > 1 && marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
            isRoman = true;
        }
        // Single character - need to check context
        else if (marker.length === 1 && allLines && currentLineIndex !== undefined) {
            // Special case: 'I' or 'i' should default to roman unless preceded by 'H' or 'h'
            if (marker.match(ListPatterns.SINGLE_I)) {
                // Default to roman for 'I' or 'i'
                isRoman = true;
                
                // Check if preceded by 'H' or 'h' - if so, it's alphabetic
                for (let i = currentLineIndex - 1; i >= 0; i--) {
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
                        else if (prevMarker.length > 1 && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
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
            } else {
                // For other single characters, check context
                for (let i = currentLineIndex - 1; i >= 0; i--) {
                    const prevLine = allLines[i];
                    
                    // Skip empty lines
                    if (!prevLine.trim()) continue;
                    
                    // If we find a non-list line, stop looking
                    if (!prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST)) break;
                    
                    const prevMatch = prevLine.match(ListPatterns.LETTER_OR_ROMAN_LIST);
                    if (prevMatch && prevMatch[1] === indent && prevMatch[3] === punctuation) {
                        const prevMarker = prevMatch[2];
                        
                        // If previous marker is multi-char roman, this is roman too
                        if (prevMarker.length > 1 && prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = true;
                            break;
                        }
                        // If previous marker is clearly alphabetic (not valid as roman), this is alphabetic
                        else if (!prevMarker.match(ListPatterns.ANY_ROMAN_CHARS)) {
                            isRoman = false;
                            break;
                        }
                        // If we found 'A' or 'B' before, it's alphabetic
                        else if (prevMarker.match(ListPatterns.SINGLE_AB)) {
                            isRoman = false;
                            break;
                        }
                    }
                }
            }
        }
        
        if (isRoman) {
            // Validate and continue as roman
            if (marker.match(ListPatterns.VALID_ROMAN_NUMERAL)) {
                const nextRoman = getNextRoman(marker);
                return { marker: `${nextRoman}${punctuation}`, indent, spaces };
            }
        } else {
            // Continue as alphabetic
            const nextLetter = getNextLetter(marker);
            if (nextLetter) {
                return { marker: `${nextLetter}${punctuation}`, indent, spaces };
            }
            return null; // Can't continue past Z
        }
    }
    
    // Check for example lists
    // Try both with required spaces and with optional spaces for better compatibility
    let exampleMatch = currentLine.match(ListPatterns.EXAMPLE_LIST);
    if (exampleMatch) {
        const indent = exampleMatch[1];
        const spaces = exampleMatch[4]; // Group 4 is spaces in EXAMPLE_LIST pattern
        return { marker: '(@)', indent, spaces };
    }
    
    // Try optional space pattern if the first one didn't match
    const altMatch = currentLine.match(ListPatterns.EXAMPLE_LIST_OPTIONAL_SPACE);
    if (altMatch && currentLine.length > altMatch[0].length) {
        // There's content after the marker even without explicit spaces
        const indent = altMatch[1];
        const spaces = altMatch[3] || ' '; // Group 3 is spaces in EXAMPLE_LIST_OPTIONAL_SPACE pattern
        return { marker: '(@)', indent, spaces };
    }
    
    // Check for definition lists
    const definitionMatch = currentLine.match(ListPatterns.DEFINITION_MARKER);
    if (definitionMatch) {
        const indent = definitionMatch[1];
        const marker = definitionMatch[2];
        const spaces = definitionMatch[3];
        return { marker, indent, spaces };
    }
    
    return null;
}