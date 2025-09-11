/**
 * Centralized regex patterns for the Pandoc Extended Markdown plugin.
 * These patterns are pre-compiled and cached for better performance.
 */

export class ListPatterns {
    // Base patterns as static readonly properties
    static readonly HASH_LIST = /^(\s*)(#\.)(\s+)/;
    static readonly FANCY_LIST = /^(\s*)(([A-Z]+|[a-z]+|[IVXLCDM]+|[ivxlcdm]+)([.)]))(\s+)/;
    static readonly EXAMPLE_LIST = /^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)/;
    static readonly EXAMPLE_LIST_WITH_CONTENT = /^(\s*)\(@([a-zA-Z0-9_-]+)\)\s+(.*)$/;
    static readonly EXAMPLE_REFERENCE = /\(@([a-zA-Z0-9_-]+)\)/g;
    static readonly DEFINITION_MARKER = /^(\s*)([~:])(\s+)/;
    static readonly DEFINITION_MARKER_WITH_INDENT = /^(\s*)([~:])(\s+)/;
    static readonly DEFINITION_INDENTED = /^(    |\t)/;
    static readonly DEFINITION_INDENTED_WITH_CONTENT = /^(    |\t)(.*)$/;
    static readonly DEFINITION_TERM_PATTERN = /^([^\n:~]+)$/;
    static readonly NUMBERED_LIST = /^(\s*)([0-9]+[.)])/;
    static readonly UNORDERED_LIST = /^(\s*)[-*+]\s+/;
    static readonly CAPITAL_LETTER_LIST = /^(\s*)([A-Z])(\.)(\s+)/;
    
    // Additional list patterns for validation
    static readonly STANDARD_ORDERED_LIST = /^(\s*)\d+\.\s+/;
    static readonly CAPITAL_LETTER_REPLACE = /^(\s*)([A-Z]\.)(\s+)/;
    static readonly UNLABELED_EXAMPLE_LIST = /^(\s*)\(@\)\s+/;
    
    // Combined fancy list pattern for validation (includes numbers)
    static readonly FANCY_LIST_WITH_NUMBERS = /^(\s*)(([A-Z]+|[a-z]+|[IVXLCDM]+|[ivxlcdm]+|[0-9]+|#)([.)]))(\s+)/;
    static readonly ROMAN_NUMERALS = /^[IVXLCDM]+$/;
    static readonly LOWER_ROMAN_NUMERALS = /^[ivxlcdm]+$/;
    
    // Character type patterns for fancy list parsing
    static readonly ROMAN_UPPER = /^[IVXLCDM]+$/;
    static readonly ROMAN_LOWER = /^[ivxlcdm]+$/;
    static readonly ALPHA_UPPER = /^[A-Z]+$/;
    static readonly ALPHA_LOWER = /^[a-z]+$/;
    static readonly DECIMAL = /^[0-9]+$/;
    
    // Code block detection patterns
    static readonly CODE_BLOCK_FENCE = /^(```|~~~).*$/gm;
    
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
    static readonly EMPTY_CUSTOM_LABEL_LIST = /^(\s*)(\{::([a-zA-Z][a-zA-Z0-9_']*)*\})(\s*)$/;
    static readonly EMPTY_CUSTOM_LABEL_LIST_NO_LABEL = /^(\s*)(\{::\})(\s*)$/;
    
    // Complex list patterns for autocompletion
    static readonly ANY_LIST_MARKER = /^(\s*)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\(@[a-zA-Z0-9_-]*\)|[~:]|\{::[a-zA-Z][a-zA-Z0-9_']*\})/;
    static readonly ANY_LIST_MARKER_WITH_SPACE = /^(\s*)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\(@[a-zA-Z0-9_-]*\)|[~:]|\{::[a-zA-Z][a-zA-Z0-9_']*\})(\s+)/;
    static readonly ANY_LIST_MARKER_WITH_INDENT_AND_SPACE = /^(\s+)(#\.|[A-Za-z]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\(@[a-zA-Z0-9_-]*\)|[~:]|\{::[a-zA-Z][a-zA-Z0-9_']*\})(\s+)/;
    
    // Indentation patterns
    static readonly INDENT_ONLY = /^(\s*)/;
    
    // Text formatting patterns
    static readonly BOLD_TEXT = /^\*\*(.+)\*\*$/;
    static readonly UNDERLINE_SPAN = /^<span class="underline">(.+)<\/span>$/;
    
    // Inline formatting patterns for parsing
    static readonly INLINE_FORMATTING_SPLIT = /(__(.+?)__|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*|`(.+?)`)/g;
    
    // Escaped space pattern
    static readonly ESCAPED_SPACE = /\\[ ]/g;
    
    // Example reference start pattern (for autocomplete)
    static readonly EXAMPLE_REF_START = /\(@/g;
    
    // Custom label reference start pattern (for autocomplete)
    static readonly CUSTOM_LABEL_REF_START = /\{::/g;
    
    // Heading patterns
    static readonly HEADING = /^#{1,6}\s+/;
    static readonly HEADING_WITH_CONTENT = /^(#{1,6})\s+(.*)$/;
    
    // Superscript and subscript patterns
    // Matches ^text^ for superscript and ~text~ for subscript
    // Text can contain escaped spaces (\ ) but not unescaped spaces
    static readonly SUPERSCRIPT = /\^([^\^\s]|\\[ ])+?\^/g;
    static readonly SUBSCRIPT = /~([^~\s]|\\[ ])+?~/g;
    
    /**
     * Inline superscript pattern for inline processors.
     * Excludes $ character to prevent matching across LaTeX math boundaries,
     * ensuring math expressions like $R^{+}_{xy}$ remain intact.
     */
    static readonly SUPERSCRIPT_INLINE = /\^([^^~\s$]+(?:\s+[^^~\s$]+)*)\^/g;
    
    /**
     * Inline subscript pattern for inline processors.
     * Excludes $ character to prevent matching across LaTeX math boundaries,
     * ensuring math expressions remain properly formatted.
     */
    static readonly SUBSCRIPT_INLINE = /~([^~^\s$]+(?:\s+[^~^\s$]+)*)~/g;
    
    // Custom label list patterns for More Extended Syntax
    // Matches {::LABEL} at start of line with required space after
    // Now supports placeholders like {::P(#first)} or pure placeholders like {::(#name)}
    static readonly CUSTOM_LABEL_LIST = /^(\s*)(\{::([^}]+)\})(\s+)/;
    static readonly CUSTOM_LABEL_LIST_WITH_CONTENT = /^(\s*)(\{::([^}]+)\})(\s+)(.*)$/;
    // Reference to custom label anywhere in text
    static readonly CUSTOM_LABEL_REFERENCE = /\{::([^}]+)\}/g;
    // Valid label pattern (for validation) - now accepts any non-empty content
    static readonly VALID_CUSTOM_LABEL = /^[^}]+$/;
    // Simple valid label pattern for validation
    static readonly VALID_CUSTOM_LABEL_SIMPLE = /^[a-zA-Z][a-zA-Z0-9_']*$/;
    // Placeholder pattern for auto-numbering
    static readonly PLACEHOLDER_PATTERN = /\(#([^)]+)\)/g;
    // Pure expression pattern for validation
    static readonly PURE_EXPRESSION_PATTERN = /^[A-Za-z]?[\s+\-*/,()'\d]*$/;
    // Trailing digits pattern for custom label processing
    static readonly TRAILING_DIGITS = /\d+$/;
    // Custom label placeholder pattern for inline matching
    static readonly CUSTOM_LABEL_PLACEHOLDER = /\(#([^)]+)\)/g;
    
    // Additional inline patterns
    static readonly TRAILING_QUOTES = /'+$/;
    static readonly BACKSLASH_ESCAPE = /\\/g;
    static readonly WHITESPACE_CLEANUP = /\s+/g;
    static readonly LETTER_MARKER_PATTERN = /^([A-Za-z]+)([.)])$/;
    static readonly ROMAN_MARKER_PATTERN = /^([ivxlcdmIVXLCDM]+)([.)])$/;
    static readonly PLACEHOLDER_LETTER_PATTERN = /\(#([a-z])\)/g;
    static readonly WHITESPACE_DOLLAR_CLEANUP = /\s+\$/g;
    static readonly FORMATTING_MARKER_START = /^(\*\*|__|\*|_|`)/;
    
    // Note: Patterns are already compiled as static readonly RegExp objects,
    // providing optimal performance without needing additional caching.
    
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
    
    /**
     * Test if a line matches a custom label list pattern.
     */
    static isCustomLabelList(line: string): RegExpMatchArray | null {
        return line.match(this.CUSTOM_LABEL_LIST);
    }
    
    /**
     * Test if a label is valid for custom label lists.
     */
    static isValidCustomLabel(label: string): boolean {
        return this.VALID_CUSTOM_LABEL.test(label);
    }
    
    /**
     * Find all custom label references in a text.
     */
    static findCustomLabelReferences(text: string): RegExpMatchArray[] {
        const matches: RegExpMatchArray[] = [];
        const regex = new RegExp(this.CUSTOM_LABEL_REFERENCE.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match);
        }
        return matches;
    }
    
    /**
     * Test if a line is a heading.
     */
    static isHeading(line: string): boolean {
        return this.HEADING.test(line);
    }
    
    /**
     * Test if text might be a definition term (not a marker or indented).
     */
    static isDefinitionTerm(line: string): boolean {
        const trimmed = line.trim();
        return trimmed !== '' && 
               !this.isDefinitionMarker(trimmed) && 
               !this.isIndentedContent(line);
    }
    
    /**
     * Extract letter and delimiter from a fancy list marker.
     */
    static extractLetterMarker(marker: string): RegExpMatchArray | null {
        return marker.match(this.LETTER_MARKER_PATTERN);
    }
    
    /**
     * Extract roman numeral and delimiter from a fancy list marker.
     */
    static extractRomanMarker(marker: string): RegExpMatchArray | null {
        return marker.match(this.ROMAN_MARKER_PATTERN);
    }
    
    /**
     * Check if text starts with a formatting marker.
     */
    static startsWithFormatting(text: string): boolean {
        return this.FORMATTING_MARKER_START.test(text);
    }
    
    /**
     * Remove trailing quotes from text.
     */
    static removeTrailingQuotes(text: string): string {
        return text.replace(this.TRAILING_QUOTES, '');
    }
    
    /**
     * Clean up whitespace and formatting in mathematical expressions.
     */
    static cleanMathExpression(text: string): string {
        return text.replace(this.BACKSLASH_ESCAPE, '').replace(this.WHITESPACE_CLEANUP, ' ').trim();
    }
    
    /**
     * Clean up whitespace before dollar signs in LaTeX.
     */
    static cleanWhitespaceBeforeDollar(content: string): string {
        return content.replace(this.WHITESPACE_DOLLAR_CLEANUP, '$');
    }
    
    /**
     * Replace placeholder letters with values.
     */
    static replacePlaceholderLetters(label: string, replaceFn: (match: string, letter: string) => string): string {
        return label.replace(this.PLACEHOLDER_LETTER_PATTERN, replaceFn);
    }
    
    /**
     * Get indent from a line.
     */
    static getIndent(line: string): string {
        const match = line.match(this.INDENT_ONLY);
        return match ? match[1] : '';
    }
    
    /**
     * Replace escaped spaces with regular spaces.
     */
    static unescapeSpaces(text: string): string {
        return text.replace(this.ESCAPED_SPACE, ' ');
    }
    
    /**
     * Find all example reference starts in text.
     */
    static findExampleRefStarts(text: string): RegExpMatchArray[] {
        return [...text.matchAll(this.EXAMPLE_REF_START)];
    }
    
    /**
     * Find all custom label reference starts in text.
     */
    static findCustomLabelRefStarts(text: string): RegExpMatchArray[] {
        return [...text.matchAll(this.CUSTOM_LABEL_REF_START)];
    }
    
    /**
     * Split text by inline formatting markers.
     */
    static splitByInlineFormatting(text: string): string[] {
        return text.split(this.INLINE_FORMATTING_SPLIT);
    }
}