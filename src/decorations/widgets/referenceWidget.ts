import { WidgetType } from '@codemirror/view';
import { setTooltip } from 'obsidian';
import { CSS_CLASSES, DECORATION_STYLES } from '../../constants';

// Widget for example references
export class ExampleReferenceWidget extends WidgetType {
    constructor(private number: number, private tooltipText?: string) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_REF;
        span.textContent = `(${this.number})`;
        
        // Add tooltip if available
        if (this.tooltipText) {
            setTooltip(span, this.tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        }
        
        return span;
    }
    
    // Make the widget editable - allow all editing events to pass through
    ignoreEvent() {
        return false;
    }

    eq(other: ExampleReferenceWidget) {
        return other.number === this.number && other.tooltipText === this.tooltipText;
    }
}