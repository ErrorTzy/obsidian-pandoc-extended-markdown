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
    DUPLICATE_MARKERS: 'pandoc-duplicate-markers',
    
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
    
    // Custom Label View Classes
    CUSTOM_LABEL_VIEW_CONTAINER: 'custom-label-view-container',
    CUSTOM_LABEL_VIEW_HEADER: 'custom-label-view-header',
    CUSTOM_LABEL_VIEW_HEADER_LABEL: 'custom-label-view-header-label',
    CUSTOM_LABEL_VIEW_HEADER_CONTENT: 'custom-label-view-header-content',
    CUSTOM_LABEL_VIEW_ROW: 'custom-label-view-row',
    CUSTOM_LABEL_VIEW_LABEL: 'custom-label-view-label',
    CUSTOM_LABEL_VIEW_CONTENT: 'custom-label-view-content',
    CUSTOM_LABEL_VIEW_EMPTY: 'custom-label-view-empty',
    CUSTOM_LABEL_HOVER_PREVIEW: 'custom-label-hover-preview',
    CUSTOM_LABEL_HIGHLIGHT: 'custom-label-highlight',
    
    // Hover popover styles
    HOVER_POPOVER: 'pandoc-hover-popover',
    HOVER_POPOVER_LABEL: 'pandoc-hover-popover-label',
    HOVER_POPOVER_CONTENT: 'pandoc-hover-popover-content',
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
    LABEL_COPIED: 'Label copied to clipboard',
    
    // Error messages
    NO_DEFINITION_TERMS: 'No definition terms found to toggle',
    
    // View messages
    NO_ACTIVE_FILE: 'No active file',
    NO_CUSTOM_LABELS: 'No custom labels found',
    CUSTOM_LABELS_VIEW_TITLE: 'Custom Labels',
    
    // Formatting issue messages
    FORMATTING_ISSUES: (count: number) => `Found ${count} formatting issues`,
} as const;

export const COMMANDS = {
    CHECK_PANDOC: 'check-pandoc-formatting',
    FORMAT_PANDOC: 'format-to-pandoc-standard',
    TOGGLE_DEFINITION_BOLD: 'toggle-definition-bold-style',
    TOGGLE_DEFINITION_UNDERLINE: 'toggle-definition-underline-style',
    OPEN_CUSTOM_LABEL_VIEW: 'open-custom-label-view',
} as const;

export const SETTINGS = {
    STRICT_MODE: 'strictPandocMode',
    AUTO_RENUMBER: 'autoRenumberLists',
} as const;

export const UI_CONSTANTS = {
    NOTICE_DURATION_MS: 10000,
    STATE_TRANSITION_DELAY_MS: 100,
    // Custom Label View
    LABEL_MAX_LENGTH: 6,
    LABEL_TRUNCATION_LENGTH: 5,  // Length before adding ellipsis
    CONTENT_MAX_LENGTH: 51,
    CONTENT_TRUNCATION_LENGTH: 50,  // Length before adding ellipsis
    CONTENT_TRUNCATE_LINES: 3,
    UPDATE_DEBOUNCE_MS: 300,
    SELECTION_CLEAR_DELAY_MS: 300,
    SELECTION_FADE_DELAY_MS: 100,
    HIGHLIGHT_DURATION_MS: 2000,
    MAX_HOVER_WIDTH: '400px',
    MAX_HOVER_HEIGHT: '300px',
    HOVER_PADDING: '8px 12px',
    HOVER_Z_INDEX: '1000',
} as const;

export const DOM_ATTRIBUTES = {
    CONTENT_EDITABLE_FALSE: 'false',
} as const;

export const MATH_SYMBOLS = {
    // LaTeX to Unicode mappings for math rendering
    LATEX_TO_UNICODE: {
        '\\therefore': '∴',
        '\\because': '∵',
        '\\alpha': 'α',
        '\\beta': 'β',
        '\\gamma': 'γ',
        '\\delta': 'δ',
        '\\epsilon': 'ε',
        '\\theta': 'θ',
        '\\lambda': 'λ',
        '\\mu': 'μ',
        '\\pi': 'π',
        '\\sigma': 'σ',
        '\\phi': 'φ',
        '\\psi': 'ψ',
        '\\omega': 'ω',
        '\\infty': '∞',
        '\\pm': '±',
        '\\times': '×',
        '\\div': '÷',
        '\\neq': '≠',
        '\\leq': '≤',
        '\\geq': '≥',
        '\\approx': '≈',
        '\\subset': '⊂',
        '\\supset': '⊃',
        '\\cup': '∪',
        '\\cap': '∩',
        '\\in': '∈',
        '\\notin': '∉',
        '\\exists': '∃',
        '\\forall': '∀',
        '\\land': '∧',
        '\\lor': '∨',
        '\\neg': '¬',
        '\\rightarrow': '→',
        '\\leftarrow': '←',
        '\\leftrightarrow': '↔',
        '\\Rightarrow': '⇒',
        '\\Leftarrow': '⇐',
        '\\Leftrightarrow': '⇔'
    } as const
} as const;

export const ICONS = {
    CUSTOM_LABEL_SVG: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <text x="50" y="50" 
              text-anchor="middle" 
              dominant-baseline="central" 
              font-family="monospace" 
              font-size="36" 
              font-weight="bold" 
              fill="currentColor">
            {::}
        </text>
    </svg>`,
    LIST_PANEL_SVG: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <g fill="currentColor" font-family="monospace" font-weight="bold">
            <!-- 2x2 grid of Pandoc list markers for better visibility -->
            <!-- Top left: Roman numeral -->
            <text x="25" y="35" font-size="48" text-anchor="middle">i.</text>
            
            <!-- Top right: Letter with parenthesis -->
            <text x="75" y="35" font-size="48" text-anchor="middle">a)</text>
            
            <!-- Bottom left: Hash number -->
            <text x="25" y="75" font-size="48" text-anchor="middle">#.</text>
            
            <!-- Bottom right: Definition marker -->
            <text x="75" y="75" font-size="52" text-anchor="middle">~</text>
        </g>
    </svg>`,
    CUSTOM_LABEL_ID: 'custom-label-list',
    LIST_PANEL_ID: 'list-panel-view'
} as const;

// Helper function to create fancy list type class names
export function getFancyListClass(type: string): string {
    return `pandoc-list-${type}`;
}