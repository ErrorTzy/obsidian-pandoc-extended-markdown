import { WidgetType, EditorView } from '@codemirror/view';
import { setTooltip, App, Component } from 'obsidian';
import { CSS_CLASSES, DECORATION_STYLES } from '../../core/constants';
import { setupRenderedHoverPreview } from '../../views/panels/utils/hoverPopovers';

// Widget for example references
export class ExampleReferenceWidget extends WidgetType {
    private controller: AbortController;

    constructor(
        public number: number, 
        public tooltipText?: string, 
        private view?: EditorView, 
        private pos?: number,
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
        span.textContent = `(${this.number})`;
        
        // Add hover preview with rendered content if available
        if (this.tooltipText) {
            // If app and component are available, use rendered preview
            if (this.app && this.component) {
                setupRenderedHoverPreview(span, this.tooltipText, this.app, this.component, this.context);
            } else {
                // Fallback to plain tooltip
                setTooltip(span, this.tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
            }
        }
        
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
    
    // Make the widget editable - allow all editing events to pass through
    ignoreEvent() {
        return false;
    }

    eq(other: ExampleReferenceWidget) {
        return other.number === this.number && 
               other.tooltipText === this.tooltipText && 
               other.pos === this.pos &&
               other.app === this.app &&
               other.component === this.component &&
               other.context === this.context;
    }

    destroy() {
        this.controller.abort();
    }
}