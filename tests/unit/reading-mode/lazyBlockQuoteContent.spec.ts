import { MarkdownRenderer } from 'obsidian';

import { reconcileLazyBlockQuoteContent } from '../../../src/reading-mode/features/native-lists/lazyBlockQuoteContent';
import { ReadingModeContext } from '../../../src/reading-mode/pipeline/types';

describe('source-owned lazy quote content reconciliation', () => {
    function context(root: HTMLElement, source: string): ReadingModeContext {
        return {
            element: root,
            section: root,
            sourcePath: 'quote.md',
            sectionInfo: { text: source, lineStart: 0, lineEnd: source.split('\n').length - 1 },
            config: { enableListsWithoutPrecedingBlankline: false },
            postProcessorContext: { getSectionInfo: () => null }
        } as unknown as ReadingModeContext;
    }

    it('keeps the source quote and indented markers without consuming a sibling', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p>Paragraph</p></blockquote>' +
            '<pre><code>- TARGET\n</code></pre><aside>KEEP</aside>';
        const source = '> Paragraph\n    - TARGET';
        const quote = root.querySelector('blockquote');
        const aside = root.querySelector('aside');
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.querySelector('blockquote')).toBe(quote);
        expect(quote?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Paragraph - TARGET');
        expect(root.querySelector('pre')).toBeNull();
        expect(root.querySelector('aside')).toBe(aside);
    });

    it('unwraps a quote-looking list continuation while retaining all item and inline DOM', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>seed<blockquote><p><a>continuation</a></p></blockquote></li>' +
            '<li>TARGET<ul><li>CHILD</li></ul></li></ul><aside>KEEP</aside>';
        const source = '- seed\n>\ncontinuation\n- TARGET\n  - CHILD';
        const items = Array.from(root.querySelectorAll('li'));
        const link = root.querySelector('a');
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.querySelector('blockquote')).toBeNull();
        expect(items[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('seed > continuation');
        expect(Array.from(root.querySelectorAll('li'))).toEqual(items);
        expect(root.querySelector('a')).toBe(link);
        expect(root.querySelector('aside')?.textContent).toBe('KEEP');
    });

    it('does not cross an unrelated sibling while moving quoted fenced code', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><ul><li>seed</li></ul></blockquote>' +
            '<aside>KEEP</aside><pre><code>code\n</code></pre><ul><li>TARGET</li></ul>';
        const source = '> - seed\n~~~\ncode\n~~~\n- TARGET';
        const html = root.innerHTML;
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.innerHTML).toBe(html);
    });

    it('retains repeated links and unknown inline nodes when removing excess quote structure', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>seed<blockquote><p><a href="one">same</a> ' +
            '<span data-embed="live">widget</span> <a href="two">same</a></p></blockquote></li>' +
            '<li>TARGET</li></ul>';
        const nodes = Array.from(root.querySelectorAll('a, [data-embed]'));
        const source = '- seed\n> [same](one) widget [same](two)\n- TARGET';
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.querySelector('blockquote')).toBeNull();
        expect(Array.from(root.querySelectorAll('a, [data-embed]'))).toEqual(nodes);
        expect(root.querySelector('li')?.textContent?.replace(/\s+/g, ' ').trim())
            .toBe('seed > same widget same');
    });

    it('never removes unmatched content in a code wrapper', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p>Paragraph</p></blockquote>' +
            '<div class="el-pre"><pre><code>- TARGET\n</code></pre><aside>KEEP</aside></div>';
        const source = '> Paragraph\n    - TARGET';
        const aside = root.querySelector('aside');
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.contains(aside)).toBe(true);
        expect(root.textContent).toContain('KEEP');
    });

    it('retains unrelated content beside the matched quote paragraph', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>seed<blockquote><p>continuation</p><img src="keep.png"></blockquote></li>' +
            '<li>TARGET</li></ul>';
        const source = '- seed\n>\ncontinuation\n- TARGET';
        const image = root.querySelector('img');
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.contains(image)).toBe(true);
    });

    it('does not count quote examples in fenced code as rendered source occurrences', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<pre><code>&gt; Paragraph\n    - DECOY\n</code></pre>' +
            '<blockquote><p>Paragraph</p></blockquote><pre><code>- TARGET\n</code></pre>';
        const source = '```\n> Paragraph\n    - DECOY\n```\n\n> Paragraph\n    - TARGET';
        const example = root.firstElementChild;
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.firstElementChild).toBe(example);
        expect(root.querySelector('blockquote')?.textContent?.replace(/\s+/g, ' ').trim())
            .toBe('Paragraph - TARGET');
    });

    it('matches repeated quote openings before mutating either occurrence', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p>Paragraph</p></blockquote><pre><code>- FIRST\n</code></pre>' +
            '<blockquote><p>Paragraph</p></blockquote><pre><code>- SECOND\n</code></pre>';
        const source = '> Paragraph\n    - FIRST\n\n> Paragraph\n    - SECOND';
        const quotes = Array.from(root.querySelectorAll('blockquote'));
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(quotes.map(quote => quote.textContent?.replace(/\s+/g, ' ').trim()))
            .toEqual(['Paragraph - FIRST', 'Paragraph - SECOND']);
    });

    it('does not remove code changed while its replacement is rendering', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p>Paragraph</p></blockquote><pre><code>- TARGET\n</code></pre>';
        const source = '> Paragraph\n    - TARGET';
        const ctx = context(root, source);
        ctx.app = {} as ReadingModeContext['app'];
        let release: () => void = () => undefined;
        const rendering = MarkdownRenderer.render as jest.Mock;
        const original = rendering.getMockImplementation();
        rendering.mockClear();
        rendering.mockImplementation(async (_app, renderedSource: string, target: HTMLElement) => {
            if (renderedSource.startsWith('> Paragraph')) {
                target.innerHTML = '<blockquote><p>Paragraph</p></blockquote>';
                return;
            }
            target.innerHTML = '<p>- TARGET</p>';
            await new Promise<void>(resolve => { release = resolve; });
        });
        const pending = reconcileLazyBlockQuoteContent(source.split('\n'), ctx, root, () => true);
        for (let tick = 0; tick < 20; tick++) {
            await Promise.resolve();
        }
        const code = root.querySelector('code') as HTMLElement;
        code.textContent = 'NEW CONTENT';
        release();
        await pending;
        try {
            expect(rendering).toHaveBeenCalledTimes(2);
            expect(root.contains(code)).toBe(true);
            expect(root.textContent).toContain('NEW CONTENT');
        } finally {
            rendering.mockImplementation(original);
        }
    });

    it('restores only structural quote prefixes without escaping inline code contents', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<ul><li>seed<blockquote><p><code>a &gt; b</code></p></blockquote></li>' +
            '<li>TARGET</li></ul>';
        const source = '- seed\n> `a > b`\n- TARGET';
        const code = root.querySelector('code');
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.querySelector('blockquote')).toBeNull();
        expect(root.querySelector('code')).toBe(code);
        expect(code?.textContent).toBe('a > b');
        expect(root.querySelector('li')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('seed > a > b');
    });

    it('restores only excess quote depth inside a genuinely quoted list', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><ul><li>seed<blockquote><p>continuation</p></blockquote></li>' +
            '<li>TARGET</li></ul></blockquote>';
        const source = '> - seed\n> > continuation\n> - TARGET';
        const outerQuote = root.firstElementChild;
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(Array.from(root.querySelectorAll('blockquote'))).toEqual([outerQuote]);
        expect(root.querySelector('li')?.textContent?.replace(/\s+/g, ' ').trim())
            .toBe('seed > continuation');
    });

    it('matches a multiline leading quote paragraph before recovering its indented list marker', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p>Paragraph\ncontinuation</p></blockquote>' +
            '<pre><code>- TARGET\n</code></pre>';
        const source = '> Paragraph\ncontinuation\n    - TARGET';
        await reconcileLazyBlockQuoteContent(source.split('\n'), context(root, source), root, () => true);
        expect(root.querySelector('blockquote')?.textContent?.replace(/\s+/g, ' ').trim())
            .toBe('Paragraph continuation - TARGET');
        expect(root.querySelector('pre')).toBeNull();
    });

    it('retains document reference links when recovering an indented quote marker', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<blockquote><p><a href="https://example.test">lead</a></p></blockquote>' +
            '<pre><code>- [CHILD][ref]\n</code></pre>';
        const source = '> [lead][ref]\n    - [CHILD][ref]';
        const ctx = context(root, source);
        ctx.app = {} as ReadingModeContext['app'];
        ctx.fullSource = `${source}\n\n[ref]: https://example.test`;
        const lead = root.querySelector('a');
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const original = renderMock.getMockImplementation();
        renderMock.mockImplementation(async (app, fragment: string, target: HTMLElement, ...rest) => {
            const href = fragment.match(/^\[ref\]: (https?:\/\/\S+)$/m)?.[1];
            let body = fragment.replace(/^\[ref\]: https?:\/\/\S+$/gm, '').trim();
            if (href) {
                body = body.replace(/\[([^\]]+)\]\[ref\]/g, `[$1](${href})`);
            }
            // The host's initial quote paragraph is separate from the indented
            // code block. The signature inspects only that leading paragraph.
            if (body.startsWith('> ')) {
                body = body.split('\n')[0];
            }
            if (body) {
                await original?.(app, body, target, ...rest);
            }
        });
        try {
            await reconcileLazyBlockQuoteContent(source.split('\n'), ctx, root, () => true);
            expect(root.querySelector('a')).toBe(lead);
            expect(Array.from(root.querySelectorAll('blockquote a')).map(link => link.getAttribute('href')))
                .toEqual(['https://example.test', 'https://example.test']);
            expect(root.querySelector('blockquote')?.textContent?.replace(/\s+/g, ' ').trim())
                .toBe('lead - CHILD');
        } finally {
            renderMock.mockImplementation(original);
        }
    });
});
