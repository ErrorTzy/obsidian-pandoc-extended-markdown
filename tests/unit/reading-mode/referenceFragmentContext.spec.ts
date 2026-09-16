import { App, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { NativeListSpacingProcessor } from '../../../src/reading-mode/pipeline/processors/nativeListSpacingProcessor';
import { FencedDivBlockProcessor } from '../../../src/reading-mode/pipeline/processors/fencedDivBlockProcessor';
import { createReadingModeContext } from '../../../src/reading-mode/pipeline/registry';
import { waitForFencedDivRun } from '../../../src/reading-mode/features/fenced-divs/processingCoordinator';
import {
    isInternalMarkdownFragment,
    renderMarkdownFragment
} from '../../../src/reading-mode/utils/fragmentRenderer';

describe('document reference context in reading-mode fragments', () => {
    const renderMock = MarkdownRenderer.render as jest.Mock;
    const original = renderMock.getMockImplementation();

    beforeEach(() => {
        // Model the host's document-scoped reference table. This intentionally
        // resolves references only when the definition is in the rendered input.
        renderMock.mockImplementation(async (app: App, source: string, target: HTMLElement, ...rest: unknown[]) => {
            const definitions = new Map<string, string>();
            const body = source.replace(/^ {0,3}\[([^\]]+)\]:[ \t]*(https?:\/\/\S+)[ \t]*$/gm, (_line, label: string, href: string) => {
                if (!definitions.has(label.toLowerCase())) {
                    definitions.set(label.toLowerCase(), href);
                }
                return '';
            }).trim();
            const resolved = body.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (raw, text: string, label: string) => {
                const href = definitions.get(label.toLowerCase());
                return href ? `[${text}](${href})` : raw;
            });
            if (resolved) {
                await original?.(app, resolved, target, ...rest);
            }
        });
    });

    afterEach(() => {
        renderMock.mockImplementation(original);
    });

    it.each(['before', 'after'])('preserves document reference links defined %s an interrupted nested list', async position => {
        const fragment = 'Paragraph [lead][ref]\n- [parent][ref]\n  - CHILD_MUST_STAY';
        const definition = '[ref]: https://example.test';
        const fullSource = position === 'before' ? `${definition}\n\n${fragment}` : `${fragment}\n\n${definition}`;
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>Paragraph <a href="https://example.test">lead</a></p>' +
            '<ul><li><a href="https://example.test">parent</a><ul><li>CHILD_MUST_STAY</li></ul></li></ul>';
        const context = createContext(section, fragment);
        context.fullSource = fullSource;

        new NativeListSpacingProcessor().process(context);
        await new Promise(resolve => window.setTimeout(resolve, 80));

        expect(section.querySelectorAll('ul')).toHaveLength(0);
        expect(section.querySelectorAll('a')).toHaveLength(2);
        expect(Array.from(section.querySelectorAll('a')).map(link => link.getAttribute('href')))
            .toEqual(['https://example.test', 'https://example.test']);
        expect(section.textContent).toContain('CHILD_MUST_STAY');
        expect(section.textContent).not.toContain('[ref]');
    });

    it('resolves document references while validating a captured fenced-div closing', async () => {
        const source = '::: note\n- [parent][ref]\n  - CHILD_MUST_STAY\n:::\n\n[ref]: https://example.test';
        const section = document.createElement('div');
        section.innerHTML = '<p>::: note</p><ul><li><a href="https://example.test">parent</a>' +
            '<ul><li>CHILD_MUST_STAY<br>:::</li></ul></li></ul>';
        const link = section.querySelector('a');
        const child = section.querySelector('ul ul li');

        new FencedDivBlockProcessor().process(createContext(section, source));
        await waitForFencedDivRun(section);

        expect(section.querySelector('.pem-fenced-div a')).toBe(link);
        expect(section.querySelector('.pem-fenced-div ul ul li')).toBe(child);
        expect(child?.textContent).toBe('CHILD_MUST_STAY');
    });

    it.each([
        '```\n[ref]: https://wrong.test\n```',
        '<!--\n[ref]: https://wrong.test\n-->'
    ])('ignores opaque reference-looking source: %s', async opaqueSource => {
        const source = `${opaqueSource}\n\n[ref]: https://right.test\n\n[link][ref]`;
        const target = document.createElement('div');
        const context = createContext(target, source);

        await renderMarkdownFragment('[link][ref]', target, context, new MarkdownRenderChild(target));

        expect(isInternalMarkdownFragment(target)).toBe(true);
        expect(isInternalMarkdownFragment(target.firstElementChild as Element)).toBe(true);
        expect(target.querySelector('a')?.getAttribute('href')).toBe('https://right.test');
        expect(target.textContent).toBe('link');
    });

    it('keeps document-first duplicate definition precedence when the fragment contains a later definition', async () => {
        const fragment = '[ref]: https://second.test\n\n[link][ref]';
        const target = document.createElement('div');
        const context = createContext(target, `[ref]: https://first.test\n\n${fragment}`);

        await renderMarkdownFragment(fragment, target, context, new MarkdownRenderChild(target));

        expect(target.querySelector('a')?.getAttribute('href')).toBe('https://first.test');
        expect(target.textContent).toBe('link');
    });

    it('reads the full document once when preview sections omit its definitions', async () => {
        const target = document.createElement('div');
        const context = createContext(target, '[link][ref]');
        const cachedRead = jest.fn(async () => '[ref]: https://example.test\n\n[link][ref]');
        context.app = { vault: {
            getAbstractFileByPath: path => ({ path }),
            cachedRead
        } };

        await renderMarkdownFragment('[link][ref]', target, context, new MarkdownRenderChild(target));
        const secondTarget = document.createElement('div');
        await renderMarkdownFragment('[another][ref]', secondTarget, context, new MarkdownRenderChild(secondTarget));

        expect(target.querySelector('a')?.getAttribute('href')).toBe('https://example.test');
        expect(secondTarget.querySelector('a')?.getAttribute('href')).toBe('https://example.test');
        expect(cachedRead).toHaveBeenCalledTimes(1);
    });

    it('does not inject Pandoc-only reference source rejected by the host renderer', async () => {
        const source = '[ref]: https://example.test extra-unquoted-words\n\n[link][ref]';
        const target = document.createElement('div');
        const context = createContext(target, source);

        await renderMarkdownFragment('[link][ref]', target, context, new MarkdownRenderChild(target));

        expect(target.textContent).toBe('[link][ref]');
        expect(target.querySelector('a')).toBeNull();
    });

    it('does not promote reference-looking text inside an open paragraph to a definition', async () => {
        const source = 'Paragraph\n[ref]: https://not-a-definition.test\n\n[link][ref]';
        const target = document.createElement('div');
        const context = createContext(target, source);

        await renderMarkdownFragment('[link][ref]', target, context, new MarkdownRenderChild(target));

        expect(target.textContent).toBe('[link][ref]');
        expect(target.querySelector('a')).toBeNull();
    });

    it.each([
        '> [ref]: https://example.test\n\n[link][ref]',
        'Use[^n].\n\n[^n]:\n    [ref]: https://example.test\n\n[link][ref]'
    ])('lifts a source-owned container reference using normalized body lines', async source => {
        const target = document.createElement('div');
        const context = createContext(target, source);

        await renderMarkdownFragment('[link][ref]', target, context, new MarkdownRenderChild(target));

        expect(target.querySelector('a')?.getAttribute('href')).toBe('https://example.test');
        expect(target.textContent).toBe('link');
    });
});

function createContext(element: HTMLElement, source: string) {
    const postProcessor = {
        sourcePath: 'reference-fragments.md',
        getSectionInfo: () => ({ text: source, lineStart: 0, lineEnd: source.split('\n').length - 1 }),
        addChild: jest.fn()
    } as unknown as MarkdownPostProcessorContext;
    return createReadingModeContext(element, postProcessor, {
        strictLineBreaks: false,
        enableListsWithoutPrecedingBlankline: false,
        enableFencedDivs: true,
        enableReadableFencedDivSyntax: true
    }, {} as App);
}
