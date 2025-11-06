import { WidgetType } from '@codemirror/view';
import { CSS_CLASSES } from '../../core/constants';

/**
 * Widget that renders the visual indentation for a list continuation line.
 */
export class ListContinuationIndentWidget extends WidgetType {
    private readonly width: number;
    private readonly listLevel: number;

    constructor(width: number, listLevel: number) {
        super();
        this.width = Math.max(width, 0);
        this.listLevel = listLevel;
    }

    eq(other: ListContinuationIndentWidget): boolean {
        return this.width === other.width && this.listLevel === other.listLevel;
    }

    toDOM(): HTMLElement {
        const outerSpacing = document.createElement('span');
        outerSpacing.className = 'cm-indent-spacing';

        const innerSpacing = document.createElement('span');
        innerSpacing.className = 'cm-indent-spacing';
        outerSpacing.appendChild(innerSpacing);

        const indentSpan = document.createElement('span');
        indentSpan.className = `cm-hmd-list-indent cm-hmd-list-indent-${this.getClampedLevel()} ${CSS_CLASSES.LIST_CONTINUATION_WIDGET}`;
        indentSpan.setCssProps({
            width: `${this.width}px`,
            whiteSpace: 'pre'
        });
        indentSpan.textContent = '\u00A0';
        indentSpan.setAttribute('aria-hidden', 'true');

        innerSpacing.appendChild(indentSpan);
        return outerSpacing;
    }

    ignoreEvent(): boolean {
        return false;
    }

    private getClampedLevel(): number {
        if (this.listLevel < 1) {
            return 1;
        }
        if (this.listLevel > 4) {
            return 4;
        }
        return this.listLevel;
    }
}
