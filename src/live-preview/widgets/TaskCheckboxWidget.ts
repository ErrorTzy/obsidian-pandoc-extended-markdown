import { EditorView } from '@codemirror/view';

import { BaseWidget } from './BaseWidget';

export class TaskCheckboxWidget extends BaseWidget {
    constructor(
        private sourceCharacter: ' ' | 'x' | 'X',
        view: EditorView,
        private checkboxStart: number
    ) {
        super(view, checkboxStart);
    }

    protected createRootElement(): HTMLElement {
        return document.createElement('label');
    }

    protected applyStyles(element: HTMLElement): void {
        element.className = 'task-list-label';
    }

    protected setContent(element: HTMLElement): void {
        const checkbox = document.createElement('input');
        checkbox.className = 'task-list-item-checkbox';
        checkbox.type = 'checkbox';
        checkbox.checked = this.sourceCharacter !== ' ';
        checkbox.dataset.task = this.sourceCharacter;
        element.appendChild(checkbox);
    }

    protected setupClickHandler(): void {
        // The checkbox input owns interaction instead of moving the editor cursor.
    }

    protected setupAdditionalHandlers(element: HTMLElement): void {
        const checkbox = element.querySelector<HTMLInputElement>('input');
        element.addEventListener('mousedown', event => {
            event.preventDefault();
        }, { signal: this.controller.signal });
        checkbox?.addEventListener('input', () => {
            const view = this.view;
            if (!view) {
                return;
            }

            const characterPosition = this.checkboxStart + 1;
            const currentCharacter = view.state.doc.sliceString(characterPosition, characterPosition + 1);
            if (!/^[ xX]$/.test(currentCharacter)) {
                return;
            }

            view.dispatch({
                changes: {
                    from: characterPosition,
                    to: characterPosition + 1,
                    insert: currentCharacter === ' ' ? 'x' : ' '
                }
            });
        }, { signal: this.controller.signal });
    }

    eq(other: TaskCheckboxWidget): boolean {
        return other.sourceCharacter === this.sourceCharacter &&
            other.checkboxStart === this.checkboxStart;
    }
}
