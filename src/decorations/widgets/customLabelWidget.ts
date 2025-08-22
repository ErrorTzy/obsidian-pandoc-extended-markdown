// External libraries
import { WidgetType, EditorView } from '@codemirror/view';
import { setTooltip } from 'obsidian';

// Constants
import { CSS_CLASSES, DECORATION_STYLES, DOM_ATTRIBUTES } from '../../constants';

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
    constructor(
        private text: string,
        private view: EditorView
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        span.textContent = this.text;
        return span;
    }

    eq(other: CustomLabelPartialWidget) {
        return other.text === this.text;
    }

    ignoreEvent() {
        return false;
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
    constructor(
        private text: string,
        private view: EditorView
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        span.textContent = this.text;
        return span;
    }

    eq(other: CustomLabelProcessedWidget) {
        return other.text === this.text;
    }

    ignoreEvent() {
        return false;
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
        span.contentEditable = DOM_ATTRIBUTES.CONTENT_EDITABLE_FALSE; // Make it atomic but not editable
        return span;
    }

    eq(other: CustomLabelInlineNumberWidget) {
        return other.number === this.number;
    }

    ignoreEvent(event: Event) {
        // Allow click events to position cursor but not direct editing
        return event.type !== 'mousedown' && event.type !== 'mouseup' && event.type !== 'click';
    }
}

export class CustomLabelReferenceWidget extends WidgetType {
    constructor(
        private label: string,
        private content: string | undefined,
        private view: EditorView,
        private position: number
    ) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_REF;
        span.setAttribute('data-custom-label-ref', this.label);
        span.textContent = `(${this.label})`;
        
        if (this.content) {
            span.setAttribute('title', this.content);
        }
        
        return span;
    }

    eq(other: CustomLabelReferenceWidget) {
        return other.label === this.label &&
               other.content === this.content &&
               other.position === this.position;
    }

    ignoreEvent() {
        return false;
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

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}