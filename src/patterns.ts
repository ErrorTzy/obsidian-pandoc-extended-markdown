/**
 * Centralized regex patterns for the Pandoc Lists plugin.
 * These patterns are pre-compiled and cached for better performance.
 */

export class ListPatterns {
    // Base patterns as static readonly properties
    static readonly HASH_LIST = /^(\s*)(#\.)(\s+)/;
    static readonly FANCY_LIST = /^(\s*)(([A-Z]+|[a-z]+|[IVXLCDM]+|[ivxlcdm]+)([.)]))(\s+)/;
    static readonly EXAMPLE_LIST = /^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)/;
    static readonly EXAMPLE_REFERENCE = /\(@([a-zA-Z0-9_-]+)\)/g;
    static readonly DEFINITION_MARKER = /^([~:])(\s+)/;
    static readonly DEFINITION_MARKER_WITH_INDENT = /^(\s*)([~:])(\s+)/;
    static readonly DEFINITION_INDENTED = /^(    |\t)/;
    static readonly NUMBERED_LIST = /^(\s*)([0-9]+[.)])/;
    static readonly UNORDERED_LIST = /^(\s*)[-*+]\s+/;
    static readonly CAPITAL_LETTER_LIST = /^(\s*)([A-Z])(\.)(\s+)/;
    static readonly ROMAN_NUMERALS = /^[IVXLCDM]+$/;
    static readonly LOWER_ROMAN_NUMERALS = /^[ivxlcdm]+$/;
    
    // Cache for compiled patterns
    private static compiledPatterns = new Map<string, RegExp>();
    
    /**
     * Get a cached RegExp pattern by name.
     * This allows for lazy compilation and caching of patterns.
     */
    static getPattern(name: keyof typeof ListPatterns): RegExp {
        if (!this.compiledPatterns.has(name)) {
            const pattern = this[name] as RegExp;
            if (pattern instanceof RegExp) {
                this.compiledPatterns.set(name, new RegExp(pattern));
            }
        }
        return this.compiledPatterns.get(name) || this[name] as RegExp;
    }
    
    /**
     * Test if a line matches a hash list pattern.
     */
    static isHashList(line: string): RegExpMatchArray | null {
        return line.match(this.HASH_LIST);
    }
    
    /**
     * Test if a line matches a fancy list pattern.
     */
    static isFancyList(line: string): RegExpMatchArray | null {
        const match = line.match(this.FANCY_LIST);
        // Exclude regular numbered lists
        if (match && !line.match(this.NUMBERED_LIST)) {
            return match;
        }
        return null;
    }
    
    /**
     * Test if a line matches an example list pattern.
     */
    static isExampleList(line: string): RegExpMatchArray | null {
        return line.match(this.EXAMPLE_LIST);
    }
    
    /**
     * Test if a line matches a definition marker pattern.
     */
    static isDefinitionMarker(line: string): RegExpMatchArray | null {
        return line.match(this.DEFINITION_MARKER);
    }
    
    /**
     * Test if a line is indented (for definition list content).
     */
    static isIndentedContent(line: string): boolean {
        return this.DEFINITION_INDENTED.test(line);
    }
    
    /**
     * Find all example references in a text.
     */
    static findExampleReferences(text: string): RegExpMatchArray[] {
        const matches: RegExpMatchArray[] = [];
        const regex = new RegExp(this.EXAMPLE_REFERENCE.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match);
        }
        return matches;
    }
    
    /**
     * Check if a string is a roman numeral.
     */
    static isRomanNumeral(str: string): boolean {
        return this.ROMAN_NUMERALS.test(str) || this.LOWER_ROMAN_NUMERALS.test(str);
    }
    
    /**
     * Check if a line is any type of list item.
     */
    static isListItem(line: string): boolean {
        return !!(
            this.isHashList(line) ||
            this.isFancyList(line) ||
            this.isExampleList(line) ||
            this.isDefinitionMarker(line) ||
            line.match(this.UNORDERED_LIST) ||
            line.match(this.NUMBERED_LIST)
        );
    }
}