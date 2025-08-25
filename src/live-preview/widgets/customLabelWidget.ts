// External libraries
import { WidgetType, EditorView } from '@codemirror/view';
import { setTooltip, App, Component } from 'obsidian';

// Constants
import { CSS_CLASSES, DECORATION_STYLES, DOM_ATTRIBUTES } from '../../core/constants';
import { setupRenderedHoverPreview } from '../../views/panels/utils/hoverPopovers';

export class CustomLabelMarkerWidget extends WidgetType {
    private controller: AbortController;

    constructor(
        private label: string,
        private view: EditorView,
        private position: number
    ) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CM_FORMATTING_LIST_OL} ${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = `(${this.label}) `;
        span.appendChild(innerSpan);
        
        // Make it clickable to jump to position
        if (this.view && this.position !== undefined) {
            span.classList.add(CSS_CLASSES.CUSTOM_LABEL_REF_CLICKABLE);
            span.addEventListener('click', () => {
                if (this.view && this.position !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.position }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
        
        return span;
    }

    eq(other: CustomLabelMarkerWidget) {
        return other.label === this.label && 
               other.position === this.position;
    }

    ignoreEvent() {
        return false;  // Allow all events to pass through
    }
    
    destroy() {
        this.controller.abort();
    }
}

export class CustomLabelPartialWidget extends WidgetType {
    private controller: AbortController;

    constructor(
        private text: string,
        private view: EditorView,
        private position?: number
    ) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        span.textContent = this.text;
        
        // Handle click events to place cursor if position is provided
        if (this.view && this.position !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.view && this.position !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.position }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
        
        return span;
    }

    eq(other: CustomLabelPartialWidget) {
        return other.text === this.text && other.position === this.position;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.controller.abort();
    }
}

export class CustomLabelPlaceholderWidget extends WidgetType {
    constructor(
        private number: string,
        private view: EditorView
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.CUSTOM_LABEL_PLACEHOLDER;
        span.textContent = this.number;
        return span;
    }

    eq(other: CustomLabelPlaceholderWidget) {
        return other.number === this.number;
    }

    ignoreEvent() {
        return false;
    }
}

export class CustomLabelProcessedWidget extends WidgetType {
    private controller: AbortController;

    constructor(
        private text: string,
        private view: EditorView,
        private position?: number
    ) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        span.textContent = this.text;
        
        // Handle click events to place cursor if position is provided
        if (this.view && this.position !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.view && this.position !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.position }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
        
        return span;
    }

    eq(other: CustomLabelProcessedWidget) {
        return other.text === this.text && other.position === this.position;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.controller.abort();
    }
}

export class CustomLabelInlineNumberWidget extends WidgetType {
    constructor(
        private number: string,
        private view: EditorView
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.INLINE_PLACEHOLDER_NUMBER;
        span.textContent = this.number;
        // Don't set contentEditable - let CodeMirror handle it
        return span;
    }

    eq(other: CustomLabelInlineNumberWidget) {
        return other.number === this.number;
    }

    ignoreEvent() {
        return false;
    }
}

export class CustomLabelReferenceWidget extends WidgetType {
    private controller: AbortController;

    constructor(
        private label: string,
        private content: string | undefined,
        private view: EditorView,
        private position: number,
        private app?: App,
        private component?: Component,
        private context?: {
            exampleLabels?: Map<string, number>;
            exampleContent?: Map<string, string>;
            customLabels?: Map<string, string>;
            rawToProcessed?: Map<string, string>;
        }
    ) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_REF;
        span.setAttribute('data-custom-label-ref', this.label);
        span.textContent = `(${this.label})`;
        
        // Add hover preview with rendered content if available
        if (this.content) {
            // If app and component are available, use rendered preview
            if (this.app && this.component) {
                setupRenderedHoverPreview(span, this.content, this.app, this.component, this.context);
            } else {
                // Fallback to plain title attribute
                span.setAttribute('title', this.content);
            }
        }
        
        // Handle click events to place cursor
        if (this.view && this.position !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.view && this.position !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.position }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
        
        return span;
    }

    eq(other: CustomLabelReferenceWidget) {
        return other.label === this.label &&
               other.content === this.content &&
               other.position === this.position &&
               other.app === this.app &&
               other.component === this.component &&
               other.context === this.context;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.controller.abort();
    }
}

/**
 * Widget for displaying duplicate custom label markers with error styling.
 * Shows the original label syntax with a tooltip indicating the first occurrence.
 */
export class DuplicateCustomLabelWidget extends WidgetType {
    private controller: AbortController;

    /**
     * @param rawLabel - The raw label text (e.g., "P(#a)")
     * @param originalLine - Line number of the first occurrence
     * @param originalLineContent - Content of the first occurrence line
     * @param view - Optional editor view for cursor positioning
     * @param pos - Optional position for cursor placement
     */
    constructor(
        private rawLabel: string,
        private originalLine: number,
        private originalLineContent: string,
        private view?: EditorView,
        private pos?: number
    ) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.DUPLICATE_MARKERS;
        span.textContent = `{::${this.rawLabel}}`;
        
        // Add tooltip with full line content, truncated if necessary
        let lineContent = this.originalLineContent.trim();
        if (lineContent.length > DECORATION_STYLES.LINE_TRUNCATION_LIMIT) {
            lineContent = lineContent.substring(0, DECORATION_STYLES.LINE_TRUNCATION_LIMIT) + '...';
        }
        const tooltipText = `Duplicate label at line ${this.originalLine}: ${lineContent}`;
        setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        
        // Handle click events to place cursor (only if both view and pos are provided)
        if (this.view && this.pos !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Re-check to ensure TypeScript knows they're defined
                if (this.view && this.pos !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.pos }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
        
        return span;
    }

    eq(other: DuplicateCustomLabelWidget) {
        return other.rawLabel === this.rawLabel && 
               other.originalLine === this.originalLine && 
               other.originalLineContent === this.originalLineContent && 
               other.pos === this.pos;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.controller.abort();
    }
}