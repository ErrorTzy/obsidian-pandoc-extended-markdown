import { WidgetType, EditorView } from '@codemirror/view';
import { CSS_CLASSES } from '../../core/constants';

// Widget for superscript
export class SuperscriptWidget extends WidgetType {
    private controller: AbortController;

    constructor(private content: string, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const sup = document.createElement('sup');
        sup.className = CSS_CLASSES.SUPERSCRIPT;
        sup.textContent = this.content;
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            sup.addEventListener('mousedown', (e) => {
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
        
        return sup;
    }

    eq(other: SuperscriptWidget) {
        return other.content === this.content && other.pos === this.pos;
    }

    destroy() {
        this.controller.abort();
    }

    ignoreEvent() {
        return false; // Allow all events to pass through
    }
}

// Widget for subscript
export class SubscriptWidget extends WidgetType {
    private controller: AbortController;

    constructor(private content: string, private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }

    toDOM() {
        const sub = document.createElement('sub');
        sub.className = CSS_CLASSES.SUBSCRIPT;
        sub.textContent = this.content;
        
        // Handle click events to place cursor
        if (this.view && this.pos !== undefined) {
            sub.addEventListener('mousedown', (e) => {
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
        
        return sub;
    }

    eq(other: SubscriptWidget) {
        return other.content === this.content && other.pos === this.pos;
    }

    destroy() {
        this.controller.abort();
    }

    ignoreEvent() {
        return false; // Allow all events to pass through
    }
}