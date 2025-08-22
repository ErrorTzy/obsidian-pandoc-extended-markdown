import { WidgetType, EditorView } from '@codemirror/view';
import { CSS_CLASSES } from '../../constants';

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
        span.contentEditable = 'false'; // Make it atomic but not editable
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