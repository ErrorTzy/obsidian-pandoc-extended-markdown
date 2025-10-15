/**
 * CSS class and style-related constants
 */

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
    DEFINITION_TERM_DECORATION: 'cm-pandoc-definition-term',
    DEFINITION_PARAGRAPH: 'cm-pandoc-definition-paragraph',

    // Generic Classes
    PANDOC_LIST_MARKER: 'pandoc-list-marker',
    PANDOC_LIST_LINE_INDENT: 'pandoc-list-line-indent',
    PANDOC_LIST_LINE: 'pandoc-list-line',
    DEFINITION_MARKER_CURSOR: 'cm-pandoc-definition-marker-cursor',
    LIST_CONTINUATION_WIDGET: 'pandoc-list-continuation-widget',

    // Custom Label Classes
    CUSTOM_LABEL_PROCESSED: 'pandoc-custom-label-processed',
    CUSTOM_LABEL_ITEM: 'pandoc-custom-label-item',
    CUSTOM_LABEL_REFERENCE_PROCESSED: 'pandoc-custom-label-reference-processed',
    CUSTOM_LABEL_REF_CLICKABLE: 'pandoc-custom-label-ref-clickable',
    CUSTOM_LABEL_PLACEHOLDER: 'pandoc-custom-label-placeholder',
    INLINE_PLACEHOLDER_NUMBER: 'pandoc-inline-placeholder-number',
    CUSTOM_LABEL_MARKER: 'pandoc-custom-label-marker',
    CUSTOM_LABEL_BRACKET: 'pandoc-custom-label-bracket',
    CUSTOM_LABEL_TEXT: 'pandoc-custom-label-text',

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
    HOVER_POPOVER_POSITIONED: 'pandoc-hover-popover-positioned',

    // List Panel View Classes
    LIST_PANEL_VIEW_CONTAINER: 'pandoc-list-panel-view-container',
    LIST_PANEL_ICON_ROW: 'pandoc-list-panel-icon-row',
    LIST_PANEL_ICON_BUTTON: 'pandoc-list-panel-icon-button',
    LIST_PANEL_ICON_CONTAINER: 'pandoc-panel-icon-container',
    LIST_PANEL_ICON_CUSTOM_LABEL: 'pandoc-icon-custom-label',
    LIST_PANEL_ICON_EXAMPLE_LIST: 'pandoc-icon-example-list',
    LIST_PANEL_ICON_FOOTNOTE: 'pandoc-icon-footnote',
    LIST_PANEL_SEPARATOR: 'pandoc-list-panel-separator',
    LIST_PANEL_CONTENT_CONTAINER: 'pandoc-list-panel-content-container',
    LIST_PANEL_ICON_ACTIVE: 'is-active',

    // Example List View Classes
    EXAMPLE_LIST_VIEW_CONTAINER: 'pandoc-example-list-view-container',
    EXAMPLE_LIST_VIEW_ROW: 'pandoc-example-list-view-row',
    EXAMPLE_LIST_VIEW_NUMBER: 'pandoc-example-list-view-number',
    EXAMPLE_LIST_VIEW_LABEL: 'pandoc-example-list-view-label',
    EXAMPLE_LIST_VIEW_CONTENT: 'pandoc-example-list-view-content',
    EXAMPLE_LIST_VIEW_EMPTY: 'pandoc-example-list-view-empty',

    // Definition List View Classes
    DEFINITION_LIST_VIEW_CONTAINER: 'pandoc-definition-list-view-container',
    DEFINITION_LIST_VIEW_ROW: 'pandoc-definition-list-view-row',
    DEFINITION_LIST_VIEW_TERM: 'pandoc-definition-list-view-term',
    DEFINITION_LIST_VIEW_DEFINITIONS: 'pandoc-definition-list-view-definitions',
    DEFINITION_LIST_VIEW_EMPTY: 'pandoc-definition-list-view-empty',

    // Footnote Panel View Classes
    FOOTNOTE_PANEL_CONTAINER: 'pandoc-footnote-panel-container',
    FOOTNOTE_PANEL_ROW: 'pandoc-footnote-panel-row',
    FOOTNOTE_PANEL_INDEX: 'pandoc-footnote-panel-index',
    FOOTNOTE_PANEL_CONTENT: 'pandoc-footnote-panel-content',
    FOOTNOTE_PANEL_EMPTY: 'pandoc-footnote-panel-empty',
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
