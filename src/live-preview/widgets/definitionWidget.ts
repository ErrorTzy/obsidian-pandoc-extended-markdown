import { EditorView } from '@codemirror/view';
import { BaseWidget } from './BaseWidget';

// Widget for definition list bullets
export class DefinitionBulletWidget extends BaseWidget {
    constructor(view?: EditorView, pos?: number) {
        super(view, pos);
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = 'cm-formatting cm-formatting-list cm-list-1 pandoc-list-marker';
    }

    protected setContent(element: HTMLElement): void {
        element.textContent = '• ';
    }

    eq(other: DefinitionBulletWidget): boolean {
        return other.pos === this.pos;
    }
}