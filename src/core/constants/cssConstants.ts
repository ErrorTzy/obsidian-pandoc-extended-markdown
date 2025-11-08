/**
 * CSS class and style-related constants
 */

export const CSS_CLASSES = {
    // Fancy List Classes
    FANCY_LIST: 'pem-list-fancy',
    FANCY_LIST_UPPER_ALPHA: 'pem-list-upper-alpha',
    FANCY_LIST_LOWER_ALPHA: 'pem-list-lower-alpha',
    FANCY_LIST_UPPER_ROMAN: 'pem-list-upper-roman',
    FANCY_LIST_LOWER_ROMAN: 'pem-list-lower-roman',
    FANCY_LIST_PAREN: 'pem-list-paren',

    // Definition List Classes
    DEFINITION_LIST: 'pem-definition-list',
    DEFINITION_TERM: 'pem-definition-term',
    DEFINITION_DESC: 'pem-list-definition-desc',
    DEFINITION_ITEMS: 'pem-definition-items',
    DEFINITION_CONTENT_TEXT: 'pem-definition-content-text',

    // Example List Classes
    EXAMPLE_REF: 'pem-example-reference',
    EXAMPLE_LIST: 'pem-example-list',
    EXAMPLE_ITEM: 'pem-example-item',
    DUPLICATE_MARKERS: 'pem-duplicate-markers',

    // Superscript and Subscript Classes
    SUPERSCRIPT: 'pem-superscript',
    SUBSCRIPT: 'pem-subscript',

    // Suggestion Classes
    SUGGESTION_CONTENT: 'pem-suggestion-content',
    SUGGESTION_TITLE: 'pem-suggestion-title',
    SUGGESTION_PREVIEW: 'pem-suggestion-preview',
    SUGGESTION_NUMBER: 'pem-suggestion-number',
    SUGGESTION_PLACEHOLDER: 'pem-suggestion-placeholder',

    // CodeMirror Classes
    LIST_LINE: 'HyperMD-list-line',
    LIST_LINE_1: 'HyperMD-list-line-1',
    LIST_LINE_2: 'HyperMD-list-line-2',
    LIST_LINE_3: 'HyperMD-list-line-3',
    LIST_LINE_4: 'HyperMD-list-line-4',
    LIST_LINE_NOBULLET: 'HyperMD-list-line-nobullet',
    CM_LIST_1: 'cm-list-1',
    CM_LIST_2: 'cm-list-2',
    CM_LIST_3: 'cm-list-3',
    CM_FORMATTING: 'cm-formatting',
    CM_FORMATTING_LIST: 'cm-formatting-list',
    CM_FORMATTING_LIST_OL: 'cm-formatting-list-ol',
    CM_FORMATTING_LIST_UL: 'cm-formatting-list-ul',
    LIST_NUMBER: 'list-number',
    DEFINITION_TERM_DECORATION: 'cm-pem-definition-term',
    DEFINITION_PARAGRAPH: 'cm-pem-definition-paragraph',

    // Generic Classes
    PANDOC_LIST_MARKER: 'pem-list-marker',
    PANDOC_LIST_LINE_INDENT: 'pem-list-line-indent',
    PANDOC_LIST_LINE: 'pem-list-line',
    DEFINITION_MARKER_CURSOR: 'cm-pem-definition-marker-cursor',
    LIST_CONTINUATION_WIDGET: 'pem-list-continuation-widget',

    // Custom Label Classes
    CUSTOM_LABEL_PROCESSED: 'pem-custom-label-processed',
    CUSTOM_LABEL_ITEM: 'pem-custom-label-item',
    CUSTOM_LABEL_REFERENCE_PROCESSED: 'pem-custom-label-reference-processed',
    CUSTOM_LABEL_REF_CLICKABLE: 'pem-custom-label-ref-clickable',
    CUSTOM_LABEL_PLACEHOLDER: 'pem-custom-label-placeholder',
    INLINE_PLACEHOLDER_NUMBER: 'pem-inline-placeholder-number',
    CUSTOM_LABEL_MARKER: 'pem-custom-label-marker',
    CUSTOM_LABEL_BRACKET: 'pem-custom-label-bracket',
    CUSTOM_LABEL_TEXT: 'pem-custom-label-text',

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
    HOVER_POPOVER: 'pem-hover-popover',
    HOVER_POPOVER_LABEL: 'pem-hover-popover-label',
    HOVER_POPOVER_CONTENT: 'pem-hover-popover-content',
    HOVER_POPOVER_POSITIONED: 'pem-hover-popover-positioned',

    // List Panel View Classes
    LIST_PANEL_VIEW_CONTAINER: 'pem-list-panel-view-container',
    LIST_PANEL_ICON_ROW: 'pem-list-panel-icon-row',
    LIST_PANEL_ICON_BUTTON: 'pem-list-panel-icon-button',
    LIST_PANEL_ICON_CONTAINER: 'pem-panel-icon-container',
    LIST_PANEL_ICON_CUSTOM_LABEL: 'pem-icon-custom-label',
    LIST_PANEL_ICON_EXAMPLE_LIST: 'pem-icon-example-list',
    LIST_PANEL_ICON_DEFINITION_LIST: 'pem-icon-definition-list',
    LIST_PANEL_ICON_FOOTNOTE: 'pem-icon-footnote',
    LIST_PANEL_SEPARATOR: 'pem-list-panel-separator',
    LIST_PANEL_CONTENT_CONTAINER: 'pem-list-panel-content-container',
    LIST_PANEL_ICON_ACTIVE: 'is-active',

    // Example List View Classes
    EXAMPLE_LIST_VIEW_CONTAINER: 'pem-example-list-view-container',
    EXAMPLE_LIST_VIEW_ROW: 'pem-example-list-view-row',
    EXAMPLE_LIST_VIEW_NUMBER: 'pem-example-list-view-number',
    EXAMPLE_LIST_VIEW_LABEL: 'pem-example-list-view-label',
    EXAMPLE_LIST_VIEW_CONTENT: 'pem-example-list-view-content',
    EXAMPLE_LIST_VIEW_EMPTY: 'pem-example-list-view-empty',

    // Definition List View Classes
    DEFINITION_LIST_VIEW_CONTAINER: 'pem-definition-list-view-container',
    DEFINITION_LIST_VIEW_ROW: 'pem-definition-list-view-row',
    DEFINITION_LIST_VIEW_TERM: 'pem-definition-list-view-term',
    DEFINITION_LIST_VIEW_DEFINITIONS: 'pem-definition-list-view-definitions',
    DEFINITION_LIST_VIEW_EMPTY: 'pem-definition-list-view-empty',

    // Footnote Panel View Classes
    FOOTNOTE_PANEL_CONTAINER: 'pem-footnote-panel-container',
    FOOTNOTE_PANEL_ROW: 'pem-footnote-panel-row',
    FOOTNOTE_PANEL_INDEX: 'pem-footnote-panel-index',
    FOOTNOTE_PANEL_CONTENT: 'pem-footnote-panel-content',
    FOOTNOTE_PANEL_EMPTY: 'pem-footnote-panel-empty',
} as const;

// Composite CSS Classes - commonly used combinations
export const COMPOSITE_CSS = {
    // Standard formatting for list markers in widgets
    STANDARD_LIST_MARKER_CLASSES: `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CM_FORMATTING_LIST_OL} ${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.PANDOC_LIST_MARKER}`,
} as const;

export const DECORATION_STYLES = {
    HASH_LIST_INDENT: 29,
    EXAMPLE_LIST_INDENT: 35,
    FANCY_LIST_INDENT_MULTIPLIER: 7,
    CONTINUATION_INDENT_UNIT_PX: 6,
    LINE_TRUNCATION_LIMIT: 100,
    TOOLTIP_DELAY_MS: 300,
    CUSTOM_LABEL_PREFIX_LENGTH: 3, // Length of "{::" prefix
} as const;
