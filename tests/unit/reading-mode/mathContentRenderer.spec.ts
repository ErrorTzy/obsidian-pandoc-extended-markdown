import { appendMathContent } from '../../../src/reading-mode/features/extended-lists/mathContentRenderer';

describe('mathContentRenderer', () => {
    const appendText = (element: HTMLElement) => (text: string): void => {
        element.appendChild(document.createTextNode(text));
    };

    it('does not append content when dollar delimiters are unmatched', () => {
        const element = document.createElement('dd');

        const handled = appendMathContent(element, 'price is $5', appendText(element));

        expect(handled).toBe(false);
        expect(element.textContent).toBe('');
    });

    it('renders inline and display math while preserving surrounding text', () => {
        const element = document.createElement('dd');

        const handled = appendMathContent(element, 'a $x$ and $$y$$', appendText(element));

        expect(handled).toBe(true);
        expect(element.textContent).toBe('a x and y');
        expect(element.querySelectorAll('.math-inline')).toHaveLength(1);
        expect(element.querySelectorAll('.math-block')).toHaveLength(1);
    });
});
