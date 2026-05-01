import { readFileSync } from 'fs';
import { join } from 'path';

describe('fenced div live-preview styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

    it('uses a contained callout treatment instead of a bare vertical rule', () => {
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*background:/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*box-shadow:\s*inset\s+3px\s+0\s+0/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*padding-inline-start:\s*1\.15em\s*!important/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*padding-inline-end:\s*1em/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*border-left:/s);
    });

    it('rounds the visual container at the opening and closing lines', () => {
        expect(styles).toMatch(/\.cm-pem-fenced-div-open\s*\{[^}]*border-radius:\s*8px\s+8px\s+0\s+0/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-close\s*\{[^}]*border-radius:\s*0\s+0\s+8px\s+8px/s);
    });

    it('keeps the closing fence visible while using compact line styling', () => {
        expect(styles).not.toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*height:\s*0\s*!important/s);
        expect(styles).not.toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*line-height:\s*0\s*!important/s);
        expect(styles).not.toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*min-height:\s*0\s*!important/s);
        expect(styles).not.toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*overflow:\s*hidden/s);
        expect(styles).not.toMatch(/\.pem-fenced-div-closing\s*\{[^}]*height:\s*0/s);
        expect(styles).not.toMatch(/\.pem-fenced-div-closing\s*\{[^}]*overflow:\s*hidden/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*line-height:\s*1\.1/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close\s*\{[^}]*min-height:\s*0\.9em/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*display:\s*inline-block/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*height:\s*1px/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*width:\s*1px/s);
    });

    it('does not style a visible source handle by default', () => {
        expect(styles).not.toMatch(/\.pem-fenced-div-source-handle\s*\{/s);
    });

    it('does not compact intentional blank spacer lines inside the div', () => {
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-blank\s*\{/s);
    });
});
