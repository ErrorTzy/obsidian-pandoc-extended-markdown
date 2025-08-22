export const LIST_MARKERS = {
    DEFINITION_COLON: ':',
    DEFINITION_TILDE: '~',
    EXAMPLE_START: '(@',
    EXAMPLE_END: ')',
    HASH_NUMBERED: '#.',
    UNORDERED_DASH: '-',
    UNORDERED_STAR: '*',
    UNORDERED_PLUS: '+',
} as const;

export const INDENTATION = {
    TAB_SIZE: 4,
    MIN_INDENT: 0,
    MAX_INDENT: 40,
    SINGLE_SPACE: 1,
    DOUBLE_SPACE: 2,
    TAB: '\t',
    FOUR_SPACES: '    ',
} as const;

export const CSS_CLASSES = {
    // Fancy List Classes
    FANCY_LIST: 'pandoc-list-fancy',
    FANCY_LIST_UPPER_ALPHA: 'pandoc-list-upper-alpha',
    FANCY_LIST_LOWER_ALPHA: 'pandoc-list-lower-alpha',
    FANCY_LIST_UPPER_ROMAN: 'pandoc-list-upper-roman',
    FANCY_LIST_LOWER_ROMAN: 'pandoc-list-lower-roman',
    FANCY_LIST_PAREN: 'pandoc-list-paren',
    
    // Definition List Classes
    DEFINITION_LIST: 'pandoc-definition-list',
    DEFINITION_TERM: 'pandoc-definition-term',
    DEFINITION_DESC: 'pandoc-list-definition-desc',
    DEFINITION_ITEMS: 'pandoc-definition-items',
    DEFINITION_CONTENT_TEXT: 'pandoc-definition-content-text',
    
    // Example List Classes
    EXAMPLE_REF: 'pandoc-example-reference',
    EXAMPLE_LIST: 'pandoc-example-list',
    EXAMPLE_ITEM: 'pandoc-example-item',
    EXAMPLE_DUPLICATE: 'pandoc-example-duplicate',
    
    // Superscript and Subscript Classes
    SUPERSCRIPT: 'pandoc-superscript',
    SUBSCRIPT: 'pandoc-subscript',
    
    // Suggestion Classes
    SUGGESTION_CONTENT: 'pandoc-suggestion-content',
    SUGGESTION_TITLE: 'pandoc-suggestion-title',
    SUGGESTION_PREVIEW: 'pandoc-suggestion-preview',
    SUGGESTION_NUMBER: 'pandoc-suggestion-number',
    SUGGESTION_PLACEHOLDER: 'pandoc-suggestion-placeholder',
    
    // CodeMirror Classes
    LIST_LINE: 'HyperMD-list-line',
    LIST_LINE_1: 'HyperMD-list-line-1',
    CM_LIST_1: 'cm-list-1',
    CM_FORMATTING: 'cm-formatting',
    CM_FORMATTING_LIST: 'cm-formatting-list',
    CM_FORMATTING_LIST_OL: 'cm-formatting-list-ol',
    LIST_NUMBER: 'list-number',
    DEFINITION_TERM_DECORATION: 'cm-pandoc-definition-term',
    DEFINITION_PARAGRAPH: 'cm-pandoc-definition-paragraph',
    
    // Generic Classes
    PANDOC_LIST_MARKER: 'pandoc-list-marker',
    PANDOC_LIST_LINE_INDENT: 'pandoc-list-line-indent',
    
    // Custom Label Classes
    CUSTOM_LABEL_PROCESSED: 'pandoc-custom-label-processed',
    CUSTOM_LABEL_ITEM: 'pandoc-custom-label-item',
    CUSTOM_LABEL_REFERENCE_PROCESSED: 'pandoc-custom-label-reference-processed',
    CUSTOM_LABEL_REF_CLICKABLE: 'pandoc-custom-label-ref-clickable',
    CUSTOM_LABEL_PLACEHOLDER: 'pandoc-custom-label-placeholder',
    INLINE_PLACEHOLDER_NUMBER: 'pandoc-inline-placeholder-number',
} as const;

export const DECORATION_STYLES = {
    HASH_LIST_INDENT: 29,
    EXAMPLE_LIST_INDENT: 35,
    FANCY_LIST_INDENT_MULTIPLIER: 7,
    LINE_TRUNCATION_LIMIT: 100,
    TOOLTIP_DELAY_MS: 300,
    CUSTOM_LABEL_PREFIX_LENGTH: 3, // Length of "{::" prefix
} as const;

export const MESSAGES = {
    // Success messages
    FORMAT_SUCCESS: 'Document formatted to pandoc standard',
    FORMAT_ALREADY_COMPLIANT: 'Document already follows pandoc standard',
    PANDOC_COMPLIANT: 'Document follows pandoc formatting standards',
    TOGGLE_BOLD_SUCCESS: 'Definition terms bold style toggled',
    TOGGLE_UNDERLINE_SUCCESS: 'Definition terms underline style toggled',
    
    // Error messages
    NO_DEFINITION_TERMS: 'No definition terms found to toggle',
    
    // Formatting issue messages
    FORMATTING_ISSUES: (count: number) => `Found ${count} formatting issues`,
} as const;

export const COMMANDS = {
    CHECK_PANDOC: 'check-pandoc-formatting',
    FORMAT_PANDOC: 'format-to-pandoc-standard',
    TOGGLE_DEFINITION_BOLD: 'toggle-definition-bold-style',
    TOGGLE_DEFINITION_UNDERLINE: 'toggle-definition-underline-style',
} as const;

export const SETTINGS = {
    STRICT_MODE: 'strictPandocMode',
    AUTO_RENUMBER: 'autoRenumberLists',
} as const;

export const UI_CONSTANTS = {
    NOTICE_DURATION_MS: 10000,
    STATE_TRANSITION_DELAY_MS: 100,
} as const;

// Helper function to create fancy list type class names
export function getFancyListClass(type: string): string {
    return `pandoc-list-${type}`;
}