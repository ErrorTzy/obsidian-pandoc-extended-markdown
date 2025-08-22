import { ListPatterns } from '../patterns';

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
    const romanValues: { [key: string]: number } = {
        'i': 1, 'iv': 4, 'v': 5, 'ix': 9, 'x': 10,
        'xl': 40, 'l': 50, 'xc': 90, 'c': 100,
        'cd': 400, 'd': 500, 'cm': 900, 'm': 1000,
        'I': 1, 'IV': 4, 'V': 5, 'IX': 9, 'X': 10,
        'XL': 40, 'L': 50, 'XC': 90, 'C': 100,
        'CD': 400, 'D': 500, 'CM': 900, 'M': 1000
    };
    
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
    const intToRomanUpper: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    
    const intToRomanLower: [number, string][] = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    
    let result = '';
    const table = isUpperCase ? intToRomanUpper : intToRomanLower;
    
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