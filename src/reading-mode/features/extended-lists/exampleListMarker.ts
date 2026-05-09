import { ListPatterns } from '../../../shared/patterns';

export interface ExampleListInfo {
    indent: string;
    originalMarker: string;
    label?: string;
}

/**
 * Parses a line to extract example list marker information.
 * Example lists use the syntax (@label) or (@) for unlabeled examples.
 * 
 * @param line - The text line to parse for example list markers
 * @returns ExampleListInfo object with parsed marker data, or null if no valid marker found
 * @throws Does not throw exceptions - returns null for invalid input
 * @example
 * const info = parseExampleListMarker('  (@theorem) This is an example');
 * // Returns: { indent: '  ', originalMarker: '(@theorem)', label: 'theorem' }
 */
export function parseExampleListMarker(line: string): ExampleListInfo | null {
    const match = ListPatterns.isExampleList(line);
    
    if (!match) {
        return null;
    }
    
    return {
        indent: match[1],
        originalMarker: match[2],
        label: match[3] || undefined
    };
}
