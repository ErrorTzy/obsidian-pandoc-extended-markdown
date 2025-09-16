import { EditorView } from '@codemirror/view';
import { CSS_CLASSES } from '../../core/constants';
import { BaseWidget } from './BaseWidget';

// Widget for superscript
export class SuperscriptWidget extends BaseWidget {
    constructor(
        private content: string,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected createRootElement(): HTMLElement {
        return document.createElement('sup');
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.SUPERSCRIPT;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.content;
    }

    eq(other: SuperscriptWidget): boolean {
        return other.content === this.content && other.pos === this.pos;
    }
}

// Widget for subscript
export class SubscriptWidget extends BaseWidget {
    constructor(
        private content: string,
        view?: EditorView,
        pos?: number
    ) {
        super(view, pos);
    }

    protected createRootElement(): HTMLElement {
        return document.createElement('sub');
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = CSS_CLASSES.SUBSCRIPT;
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = this.content;
    }

    eq(other: SubscriptWidget): boolean {
        return other.content === this.content && other.pos === this.pos;
    }
}