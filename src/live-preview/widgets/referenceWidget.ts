import { EditorView } from '@codemirror/view';
import { App, Component } from 'obsidian';
import { CSS_CLASSES } from '../../core/constants';
import { BaseWidget } from './BaseWidget';

// Widget for example references
export class ExampleReferenceWidget extends BaseWidget {
    constructor(
        public number: number,
        public tooltipText?: string,
        view?: EditorView,
        pos?: number,
        private app?: App,
        private component?: Component,
        private context?: {
            exampleLabels?: Map<string, number>;
            exampleContent?: Map<string, string>;
            customLabels?: Map<string, string>;
            rawToProcessed?: Map<string, string>;
        }
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.EXAMPLE_REF;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = `(${this.number})`;
    }

    protected setupTooltip(element: HTMLElement): void {
        if (this.tooltipText) {
            // If app and component are available, use rendered preview
            if (this.app && this.component) {
                this.addRenderedHoverPreview(
                    element,
                    this.tooltipText,
                    this.app,
                    this.component,
                    this.context,
                    CSS_CLASSES.HOVER_POPOVER_CONTENT
                );
            } else {
                // Fallback to plain tooltip
                this.addSimpleTooltip(element, this.tooltipText);
            }
        }
    }

    eq(other: ExampleReferenceWidget): boolean {
        return other.number === this.number &&
               other.tooltipText === this.tooltipText &&
               other.pos === this.pos &&
               other.app === this.app &&
               other.component === this.component &&
               other.context === this.context;
    }
}