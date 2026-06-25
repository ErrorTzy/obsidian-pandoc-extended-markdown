import { MarkdownPostProcessorContext } from 'obsidian';

import { CSS_CLASSES } from '../../../src/core/constants';
import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('smart dash processing in reading mode', () => {
    const createPostProcessorContext = (text: string): MarkdownPostProcessorContext => ({
        sourcePath: 'smart-dash-reading-mode.md',
        docId: 'test',
        frontmatter: null,
        addChild: jest.fn(),
        getSectionInfo: jest.fn(() => ({
            text,
            lineStart: 0,
            lineEnd: text.split('\n').length - 1
        }))
    } as unknown as MarkdownPostProcessorContext);

    const createConfig = (overrides: Partial<ProcessorConfig> = {}): ProcessorConfig => ({
        strictLineBreaks: false,
        enforcePandocListSpacing: false,
        enableReadableFencedDivSyntax: true,
        enableHashLists: false,
        enableFancyLists: false,
        enableExampleLists: false,
        enableDefinitionLists: false,
        enableFencedDivs: false,
        enableSuperSubscripts: false,
        enableSuperscript: false,
        enableSubscript: false,
        enableSmartDashes: true,
        enableCustomLabelLists: false,
        enableUnorderedListMarkerStyles: false,
        ...overrides
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders Pandoc dash runs greedily', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>double -- triple --- longer ---- ----- ------</p>';

        processReadingMode(
            element,
            createPostProcessorContext('double -- triple --- longer ---- ----- ------'),
            createConfig()
        );

        const rendered = Array.from(element.querySelectorAll(`.${CSS_CLASSES.SMART_DASH}`))
            .map(span => span.textContent);

        expect(rendered).toEqual(['\u2013', '\u2014', '\u2014-', '\u2014\u2013', '\u2014\u2014']);
        expect(element.textContent).toBe('double \u2013 triple \u2014 longer \u2014- \u2014\u2013 \u2014\u2014');
    });

    it('leaves escaped dash runs raw and renders double-backslash dash runs', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>escaped \\-- raw and double slash \\\\-- renders</p>';

        processReadingMode(
            element,
            createPostProcessorContext('escaped \\-- raw and double slash \\\\-- renders'),
            createConfig()
        );

        const rendered = Array.from(element.querySelectorAll(`.${CSS_CLASSES.SMART_DASH}`))
            .map(span => span.textContent);

        expect(rendered).toEqual(['\u2013']);
        expect(element.textContent).toBe('escaped \\-- raw and double slash \\\\\u2013 renders');
    });

    it('skips code, preformatted, headings, math, and existing smart dash spans', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>normal --</p>',
            '<p><code>code --</code></p>',
            '<pre>pre --</pre>',
            '<h2>heading --</h2>',
            '<p><span class="math">math --</span></p>',
            '<p><span class="pem-smart-dash">--</span></p>'
        ].join('');

        processReadingMode(
            element,
            createPostProcessorContext('normal --\ncode --\npre --\nheading --\nmath --\n--'),
            createConfig()
        );

        expect(element.querySelectorAll(`.${CSS_CLASSES.SMART_DASH}`)).toHaveLength(2);
        expect(element.querySelector('code')?.textContent).toBe('code --');
        expect(element.querySelector('pre')?.textContent).toBe('pre --');
        expect(element.querySelector('h2')?.textContent).toBe('heading --');
        expect(element.querySelector('.math')?.textContent).toBe('math --');
    });

    it('leaves dash runs raw when smart dashes are disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>double -- triple ---</p>';

        processReadingMode(
            element,
            createPostProcessorContext('double -- triple ---'),
            createConfig({ enableSmartDashes: false })
        );

        expect(element.querySelector(`.${CSS_CLASSES.SMART_DASH}`)).toBeNull();
        expect(element.textContent).toBe('double -- triple ---');
    });
});
