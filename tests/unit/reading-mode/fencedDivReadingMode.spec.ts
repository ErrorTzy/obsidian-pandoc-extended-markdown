import { MarkdownPostProcessorContext } from 'obsidian';

import { processReadingMode } from '../../../src/reading-mode/processor';
import { CSS_CLASSES } from '../../../src/core/constants';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('fenced div reading mode rendering', () => {
    const docPath = 'fenced-div-reading-mode.md';

    const createContext = (text: string): MarkdownPostProcessorContext => ({
        sourcePath: docPath,
        docId: 'test',
        frontmatter: null,
        addChild: jest.fn(),
        getSectionInfo: jest.fn(() => ({
            text,
            lineStart: 0,
            lineEnd: text.split('\n').length - 1
        }))
    } as unknown as MarkdownPostProcessorContext);

    const createConfig = (
        overrides: Partial<ProcessorConfig & { enableFencedDivs: boolean }> = {}
    ): ProcessorConfig & { enableFencedDivs: boolean } => ({
        strictLineBreaks: false,
        strictPandocMode: false,
        enableSuperSubscripts: false,
        enableCustomLabelLists: false,
        enableFencedDivs: true,
        ...overrides
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a Pandoc fenced div block and later @id citations', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.theorem #thm:pythagoras}</p>',
            '<p>For a right triangle, a^2^ + b^2^ = c^2^.</p>',
            '<p>:::</p>',
            '<p>See @thm:pythagoras for the result.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.theorem #thm:pythagoras}',
                'For a right triangle, a^2^ + b^2^ = c^2^.',
                ':::',
                '',
                'See @thm:pythagoras for the result.'
            ].join('\n')),
            createConfig()
        );

        const fencedDiv = element.querySelector('.pem-fenced-div') as HTMLElement | null;
        expect(fencedDiv).toBeTruthy();
        expect(fencedDiv?.classList.contains('pem-fenced-div-theorem')).toBe(true);
        expect(fencedDiv?.dataset.pandocDivId).toBe('thm:pythagoras');
        expect(fencedDiv?.textContent).not.toContain('Theorem:');
        expect(fencedDiv?.textContent).toContain('For a right triangle');
        expect(fencedDiv?.textContent).not.toContain(':::');

        const title = fencedDiv?.querySelector(`.${CSS_CLASSES.FENCED_DIV_TITLE}`);
        expect(title?.textContent).toBe('Theorem 1');

        const reference = element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`) as HTMLElement | null;
        expect(reference?.dataset.pandocDivRef).toBe('thm:pythagoras');
        expect(reference?.textContent).toBe('Theorem 1');
        expect(element.textContent).not.toContain('@thm:pythagoras');
    });

    it('renders adjacent and nested fenced divs without leaking fence markers', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.outer #outer}</p>',
            '<p>Outer opening content.</p>',
            '<p>::: {.inner #inner}</p>',
            '<p>Nested content.</p>',
            '<p>:::</p>',
            '<p>::: {.warning #warn}</p>',
            '<p>Sibling warning.</p>',
            '<p>:::</p>',
            '<p>:::</p>',
            '<p>Refs @outer @inner @warn.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.outer #outer}',
                'Outer opening content.',
                '',
                '::: {.inner #inner}',
                'Nested content.',
                ':::',
                '::: {.warning #warn}',
                'Sibling warning.',
                ':::',
                ':::',
                '',
                'Refs @outer @inner @warn.'
            ].join('\n')),
            createConfig()
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div'));
        expect(blocks).toHaveLength(3);
        expect(blocks[0].querySelector(':scope > .pem-fenced-div-content > .pem-fenced-div .pem-fenced-div-title')?.textContent).toBe('Inner 1');
        expect(blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent)).toEqual([
            'Outer 1',
            'Inner 1',
            'Warning 1'
        ]);
        expect(element.textContent).not.toContain(':::');

        const references = Array.from(
            element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)
        ).map(reference => reference.textContent);
        expect(references).toEqual(['Outer 1', 'Inner 1', 'Warning 1']);
        expect(element.textContent).not.toContain('@outer @inner @warn');
    });

    it('renders readable shorthand and later @id citations in non-strict mode', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Theorem #thm data=1</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: Theorem #thm data=1\nReadable content.\n:::\n\nSee @thm.'),
            createConfig()
        );

        const fencedDiv = element.querySelector('.pem-fenced-div') as HTMLElement | null;
        expect(fencedDiv?.dataset.pandocDivId).toBe('thm');
        expect(fencedDiv?.querySelector('.pem-fenced-div-title')?.textContent).toBe('Theorem 1');
        const reference = element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`) as HTMLElement | null;
        expect(reference?.dataset.pandocDivRef).toBe('thm');
        expect(reference?.textContent).toBe('Theorem 1');
        expect(element.textContent).not.toContain('@thm');
    });

    it('renders explicit title shorthand and later @id citations in non-strict mode', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.logic #logic:a} explicit title after attributes</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>::: explicit title before attributes {.logic #logic:b}</p>',
            '<p>More readable content.</p>',
            '<p>:::</p>',
            '<p>See @logic:a and @logic:b.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.logic #logic:a} explicit title after attributes',
                'Readable content.',
                ':::',
                '::: explicit title before attributes {.logic #logic:b}',
                'More readable content.',
                ':::',
                '',
                'See @logic:a and @logic:b.'
            ].join('\n')),
            createConfig()
        );

        const titles = Array.from(element.querySelectorAll('.pem-fenced-div-title'))
            .map(title => title.textContent);
        expect(titles).toEqual([
            'explicit title after attributes 1',
            'explicit title before attributes 1'
        ]);

        const references = Array.from(
            element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)
        ).map(reference => reference.textContent);
        expect(references).toEqual([
            'explicit title after attributes 1',
            'explicit title before attributes 1'
        ]);
        expect(element.textContent).not.toContain('@logic:a');
        expect(element.textContent).not.toContain('@logic:b');
    });

    it('leaves readable shorthand untouched in strict mode', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Theorem #thm data=1</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: Theorem #thm data=1\nReadable content.\n:::\n\nSee @thm.'),
            createConfig({ strictPandocMode: true })
        );

        expect(element.querySelector('.pem-fenced-div')).toBeNull();
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)).toBeNull();
        expect(element.textContent).toContain('::: Theorem #thm data=1');
    });

    it('leaves fenced div syntax untouched when the feature is disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.note #note}</p>',
            '<p>Body.</p>',
            '<p>:::</p>',
            '<p>See @note.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: {.note #note}\nBody.\n:::\n\nSee @note.'),
            createConfig({ enableFencedDivs: false })
        );

        expect(element.querySelector('.pem-fenced-div')).toBeNull();
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)).toBeNull();
        expect(element.textContent).toContain('::: {.note #note}');
        expect(element.textContent).toContain('@note');
    });
});
