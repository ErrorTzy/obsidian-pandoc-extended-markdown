import { readFileSync } from 'fs';
import { join } from 'path';

describe('example list reading-mode styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

    it('uses native list marker layout for reading-mode example lists', () => {
        expect(styles).toMatch(/\.markdown-preview-view ol\.pem-example-list\s*\{[^}]*list-style-position:\s*outside/s);
        expect(styles).toMatch(/\.markdown-preview-view ol\.pem-example-list\s*\{[^}]*list-style-type:\s*decimal/s);
        expect(styles).toMatch(/\.markdown-preview-view ol\.pem-example-list\s*\{[^}]*padding-inline-start:\s*var\(--list-indent,\s*2em\)/s);
        expect(styles).toMatch(/\.markdown-preview-view ol\.pem-example-list > li\.pem-example-item\s*\{[^}]*display:\s*list-item/s);
        expect(styles).toMatch(/\.markdown-preview-view ol\.pem-example-list > li\.pem-example-item::marker\s*\{[^}]*content:\s*"\(" attr\(data-example-number\) "\) "/s);
        expect(styles).not.toMatch(/\.markdown-preview-view ol\.pem-example-list > li\.pem-example-item\s*\{[^}]*display:\s*grid/s);
        expect(styles).not.toMatch(/\.markdown-preview-view ol\.pem-example-list > li\.pem-example-item::before/s);
    });
});
