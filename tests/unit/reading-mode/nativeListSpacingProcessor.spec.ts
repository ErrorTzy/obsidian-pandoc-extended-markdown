import { MarkdownPostProcessorContext } from 'obsidian';

import { NativeListSpacingProcessor } from '../../../src/reading-mode/pipeline/processors/nativeListSpacingProcessor';
import { ReadingModeContext } from '../../../src/reading-mode/pipeline/types';

const source = [
    'Intro paragraph',
    '- invalid dash',
    '* invalid star',
    '+ invalid plus',
    'After unordered paragraph',
    '',
    '- valid dash',
    '* valid star',
    '+ valid plus',
    '',
    'Before ordered paragraph',
    '1. invalid ordered one',
    '2. invalid ordered two',
    'After ordered paragraph',
    '',
    '1. valid ordered one',
    '2. valid ordered two',
    ''
].join('\n');

describe('NativeListSpacingProcessor', () => {
    it('replaces invalid native reading-mode lists with plain source text', () => {
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = [
            '<p>Intro paragraph</p>',
            '<ul><li>invalid dash</li><li>invalid star</li>',
            '<li>invalid plus<br>After unordered paragraph</li></ul>',
            '<ul><li>valid dash</li><li>valid star</li><li>valid plus</li></ul>',
            '<p>Before ordered paragraph</p>',
            '<ol><li>invalid ordered one</li>',
            '<li>invalid ordered two<br>After ordered paragraph</li>',
            '<li>valid ordered one</li><li>valid ordered two</li></ol>'
        ].join('');

        const processor = new NativeListSpacingProcessor();
        processor.process(createContext(section));

        const listTexts = Array.from(section.querySelectorAll('li'))
            .map(item => item.textContent?.trim());

        expect(section.textContent).toContain('- invalid dash');
        expect(section.textContent).toContain('* invalid star');
        expect(section.textContent).toContain('+ invalid plus');
        expect(section.textContent).toContain('1. invalid ordered one');
        expect(section.textContent).toContain('2. invalid ordered two');
        expect(listTexts).toEqual([
            'valid dash',
            'valid star',
            'valid plus',
            'valid ordered one',
            'valid ordered two'
        ]);
    });
});

function createContext(section: HTMLElement): ReadingModeContext {
    const postProcessorContext = {
        sourcePath: 'native-list-spacing.md',
        getSectionInfo: jest.fn(() => ({
            text: source,
            lineStart: 0,
            lineEnd: source.split('\n').length
        }))
    } as unknown as MarkdownPostProcessorContext;

    return {
        element: section,
        postProcessorContext,
        section,
        sectionInfo: postProcessorContext.getSectionInfo(section),
        sourcePath: 'native-list-spacing.md',
        config: {
            strictLineBreaks: false,
            enforcePandocListSpacing: true,
            enableReadableFencedDivSyntax: true
        },
        counters: {
            exampleCounter: 0,
            exampleMap: new Map(),
            exampleContent: new Map(),
            hashCounter: 0,
            placeholderContext: {} as ReadingModeContext['counters']['placeholderContext'],
            fencedDivLabels: new Map()
        },
        validationLines: source.split('\n'),
        renderContext: {
            strictLineBreaks: false,
            getExampleNumber: () => undefined,
            getExampleContent: () => undefined
        }
    };
}
