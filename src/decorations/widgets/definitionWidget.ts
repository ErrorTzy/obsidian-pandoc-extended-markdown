import { WidgetType } from '@codemirror/view';
import { EditorView } from '@codemirror/view';

// Widget for definition list bullets
export class DefinitionBulletWidget extends WidgetType {
    private controller: AbortController;

    constructor(private view?: EditorView, private pos?: number) {
        super();
        this.controller = new AbortController();
    }
    
    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-formatting cm-formatting-list cm-list-1 pandoc-list-marker';
        span.textContent = '• ';
        
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
    
    eq(other: DefinitionBulletWidget) {
        return other.pos === this.pos;
    }

    ignoreEvent(event: Event) {
        return event.type !== 'mousedown';
    }

    destroy() {
        this.controller.abort();
    }
}