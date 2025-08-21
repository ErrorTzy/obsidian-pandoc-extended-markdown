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
    static readonly DEFINITION_MARKER = /^(\s*)([~:])(\s+)/;
    static readonly DEFINITION_MARKER_WITH_INDENT = /^(\s*)([~:])(\s+)/;
    static readonly DEFINITION_INDENTED = /^(    |\t)/;
    static readonly NUMBERED_LIST = /^(\s*)([0-9]+[.)])/;
    static readonly UNORDERED_LIST = /^(\s*)[-*+]\s+/;
    static readonly CAPITAL_LETTER_LIST = /^(\s*)([A-Z])(\.)(\s+)/;
    static readonly ROMAN_NUMERALS = /^[IVXLCDM]+$/;
    static readonly LOWER_ROMAN_NUMERALS = /^[ivxlcdm]+$/;
    
    // Character type patterns for fancy list parsing
    static readonly ROMAN_UPPER = /^[IVXLCDM]+$/;
    static readonly ROMAN_LOWER = /^[ivxlcdm]+$/;
    static readonly ALPHA_UPPER = /^[A-Z]+$/;
    static readonly ALPHA_LOWER = /^[a-z]+$/;
    static readonly DECIMAL = /^[0-9]+$/;
    
    // Autocompletion patterns
    static readonly LETTER_OR_ROMAN_LIST = /^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)/;
    static readonly LETTER_OR_ROMAN_LIST_WITH_CONTENT = /^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s+)(.*)$/;
    static readonly LETTER_OR_ROMAN_OR_HASH_LIST = /^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+|#)([.)])(\s+)/;
    static readonly LETTER_OR_ROMAN_OR_HASH_LIST_WITH_CONTENT = /^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+|#)([.)])(\s+)(.*)$/;
    static readonly VALID_ROMAN_NUMERAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
    static readonly SINGLE_I = /^[Ii]$/;
    static readonly SINGLE_H = /^[Hh]$/;
    static readonly SINGLE_AB = /^[ABab]$/;
    static readonly SINGLE_ROMAN_CHAR = /^[IVXLCDM]$/i;
    static readonly ANY_ROMAN_CHARS = /^[ivxlcdmIVXLCDM]+$/i;
    static readonly ALPHABETIC_CHARS = /^[A-Za-z]+$/;
    static readonly EXAMPLE_LIST_OPTIONAL_SPACE = /^(\s*)\(@([a-zA-Z0-9_-]*)\)(\s*)/;
    static readonly NUMBERED_LIST_WITH_SPACE = /^\s*\d+[.)]\s/;
    static readonly DEFINITION_MARKER_ONLY = /^[~:]$/;
    
    // Empty list item patterns
    static readonly EMPTY_HASH_LIST = /^(\s*)(#\.)(\s*)$/;
    static readonly EMPTY_FANCY_LIST = /^(\s*)([A-Za-z]+|[ivxlcdmIVXLCDM]+)([.)])(\s*)$/;
    static readonly EMPTY_EXAMPLE_LIST = /^(\s*)\(@([a-zA-Z0-9_-]*)\)(\s*)$/;
    static readonly EMPTY_EXAMPLE_LIST_NO_LABEL = /^(\s*)\(@\)(\s*)$/;
    static readonly EMPTY_DEFINITION_LIST = /^(\s*)([~:])(\s*)$/;
    
    // Complex list patterns for autocompletion
    static readonly ANY_LIST_MARKER = /^(\s*)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\(@[a-zA-Z0-9_-]*\)|[~:])/;
    static readonly ANY_LIST_MARKER_WITH_SPACE = /^(\s*)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|@\([a-zA-Z0-9_-]*\)|[~:])(\s+)/;
    static readonly ANY_LIST_MARKER_WITH_INDENT_AND_SPACE = /^(\s+)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|@\([a-zA-Z0-9_-]*\)|[~:])(\s+)/;
    
    // Indentation patterns
    static readonly INDENT_ONLY = /^(\s*)/;
    
    // Text formatting patterns
    static readonly BOLD_TEXT = /^\*\*(.+)\*\*$/;
    
    // Superscript and subscript patterns
    // Matches ^text^ for superscript and ~text~ for subscript
    // Text can contain escaped spaces (\ ) but not unescaped spaces
    static readonly SUPERSCRIPT = /\^([^\^\s]|\\[ ])+?\^/g;
    static readonly SUBSCRIPT = /~([^~\s]|\\[ ])+?~/g;
    
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
    
    /**
     * Find all superscripts in a text.
     */
    static findSuperscripts(text: string): RegExpMatchArray[] {
        const matches: RegExpMatchArray[] = [];
        const regex = new RegExp(this.SUPERSCRIPT.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match);
        }
        return matches;
    }
    
    /**
     * Find all subscripts in a text.
     */
    static findSubscripts(text: string): RegExpMatchArray[] {
        const matches: RegExpMatchArray[] = [];
        const regex = new RegExp(this.SUBSCRIPT.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match);
        }
        return matches;
    }
}