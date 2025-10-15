/**
 * List-related constants
 */

export const LIST_MARKERS = {
    DEFINITION_COLON: ':',
    DEFINITION_TILDE: '~',
    EXAMPLE_START: '(@',
    EXAMPLE_END: ')',
    EXAMPLE_FULL: '(@)',
    HASH_NUMBERED: '#.',
    CUSTOM_LABEL_FULL: '{::}',
    UNORDERED_DASH: '-',
    UNORDERED_STAR: '*',
    UNORDERED_PLUS: '+',
} as const;

export const LIST_TYPES = {
    HASH: 'hash',
    CUSTOM_LABEL: 'custom-label',
    EXAMPLE: 'example',
    DEFINITION: 'definition',
    UNKNOWN: 'unknown',
    ROMAN: 'roman',
    LETTER: 'letter',
} as const;

export const INDENTATION = {
    TAB_SIZE: 4,
    MIN_INDENT: 0,
    MAX_INDENT: 40,
    SINGLE_SPACE: 1,
    DOUBLE_SPACE: 2,
    TAB: '\t',
    FOUR_SPACES: '    ',
    CONTINUATION_MIN_VISUAL: 3,
} as const;
