import { ListPatterns } from '../../../shared/patterns';

export interface DefinitionListMarker {
    type: 'term' | 'definition';
    indent: string;
    marker: string;
    content: string;
}

/**
 * Parses a line to identify definition list markers (terms or definition items).
 * Definition terms are identified by lines that end without markers, while
 * definition items are marked with ':' or '~' characters.
 * 
 * @param line - The text line to parse for definition list markers
 * @returns DefinitionListMarker object with parsed data, or null if not a definition marker
 * @throws Does not throw exceptions - returns null for invalid input
 * @example
 * const marker = parseDefinitionListMarker('  ~ This is a definition');
 * // Returns: { type: 'definition', indent: '  ', marker: '~', content: ' This is a definition' }
 */
export function parseDefinitionListMarker(line: string): DefinitionListMarker | null {
    const termMatch = line.match(ListPatterns.DEFINITION_TERM_PATTERN);
    if (termMatch && !line.includes('*') && !line.includes('-') && !line.match(ListPatterns.NUMBERED_LIST)) {
        const nextLineIndex = line.indexOf('\n');
        if (nextLineIndex === -1 || nextLineIndex === line.length - 1) {
            return {
                type: 'term',
                indent: '',
                marker: '',
                content: termMatch[1].trim()
            };
        }
    }
    
    // Allow spaces before the marker (e.g., "  ~ Definition" or "~ Definition")
    const defMatch = ListPatterns.isDefinitionMarker(line);
    if (defMatch) {
        // Extract content after the marker and spaces
        const content = line.substring(defMatch[0].length);
        return {
            type: 'definition',
            indent: defMatch[1],
            marker: defMatch[2],
            content: content
        };
    }
    
    return null;
}
