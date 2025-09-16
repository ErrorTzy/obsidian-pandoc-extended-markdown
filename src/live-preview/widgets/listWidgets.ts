import { EditorView } from '@codemirror/view';
import { CSS_CLASSES, COMPOSITE_CSS, DECORATION_STYLES } from '../../core/constants';
import { BaseWidget } from './BaseWidget';

// Widget for rendering fancy list markers
export class FancyListMarkerWidget extends BaseWidget {
    constructor(
        private marker: string,
        private delimiter: string,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = COMPOSITE_CSS.STANDARD_LIST_MARKER_CLASSES;
    }

    protected setContent(element: HTMLElement): void {
        const innerSpan = this.createElement('span', CSS_CLASSES.LIST_NUMBER,
            this.marker + this.delimiter + ' '); // Include delimiter and space
        element.appendChild(innerSpan);
    }

    eq(other: FancyListMarkerWidget): boolean {
        return other.marker === this.marker &&
               other.delimiter === this.delimiter &&
               other.pos === this.pos;
    }
}

// Widget for hash auto-numbering
export class HashListMarkerWidget extends BaseWidget {
    constructor(
        private number: number,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = COMPOSITE_CSS.STANDARD_LIST_MARKER_CLASSES;
    }

    protected setContent(element: HTMLElement): void {
        const innerSpan = this.createElement('span', CSS_CLASSES.LIST_NUMBER,
            `${this.number}. `); // Space already included
        element.appendChild(innerSpan);
    }

    eq(other: HashListMarkerWidget): boolean {
        return other.number === this.number && other.pos === this.pos;
    }
}

// Widget for example list markers
export class ExampleListMarkerWidget extends BaseWidget {
    constructor(
        private number: number,
        private label: string | undefined,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = `${COMPOSITE_CSS.STANDARD_LIST_MARKER_CLASSES} ${CSS_CLASSES.EXAMPLE_REF}`;
    }

    protected setContent(element: HTMLElement): void {
        const innerSpan = this.createElement('span', CSS_CLASSES.LIST_NUMBER,
            `(${this.number}) `); // Space already included
        element.appendChild(innerSpan);
    }

    protected setupTooltip(element: HTMLElement): void {
        const tooltipText = this.label ? `@${this.label}` : '@';
        this.addSimpleTooltip(element, tooltipText);
    }

    eq(other: ExampleListMarkerWidget): boolean {
        return other.number === this.number &&
               other.label === this.label &&
               other.pos === this.pos;
    }
}

// Widget for duplicate example list labels
export class DuplicateExampleLabelWidget extends BaseWidget {
    constructor(
        private label: string,
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
        element.textContent = `(@${this.label})`;
    }

    protected setupTooltip(element: HTMLElement): void {
        let lineContent = this.originalLineContent.trim();
        if (lineContent.length > DECORATION_STYLES.LINE_TRUNCATION_LIMIT) {
            lineContent = lineContent.substring(0, DECORATION_STYLES.LINE_TRUNCATION_LIMIT) + '...';
        }
        const tooltipText = `Duplicate index at line ${this.originalLine}: ${lineContent}`;
        this.addSimpleTooltip(element, tooltipText);
    }

    eq(other: DuplicateExampleLabelWidget): boolean {
        return other.label === this.label &&
               other.originalLine === this.originalLine &&
               other.originalLineContent === this.originalLineContent &&
               other.pos === this.pos;
    }
}