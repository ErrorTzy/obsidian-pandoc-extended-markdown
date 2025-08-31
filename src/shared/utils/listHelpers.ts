import { ListPatterns } from '../patterns';
import { ROMAN_NUMERALS } from '../../core/constants';

// Helper function to get the next letter in sequence
export function getNextLetter(letter: string): string | null {
    if (letter === 'Z' || letter === 'z') {
        return null; // No next letter after Z
    }
    return String.fromCharCode(letter.charCodeAt(0) + 1);
}

// Helper function to convert letter to number (A=1, B=2, etc.)
export function letterToNumber(letter: string): number {
    const upperLetter = letter.toUpperCase();
    return upperLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}

// Helper function to convert number to letter (1=A, 2=B, etc.)
export function numberToLetter(num: number, isUpperCase: boolean): string {
    const letter = String.fromCharCode('A'.charCodeAt(0) + num - 1);
    return isUpperCase ? letter : letter.toLowerCase();
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

// Helper function to get the next roman numeral
export function getNextRoman(roman: string): string {
    const value = romanToInt(roman);
    const isUpperCase = roman[0] === roman[0].toUpperCase();
    return intToRoman(value + 1, isUpperCase);
}

// Helper function to check if a line is empty (only contains the list marker)
export function isEmptyListItem(line: string): boolean {
    // Check hash lists
    if (line.match(ListPatterns.EMPTY_HASH_LIST)) return true;
    
    // Check fancy lists
    if (line.match(ListPatterns.EMPTY_FANCY_LIST)) return true;
    
    // Note: We do NOT check for empty example lists here
    // (@) is a valid list marker (unlabeled example) and should continue to next item
    // The only time (@) should be deleted is when cursor is between @ and )
    // which is handled by the special case in handleListEnter
    
    // Check custom label lists
    if (line.match(ListPatterns.EMPTY_CUSTOM_LABEL_LIST_NO_LABEL)) return true;
    
    // Check definition lists
    if (line.match(ListPatterns.EMPTY_DEFINITION_LIST)) return true;
    
    return false;
}