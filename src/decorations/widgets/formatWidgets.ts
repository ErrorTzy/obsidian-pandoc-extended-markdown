import { WidgetType } from '@codemirror/view';
import { CSS_CLASSES } from '../../constants';

// Widget for superscript
export class SuperscriptWidget extends WidgetType {
    constructor(private content: string) {
        super();
    }

    toDOM() {
        const sup = document.createElement('sup');
        sup.className = CSS_CLASSES.SUPERSCRIPT;
        sup.textContent = this.content;
        return sup;
    }

    eq(other: SuperscriptWidget) {
        return other.content === this.content;
    }
}

// Widget for subscript
export class SubscriptWidget extends WidgetType {
    constructor(private content: string) {
        super();
    }

    toDOM() {
        const sub = document.createElement('sub');
        sub.className = CSS_CLASSES.SUBSCRIPT;
        sub.textContent = this.content;
        return sub;
    }

    eq(other: SubscriptWidget) {
        return other.content === this.content;
    }
}