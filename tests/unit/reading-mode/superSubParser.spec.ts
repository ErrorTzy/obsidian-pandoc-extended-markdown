import { processSuperSub } from '../../../src/reading-mode/parsers/superSubParser';
import { CSS_CLASSES } from '../../../src/core/constants';

describe('super/sub processing in reading mode', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('skips code blocks and inline code elements', () => {
        const root = document.createElement('div');
        root.innerHTML = [
            '<pre><code>H~2~O</code></pre>',
            '<p><code>X^2</code> is x^2^</p>'
        ].join('');
        document.body.appendChild(root);

        processSuperSub(root);

        const codeBlockContent = root.querySelector('pre code')?.textContent;
        expect(codeBlockContent).toBe('H~2~O');

        const inlineCodeContent = root.querySelector('p code')?.textContent;
        expect(inlineCodeContent).toBe('X^2');

        const superscripts = Array.from(root.querySelectorAll('sup'));
        expect(superscripts).toHaveLength(1);
        expect(superscripts[0].classList.contains(CSS_CLASSES.SUPERSCRIPT)).toBe(true);
        expect(superscripts[0].textContent).toBe('2');
    });
});
