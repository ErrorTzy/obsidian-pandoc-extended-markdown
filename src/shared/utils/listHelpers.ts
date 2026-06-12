import { ListPatterns } from '../patterns';
import { ROMAN_NUMERALS } from '../../core/constants';

// Helper function to convert letter to number (A=1, B=2, etc.)
export function letterToNumber(letter: string): number {
    const upperLetter = letter.toUpperCase();
    return upperLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}

// Helper function to convert roman numeral to integer
export function romanToInt(roman: string): number {
    const romanValues = ROMAN_NUMERALS.VALUES;
    
    let value = 0;
    let i = 0;
    const normalizedRoman = roman.toLowerCase();
    
    while (i < normalizedRoman.length) {
        if (i + 1 < normalizedRoman.length && romanValues[normalizedRoman.substring(i, i + 2)]) {
            value += romanValues[normalizedRoman.substring(i, i + 2)];
            i += 2;
        } else {
            value += romanValues[normalizedRoman[i]] || 0;
            i++;
        }
    }
    
    return value;
}

// Helper function to convert integer to roman numeral
export function intToRoman(num: number, isUpperCase: boolean): string {
    let result = '';
    const table = isUpperCase ? ROMAN_NUMERALS.TO_ROMAN_UPPER : ROMAN_NUMERALS.TO_ROMAN_LOWER;
    
    for (const [value, sym] of table) {
        while (num >= value) {
            result += sym;
            num -= value;
        }
    }
    
    return result;
}

// Helper function to check if a line is empty (only contains the list marker)
export function isEmptyListItem(line: string): boolean {
    // Check hash lists
    if (line.match(ListPatterns.EMPTY_HASH_LIST)) return true;
    
    // Check fancy lists
    if (line.match(ListPatterns.EMPTY_FANCY_LIST)) return true;

    // Check decimal ordered lists
    if (line.match(ListPatterns.EMPTY_DECIMAL_ORDERED_LIST)) return true;

    // Check unordered lists
    if (line.match(ListPatterns.EMPTY_UNORDERED_LIST)) return true;
    
    // Note: We do NOT check for empty example lists here
    // (@) is a valid list marker (unlabeled example) and should continue to next item
    // The only time (@) should be deleted is when cursor is between @ and )
    // which is handled by the special case in handleListEnter
    
    // Custom label placeholders are handled only when the cursor is inside {::}.
    
    // Check definition lists
    if (line.match(ListPatterns.EMPTY_DEFINITION_LIST)) return true;
    
    return false;
}
