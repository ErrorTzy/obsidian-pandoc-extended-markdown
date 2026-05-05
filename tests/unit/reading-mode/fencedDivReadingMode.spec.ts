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

    it('renders a Pandoc fenced div block and later @id references', () => {
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
        expect(fencedDiv?.textContent).toContain('Theorem:');
        expect(fencedDiv?.textContent).toContain('For a right triangle');
        expect(fencedDiv?.textContent).not.toContain(':::');

        const header = fencedDiv?.querySelector(`.${CSS_CLASSES.FENCED_DIV_HEADER}`);
        expect(header?.querySelector('.pem-fenced-div-title')?.textContent).toBe('Theorem:');

        const reference = element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`) as HTMLElement | null;
        expect(reference?.textContent).toBe('Theorem');
        expect(reference?.dataset.pandocDivRef).toBe('thm:pythagoras');
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
        expect(blocks[0].querySelector(':scope > .pem-fenced-div-content > .pem-fenced-div .pem-fenced-div-title')?.textContent).toBe('Inner:');
        expect(blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent)).toEqual([
            'Outer:',
            'Inner:',
            'Warning:'
        ]);
        expect(element.textContent).not.toContain(':::');

        const references = Array.from(element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`));
        expect(references.map(reference => reference.textContent)).toEqual(['Outer', 'Inner', 'Warning']);
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
