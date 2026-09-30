import { readFileSync } from 'fs';
import { join } from 'path';

describe('parenthesized ordered list markers', () => {
    const styles = readFileSync(join(__dirname, '../../../styles.css'), 'utf8');

    it.each([
        ['lower-alpha', 'lower-alpha'],
        ['upper-alpha', 'upper-alpha'],
        ['lower-roman', 'lower-roman'],
        ['upper-roman', 'upper-roman']
    ])('uses the list-item counter in %s style', (listClass, counterStyle) => {
        expect(styles).toContain(
            `.pem-list-paren.pem-list-${listClass} > li::marker {\n` +
            `    content: counter(list-item, ${counterStyle}) ") ";`
        );
    });

    it('uses native decimal numbering and marker layout', () => {
        expect(styles).toContain('content: counter(list-item) ") ";');
        expect(styles).not.toMatch(/\.pem-list-paren\s*\{[^}]*counter-reset/s);
        expect(styles).not.toMatch(/\.pem-list-paren > li::before/);
    });
});
