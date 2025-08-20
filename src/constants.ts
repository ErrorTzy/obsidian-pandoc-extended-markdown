export const LIST_MARKERS = {
    DEFINITION_COLON: ':',
    DEFINITION_TILDE: '~',
    EXAMPLE_START: '(@',
    EXAMPLE_END: ')',
    HASH_NUMBERED: '#.',
} as const;

export const INDENTATION = {
    TAB_SIZE: 4,
    MIN_INDENT: 0,
    MAX_INDENT: 40,
    SINGLE_SPACE: 1,
    DOUBLE_SPACE: 2,
} as const;

export const CSS_CLASSES = {
    FANCY_LIST: 'pandoc-list-fancy',
    DEFINITION_TERM: 'pandoc-list-definition-term',
    DEFINITION_DESC: 'pandoc-list-definition-desc',
    EXAMPLE_REF: 'pandoc-example-reference',
    EXAMPLE_LIST: 'pandoc-example-list',
    EXAMPLE_ITEM: 'pandoc-example-item',
    LIST_LINE: 'HyperMD-list-line',
    LIST_LINE_1: 'HyperMD-list-line-1',
    CM_LIST_1: 'cm-list-1',
    CM_FORMATTING: 'cm-formatting',
    CM_FORMATTING_LIST: 'cm-formatting-list',
    CM_FORMATTING_LIST_OL: 'cm-formatting-list-ol',
    LIST_NUMBER: 'list-number',
    DEFINITION_TERM_DECORATION: 'cm-pandoc-definition-term',
    DEFINITION_PARAGRAPH: 'cm-pandoc-definition-paragraph',
    PANDOC_LIST_MARKER: 'pandoc-list-marker',
} as const;

export const DECORATION_STYLES = {
    HASH_LIST_INDENT: 29,
    EXAMPLE_LIST_INDENT: 35,
    FANCY_LIST_INDENT_MULTIPLIER: 7,
} as const;

export const REGEX_PATTERNS = {
    HASH_LIST: /^(\s*)(#\.)(\s+)/,
    FANCY_LIST: /^(\s*)(([A-Z]+|[a-z]+|[IVXLCDM]+|[ivxlcdm]+)([.)]))(\s+)/,
    EXAMPLE_LIST: /^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)/,
    EXAMPLE_REFERENCE: /\(@([a-zA-Z0-9_-]+)\)/g,
    DEFINITION_MARKER: /^([~:])(\s+)/,
    DEFINITION_INDENTED: /^(    |\t)/,
    NUMBERED_LIST: /^(\s*)([0-9]+[.)])/,
    UNORDERED_LIST: /^(\s*)[-*+]\s+/,
    CAPITAL_LETTER_LIST: /^(\s*)([A-Z])(\.)(\s+)/,
} as const;