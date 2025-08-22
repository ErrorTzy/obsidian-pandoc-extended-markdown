import { WidgetType } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { setTooltip } from 'obsidian';
import { CSS_CLASSES, DECORATION_STYLES } from '../../constants';

// Widget for rendering fancy list markers
export class FancyListMarkerWidget extends WidgetType {
    private controller: AbortController;

    constructor(private marker: string, private type: string, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CM_FORMATTING_LIST_OL} ${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = this.marker + ' '; // Add space after marker
        span.appendChild(innerSpan);
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

    eq(other: FancyListMarkerWidget) {
        return other.marker === this.marker && other.pos === this.pos;
    }

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}

// Widget for hash auto-numbering
export class HashListMarkerWidget extends WidgetType {
    private controller: AbortController;

    constructor(private number: number, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CM_FORMATTING_LIST_OL} ${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = `${this.number}. `; // Space already included
        span.appendChild(innerSpan);
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

    eq(other: HashListMarkerWidget) {
        return other.number === this.number && other.pos === this.pos;
    }

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}

// Widget for example list markers
export class ExampleListMarkerWidget extends WidgetType {
    private controller: AbortController;

    constructor(private number: number, private label: string | undefined, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CM_FORMATTING_LIST_OL} ${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.PANDOC_LIST_MARKER} ${CSS_CLASSES.EXAMPLE_REF}`;
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = `(${this.number}) `; // Space already included
        span.appendChild(innerSpan);
        
        // Add tooltip to show original label
        const tooltipText = this.label ? `@${this.label}` : '@';
        setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

    eq(other: ExampleListMarkerWidget) {
        return other.number === this.number && other.label === this.label && other.pos === this.pos;
    }

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}

// Widget for duplicate example list labels
export class DuplicateExampleLabelWidget extends WidgetType {
    private controller: AbortController;

    constructor(private label: string, private originalLine: number, private originalLineContent: string, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_DUPLICATE;
        span.textContent = `(@${this.label})`;
        
        // Add tooltip with full line content, truncated if necessary
        let lineContent = this.originalLineContent.trim();
        if (lineContent.length > DECORATION_STYLES.LINE_TRUNCATION_LIMIT) {
            lineContent = lineContent.substring(0, DECORATION_STYLES.LINE_TRUNCATION_LIMIT) + '...';
        }
        const tooltipText = `Duplicate index at line ${this.originalLine}: ${lineContent}`;
        setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            span.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

    eq(other: DuplicateExampleLabelWidget) {
        return other.label === this.label && other.originalLine === this.originalLine && other.originalLineContent === this.originalLineContent && other.pos === this.pos;
    }

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}