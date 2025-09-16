// External libraries
import { EditorView } from '@codemirror/view';
import { App, Component } from 'obsidian';

// Constants
import { CSS_CLASSES, COMPOSITE_CSS, DECORATION_STYLES } from '../../core/constants';
import { BaseWidget } from './BaseWidget';

export class CustomLabelMarkerWidget extends BaseWidget {
    constructor(
        private label: string,
        view: EditorView,
        position: number
    ) {
        super(view, position);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = COMPOSITE_CSS.STANDARD_LIST_MARKER_CLASSES;
        if (this.view && this.pos !== undefined) {
            element.classList.add(CSS_CLASSES.CUSTOM_LABEL_REF_CLICKABLE);
        }
    }

    protected setContent(element: HTMLElement): void {
        const innerSpan = this.createElement('span', 'list-number', `(${this.label}) `);
        element.appendChild(innerSpan);
    }

    protected setupClickHandler(element: HTMLElement): void {
        // Override with click instead of mousedown for this widget
        if (this.view && this.pos !== undefined) {
            element.addEventListener('click', () => {
                if (this.view && this.pos !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.pos }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
    }

    eq(other: CustomLabelMarkerWidget): boolean {
        return other.label === this.label &&
               other.pos === this.pos;
    }
}

export class CustomLabelPartialWidget extends BaseWidget {
    constructor(
        private text: string,
        view: EditorView,
        position?: number
    ) {
        super(view, position);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.text;
    }

    eq(other: CustomLabelPartialWidget): boolean {
        return other.text === this.text && other.pos === this.pos;
    }
}

export class CustomLabelPlaceholderWidget extends BaseWidget {
    constructor(
        private number: string,
        view: EditorView
    ) {
        super(view, undefined);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.CUSTOM_LABEL_PLACEHOLDER;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.number;
    }

    protected setupClickHandler(element: HTMLElement): void {
        // No click handler for this widget
    }

    eq(other: CustomLabelPlaceholderWidget): boolean {
        return other.number === this.number;
    }
}

export class CustomLabelProcessedWidget extends BaseWidget {
    constructor(
        private text: string,
        view: EditorView,
        position?: number
    ) {
        super(view, position);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.PANDOC_LIST_MARKER}`;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.text;
    }

    eq(other: CustomLabelProcessedWidget): boolean {
        return other.text === this.text && other.pos === this.pos;
    }
}

export class CustomLabelInlineNumberWidget extends BaseWidget {
    constructor(
        private number: string,
        view: EditorView
    ) {
        super(view, undefined);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.INLINE_PLACEHOLDER_NUMBER;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.number;
        // Don't set contentEditable - let CodeMirror handle it
    }

    protected setupClickHandler(element: HTMLElement): void {
        // No click handler for this widget
    }

    eq(other: CustomLabelInlineNumberWidget): boolean {
        return other.number === this.number;
    }
}

export class CustomLabelReferenceWidget extends BaseWidget {
    constructor(
        private label: string,
        private content: string | undefined,
        view: EditorView,
        position: number,
        private app?: App,
        private component?: Component,
        private context?: {
            exampleLabels?: Map<string, number>;
            exampleContent?: Map<string, string>;
            customLabels?: Map<string, string>;
            rawToProcessed?: Map<string, string>;
        }
    ) {
        super(view, position);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.EXAMPLE_REF;
        element.setAttribute('data-custom-label-ref', this.label);
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = `(${this.label})`;
    }

    protected setupTooltip(element: HTMLElement): void {
        if (this.content) {
            // If app and component are available, use rendered preview
            if (this.app && this.component) {
                this.addRenderedHoverPreview(
                    element,
                    this.content,
                    this.app,
                    this.component,
                    this.context,
                    CSS_CLASSES.HOVER_POPOVER_CONTENT
                );
            } else {
                // Fallback to plain title attribute
                element.setAttribute('title', this.content);
            }
        }
    }

    eq(other: CustomLabelReferenceWidget): boolean {
        return other.label === this.label &&
               other.content === this.content &&
               other.pos === this.pos &&
               other.app === this.app &&
               other.component === this.component &&
               other.context === this.context;
    }
}

/**
 * Widget for displaying duplicate custom label markers with error styling.
 * Shows the original label syntax with a tooltip indicating the first occurrence.
 */
export class DuplicateCustomLabelWidget extends BaseWidget {
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
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.DUPLICATE_MARKERS;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = `{::${this.rawLabel}}`;
    }

    protected setupTooltip(element: HTMLElement): void {
        let lineContent = this.originalLineContent.trim();
        if (lineContent.length > DECORATION_STYLES.LINE_TRUNCATION_LIMIT) {
            lineContent = lineContent.substring(0, DECORATION_STYLES.LINE_TRUNCATION_LIMIT) + '...';
        }
        const tooltipText = `Duplicate label at line ${this.originalLine}: ${lineContent}`;
        this.addSimpleTooltip(element, tooltipText);
    }

    eq(other: DuplicateCustomLabelWidget): boolean {
        return other.rawLabel === this.rawLabel &&
               other.originalLine === this.originalLine &&
               other.originalLineContent === this.originalLineContent &&
               other.pos === this.pos;
    }
}