import { readFileSync } from 'fs';
import { join } from 'path';

describe('definition list live-preview styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

    it('does not reset native list text-indent on structural definition item lines', () => {
        expect(styles).toMatch(/\.cm-pem-definition-paragraph:not\(\.HyperMD-list-line\)\s*\{[^}]*text-indent:\s*0\s*!important/s);
        expect(styles).not.toMatch(/\.cm-pem-definition-paragraph\s*\{[^}]*text-indent:\s*0\s*!important/s);
    });
});
