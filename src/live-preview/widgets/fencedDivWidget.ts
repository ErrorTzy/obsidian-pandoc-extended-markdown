import { EditorView } from '@codemirror/view';
import { App, Component } from 'obsidian';
import { CSS_CLASSES } from '../../core/constants';
import { BaseWidget } from './BaseWidget';

export class FencedDivHeaderWidget extends BaseWidget {
    constructor(
        public displayName: string,
        public label?: string,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.FENCED_DIV_HEADER;
        if (this.label) {
            element.dataset.pandocDivId = this.label;
        }
    }

    protected setContent(element: HTMLElement): void {
        const titleElement = this.createElement('span', 'pem-fenced-div-title', this.displayName);

        element.appendChild(titleElement);
    }

    protected setupTooltip(element: HTMLElement): void {
        if (this.label) {
            this.addSimpleTooltip(element, `#${this.label}`);
        }
    }

    eq(other: FencedDivHeaderWidget): boolean {
        return other.displayName === this.displayName &&
               other.label === this.label &&
               other.pos === this.pos;
    }
}

export class FencedDivClosingWidget extends BaseWidget {
    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.FENCED_DIV_CLOSING;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = '';
    }

    protected setupTooltip(element: HTMLElement): void {
        this.addSimpleTooltip(element, 'End fenced div');
    }

    eq(other: FencedDivClosingWidget): boolean {
        return other.pos === this.pos;
    }
}

export class FencedDivReferenceWidget extends BaseWidget {
    constructor(
        public displayName: string,
        public label: string,
        private content?: string,
        view?: EditorView,
        pos?: number,
        private app?: App,
        private component?: Component
    ) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.FENCED_DIV_REFERENCE;
        element.dataset.pandocDivRef = this.label;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.displayName;
    }

    protected setupTooltip(element: HTMLElement): void {
        if (!this.content) {
            return;
        }

        if (this.app && this.component) {
            this.addRenderedHoverPreview(
                element,
                this.content,
                this.app,
                this.component,
                undefined,
                CSS_CLASSES.HOVER_POPOVER_CONTENT
            );
        } else {
            this.addSimpleTooltip(element, this.content);
        }
    }

    eq(other: FencedDivReferenceWidget): boolean {
        return other.displayName === this.displayName &&
               other.label === this.label &&
               other.content === this.content &&
               other.pos === this.pos;
    }
}
