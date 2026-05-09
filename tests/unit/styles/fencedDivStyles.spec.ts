import { readFileSync } from 'fs';
import { join } from 'path';

describe('fenced div live-preview styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

    it('uses a contained callout treatment instead of a bare vertical rule', () => {
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*background:\s*var\(--pem-fenced-div-surface\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*box-shadow:\s*inset\s+var\(--pem-fenced-div-rail-width\)\s+0\s+0/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*padding-inline-start:\s*1\.35em\s*!important/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*padding-inline-end:\s*1em/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*border-left:/s);
    });

    it('uses straight rails without rounded fenced div corners', () => {
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-open\s*\{[^}]*border-radius:/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-close\s*\{[^}]*border-radius:/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-content-end\s*\{[^}]*border-radius:/s);
    });

    it('indents nested fenced div containers', () => {
        expect(styles).toMatch(/:where\(\.cm-pem-fenced-div-line\),\s*:where\(\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\)\s*\{[^}]*--pem-fenced-div-nest-indent:\s*1\.5em/s);
        expect(styles).toMatch(/--pem-fenced-div-rail-1:\s*linear-gradient/s);
        expect(styles).toMatch(/--pem-fenced-div-rail-1:[\s\S]*transparent\s+var\(--pem-fenced-div-nest-indent\)/s);
        expect(styles).toMatch(/--pem-fenced-div-rail-1:[\s\S]*var\(--pem-fenced-div-accent\)\s+var\(--pem-fenced-div-nest-indent\)/s);
        expect(styles).toMatch(/--pem-fenced-div-rail-1:[\s\S]*var\(--pem-fenced-div-inner-bg\)\s+calc\(var\(--pem-fenced-div-nest-indent\)\s*\+\s*var\(--pem-fenced-div-rail-width\)\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-inner,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-inner\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*--pem-fenced-div-surface:\s*var\(--pem-fenced-div-rail-1\),\s*var\(--pem-fenced-div-bg\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*box-shadow:\s*inset\s+var\(--pem-fenced-div-rail-width\)\s+0\s+0\s+var\(--pem-fenced-div-accent\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-inner\s*\{[^}]*padding-inline-start:\s*calc\(var\(--pem-fenced-div-current-indent\)\s*\+\s*1\.35em\)\s*!important/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-depth-3,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-depth-3\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*--pem-fenced-div-current-indent:\s*calc\(var\(--pem-fenced-div-nest-indent\)\s*\*\s*2\)/s);
        expect(styles).toMatch(/--pem-fenced-div-rail-2:[\s\S]*transparent\s+calc\(var\(--pem-fenced-div-nest-indent\)\s*\*\s*2\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-depth-3,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-depth-3\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*var\(--pem-fenced-div-rail-2\),\s*var\(--pem-fenced-div-rail-1\)/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-inner[^{}]*::before/s);
    });

    it('compacts inactive closing fences while preserving fenced div surfaces', () => {
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*background:\s*var\(--pem-fenced-div-surface\)/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*box-shadow:\s*inset\s+var\(--pem-fenced-div-rail-width\)\s+0\s+0\s+var\(--pem-fenced-div-accent\)/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-close\s*\{[^}]*background:/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-close\s*\{[^}]*box-shadow:/s);
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-close\.cm-pem-fenced-div-depth-[2-6]\s*\{/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*cursor:\s*text/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*height:\s*0\.7em\s*!important/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*line-height:\s*0\.7/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*min-height:\s*0\.7em/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*padding-bottom:\s*0\s*!important/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close:not\(\.cm-active\)\s*\{[^}]*padding-top:\s*0\s*!important/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-close\.cm-active\s*\{[^}]*line-height:\s*1\.4/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*display:\s*inline-block/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*height:\s*0/s);
        expect(styles).toMatch(/\.pem-fenced-div-closing\s*\{[^}]*width:\s*0/s);
    });

    it('does not style a visible source handle by default', () => {
        expect(styles).not.toMatch(/\.pem-fenced-div-source-handle\s*\{/s);
    });

    it('styles generated fenced div titles as theorem-style block headers', () => {
        expect(styles).toMatch(/\.pem-fenced-div\s*>\s*\.pem-fenced-div-title\s*\{[^}]*display:\s*block/s);
        expect(styles).toMatch(/\.pem-fenced-div-header,\s*\.pem-fenced-div\s*>\s*\.pem-fenced-div-title\s*\{[^}]*font-weight:\s*700/s);
        expect(styles).not.toMatch(/\.pem-fenced-div-header,\s*\.pem-fenced-div-title\s*\{/s);
    });

    it('does not compact intentional blank spacer lines inside the div', () => {
        expect(styles).not.toMatch(/\.cm-pem-fenced-div-blank\s*\{/s);
    });

    it('keeps rendered live-preview math blocks transparent inside fenced div lines', () => {
        expect(styles).toMatch(/\.cm-pem-fenced-div-line\s*\{[^}]*background:\s*var\(--pem-fenced-div-surface\)\s*!important/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-line,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*box-shadow:\s*inset\s+var\(--pem-fenced-div-rail-width\)\s+0\s+0\s+var\(--pem-fenced-div-accent\)\s*!important/s);
        expect(styles).toMatch(/\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*background:\s*var\(--pem-fenced-div-surface\)\s*!important/s);
        expect(styles).toMatch(/\.cm-pem-fenced-div-depth-4,\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-depth-4\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*var\(--pem-fenced-div-rail-3\),\s*var\(--pem-fenced-div-rail-2\),\s*var\(--pem-fenced-div-rail-1\)/s);
        expect(styles).toMatch(/\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*padding-bottom:\s*0\.2em\s*!important/s);
        expect(styles).toMatch(/\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*\{[^}]*padding-top:\s*0\.1em\s*!important/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-line\s*:is\([^)]*\.cm-embed-block/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-line\s*:is\([^)]*\.markdown-rendered/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-line\s*:is\([^)]*mjx-container/s);
        expect(styles).toMatch(/\.cm-line\.cm-pem-fenced-div-line\s*:is\([^)]*\),\s*\.cm-content\s*>\s*\.cm-pem-fenced-div-line\s*\+\s*\.math\.math-block\.cm-embed-block:has\(\+\s*\.cm-pem-fenced-div-line\)\s*:is\([^)]*\)\s*\{[^}]*background:\s*transparent\s*!important/s);
    });
});
