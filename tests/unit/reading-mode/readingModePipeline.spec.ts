import { MarkdownPostProcessorContext } from 'obsidian';

import { pluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ReadingModePipeline } from '../../../src/reading-mode/pipeline/ReadingModePipeline';
import { processInlineTextNodes } from '../../../src/reading-mode/pipeline/inline/textReplacementEngine';
import {
    InlineTextMatch,
    InlineTextProcessor,
    ReadingModeContext,
    ReadingModeProcessor
} from '../../../src/reading-mode/pipeline/types';
import { processReadingMode } from '../../../src/reading-mode/processor';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('reading mode pipeline', () => {
    const docPath = 'reading-mode-pipeline.md';

    const createPostProcessorContext = (text: string): MarkdownPostProcessorContext => ({
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

    const createConfig = (overrides: Partial<ProcessorConfig> = {}): ProcessorConfig => ({
        strictLineBreaks: false,
        enableListsWithoutPrecedingBlankline: true,
        enableHashLists: true,
        enableFancyLists: true,
        enableExampleLists: true,
        enableDefinitionLists: true,
        enableFencedDivs: true,
        enableSuperSubscripts: true,
        enableSuperscript: true,
        enableSubscript: true,
        enableCustomLabelLists: false,
        enableUnorderedListMarkerStyles: true,
        ...overrides
    });

    const createReadingContext = (element: HTMLElement): ReadingModeContext => ({
        element,
        postProcessorContext: createPostProcessorContext(element.textContent || ''),
        section: null,
        sectionInfo: null,
        sourcePath: docPath,
        config: createConfig(),
        renderContext: {
            strictLineBreaks: false
        },
        counters: pluginStateManager.getDocumentCounters(docPath),
        validationLines: []
    });

    afterEach(() => {
        pluginStateManager.clearAllStates();
        document.body.innerHTML = '';
    });

    it('runs processors in priority order', () => {
        const order: string[] = [];
        const pipeline = new ReadingModePipeline();

        pipeline.registerProcessor(createProcessor('late', 20, order));
        pipeline.registerProcessor(createProcessor('early', 10, order));

        pipeline.process(createReadingContext(document.createElement('div')));

        expect(order).toEqual(['early', 'late']);
    });

    it('skips disabled processors', () => {
        const order: string[] = [];
        const pipeline = new ReadingModePipeline();

        pipeline.registerProcessor({
            ...createProcessor('disabled', 10, order),
            isEnabled: () => false
        });
        pipeline.registerProcessor(createProcessor('enabled', 20, order));

        pipeline.process(createReadingContext(document.createElement('div')));

        expect(order).toEqual(['enabled']);
    });

    it('does not run inline processors inside code, pre, headings, or processed spans', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>target</p>',
            '<p><code>target</code></p>',
            '<pre>target</pre>',
            '<h2>target</h2>',
            '<p><span class="pem-example-reference">target</span></p>'
        ].join('');

        processInlineTextNodes(
            element,
            createReadingContext(element),
            [new LiteralInlineProcessor('target', 'hit', 1)]
        );

        expect(element.querySelectorAll('.hit')).toHaveLength(1);
        expect(element.querySelector('code')?.textContent).toBe('target');
        expect(element.querySelector('pre')?.textContent).toBe('target');
        expect(element.querySelector('h2')?.textContent).toBe('target');
        expect(element.querySelector('.pem-example-reference')?.textContent).toBe('target');
    });

    it('resolves overlapping inline matches by position and priority', () => {
        const element = document.createElement('div');
        element.textContent = 'abcd';

        processInlineTextNodes(
            element,
            createReadingContext(element),
            [
                new RangeInlineProcessor('wide', 0, 3, 10),
                new RangeInlineProcessor('narrow', 1, 2, 20),
                new RangeInlineProcessor('tail', 3, 4, 30)
            ]
        );

        expect(element.textContent).toBe('[wide][tail]');
    });

    it('does not duplicate inline replacements when processReadingMode runs twice', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>H~2~O and x^2^</p>';
        const config = createConfig({
            enableHashLists: false,
            enableFancyLists: false,
            enableExampleLists: false,
            enableDefinitionLists: false,
            enableFencedDivs: false,
            enableUnorderedListMarkerStyles: false
        });
        const context = createPostProcessorContext('H~2~O and x^2^');

        processReadingMode(element, context, config);
        processReadingMode(element, context, config);

        expect(element.querySelectorAll('sub.pem-subscript')).toHaveLength(1);
        expect(element.querySelectorAll('sup.pem-superscript')).toHaveLength(1);
        expect(element.textContent).toBe('H2O and x2');
    });

    it('renders custom labels when lists_without_preceding_blankline is disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>{::P} Premise.</p><p>Therefore {::P}.</p>';
        const context = createPostProcessorContext('{::P} Premise.\n\nTherefore {::P}.');

        processReadingMode(element, context, createConfig({
            enableListsWithoutPrecedingBlankline: false,
            enableCustomLabelLists: true
        }));

        expect(element.querySelector('.pem-list-marker')?.textContent).toBe('(P)');
        expect(element.querySelector('.pem-custom-label-reference-processed')?.textContent).toBe('(P)');
        expect(element.textContent).not.toContain('{::P}');
    });

    it('leaves custom labels raw when custom label lists are disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>{::P} Premise.</p><p>Therefore {::P}.</p>';
        const context = createPostProcessorContext('{::P} Premise.\n\nTherefore {::P}.');

        processReadingMode(element, context, createConfig({
            enableListsWithoutPrecedingBlankline: false,
            enableCustomLabelLists: false
        }));

        expect(element.querySelector('.pem-list-marker')).toBeNull();
        expect(element.querySelector('.pem-custom-label-reference-processed')).toBeNull();
        expect(element.textContent).toContain('{::P}');
    });

    it('leaves standalone decimal ordered lists native in reading mode', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>1. Native item</p>';
        const context = createPostProcessorContext('1. Native item');

        processReadingMode(element, context, createConfig());

        expect(element.querySelector('ol')).toBeNull();
        expect(element.textContent).toContain('1. Native item');
    });

    it('renders bridge decimal children inside extended ordered blocks in reading mode', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>I) Parent<br>    1. Child</p>';
        const context = createPostProcessorContext('I) Parent\n    1. Child');

        processReadingMode(element, context, createConfig());

        const rootList = element.querySelector('ol.pem-list-upper-roman');
        const nestedList = rootList?.querySelector('ol.pem-list-decimal');

        expect(rootList).not.toBeNull();
        expect(nestedList).not.toBeNull();
        expect(rootList?.querySelector(':scope > li')?.textContent).toContain('Parent');
        expect(nestedList?.querySelector('li')?.textContent).toContain('Child');
    });

    it('renders extended task list items with Pandoc content and Obsidian toggle metadata', () => {
        const markdown = [
            'A.  [X] checked',
            'B.  plain',
            'C.  [ ] unchecked'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = '<p>A.  [X] checked<br>B.  plain<br>C.  [ ] unchecked</p>';
        const context = createPostProcessorContext(markdown);

        processReadingMode(element, context, createConfig());

        const items = Array.from(element.querySelectorAll('ol[type="A"] > li'));
        const checkboxes = Array.from(
            element.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox')
        );

        expect(items).toHaveLength(3);
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes.map(checkbox => checkbox.checked)).toEqual([true, false]);
        expect(checkboxes.map(checkbox => checkbox.dataset.line)).toEqual(['0', '2']);
        expect(items[0].querySelector('label')?.textContent).toBe('checked');
        expect(items[1].textContent).toBe('plain');
        expect(items[2].querySelector('label')?.textContent).toBe('unchecked');
        expect(element.textContent).not.toContain('[X]');
        expect(element.textContent).not.toContain('[ ]');
    });

    it('keeps the rendered image in its original parenthesized list item', () => {
        const markdown = 'a) ![](data:image/png;base64,AAAA)\nb) Second item';
        const element = document.createElement('div');
        element.innerHTML = '<p>a) <img src="data:image/png;base64,AAAA"><br>b) Second item</p>';
        const image = element.querySelector('img');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const items = Array.from(element.querySelectorAll('ol.pem-list-paren > li'));
        expect(items).toHaveLength(2);
        expect(items[0].querySelector('img')).toBe(image);
        expect(items[1].textContent).toBe('Second item');
        expect(element.querySelectorAll('img')).toHaveLength(1);
    });

    it('removes a marker split across rendered text nodes without losing content', () => {
        const markdown = 'a) ![](x)';
        const element = document.createElement('div');
        element.innerHTML = '<p><span>a</span>) <img src="x"></p>';
        const image = element.querySelector('img');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        expect(element.querySelector('ol > li > img')).toBe(image);
        expect(element.querySelector('ol > li')?.textContent).toBe('');
    });

    it('leaves an unmappable rendered list line intact', () => {
        const markdown = 'a) text';
        const element = document.createElement('div');
        element.innerHTML = '<p><code>unmapped</code>a) text</p>';
        const originalCode = element.querySelector('code');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        expect(element.querySelector('ol')).toBeNull();
        expect(element.querySelector('code')).toBe(originalCode);
        expect(element.querySelector('p')?.textContent).toBe('unmappeda) text');
    });

    it('moves content across newline boundaries inside one text node', () => {
        const markdown = 'a) first\nb) ![](x)';
        const element = document.createElement('div');
        const paragraph = document.createElement('p');
        paragraph.appendChild(document.createTextNode('a) first\nb) '));
        const image = document.createElement('img');
        image.src = 'x';
        paragraph.appendChild(image);
        element.appendChild(paragraph);

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const items = element.querySelectorAll('ol > li');
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toBe('first');
        expect(items[1].querySelector('img')).toBe(image);
        expect(element.querySelectorAll('img')).toHaveLength(1);
    });

    it('keeps inline wrappers that span two logical list lines', () => {
        const markdown = 'a) first\nb) second';
        const element = document.createElement('div');
        element.innerHTML = '<p>a) <em>first<br>b) second</em></p>';

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const items = element.querySelectorAll('ol > li');
        expect(items).toHaveLength(2);
        expect(items[0].querySelector('em')?.textContent).toBe('first');
        expect(items[1].querySelector('em')?.textContent).toBe('second');
        expect(element.textContent).toBe('firstsecond');
    });

    it('keeps a paragraph prefix when its list suffix shares one text node', () => {
        const markdown = 'Intro\nA.  child';
        const element = document.createElement('div');
        const paragraph = document.createElement('p');
        paragraph.textContent = markdown;
        element.appendChild(paragraph);

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        expect(element.querySelector('p')?.textContent).toBe('Intro');
        expect(element.querySelector('ol > li')?.textContent).toBe('child');
        expect(element.textContent?.match(/child/g)).toHaveLength(1);
    });

    it.each([
        ['fancy', 'A.  ', 'B.  '],
        ['hash', '#. ', '#. '],
        ['example', '(@first) ', '(@second) ']
    ])('preserves rendered inline nodes in a later %s item', (_kind, first, second) => {
        const markdown = `${first}first\n${second}link bold code math image`;
        const element = document.createElement('div');
        element.innerHTML = `<p>${first}first<br>${second}` +
            '<a href="https://example.com">link</a> <em>bold</em> ' +
            '<code>code</code> <span class="math">math</span> ' +
            '<img src="data:image/png;base64,AAAA"></p>';
        const nodes = Array.from(element.querySelectorAll('a, em, code, .math, img'));

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const items = Array.from(element.querySelectorAll('ol > li'));
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toBe('first');
        nodes.forEach(node => expect(items[1].contains(node)).toBe(true));
        expect(element.querySelectorAll('img')).toHaveLength(1);
    });

    it('preserves rendered content after a paragraph prefix and in a nested native item', () => {
        const markdown = 'Prefix\n- parent\n  A.  ![](x)';
        const element = document.createElement('div');
        element.innerHTML = '<p>Prefix</p><ul><li>parent<br>\nA.  <img src="x"></li></ul>';
        const image = element.querySelector('img');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        expect(element.querySelector('ul > li > ol > li > img')).toBe(image);
        expect(element.querySelector('ul > li')?.textContent).toContain('parent');
        expect(element.querySelectorAll('img')).toHaveLength(1);
    });

    it('puts rendered task content inside the checkbox label', () => {
        const markdown = 'A.  [x] image';
        const element = document.createElement('div');
        element.innerHTML = '<p>A.  [x] <img src="x"></p>';
        const image = element.querySelector('img');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const label = element.querySelector('ol > li > label');
        expect(label?.querySelector('img')).toBe(image);
        expect(label?.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
        expect(element.querySelectorAll('img')).toHaveLength(1);
    });

    it('renders raw math in moved list text while retaining host-rendered math', () => {
        const markdown = 'A.  raw $x$\nB.  host math';
        const element = document.createElement('div');
        element.innerHTML = '<p>A.  raw $x$<br>B.  <span class="math">host math</span></p>';
        const hostMath = element.querySelector('.math');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const items = element.querySelectorAll('ol > li');
        expect(items[0].querySelector('.math-inline')).not.toBeNull();
        expect(items[1].querySelector('.math')).toBe(hostMath);
    });

    it('processes inline references once in moved example content', () => {
        const markdown = '(@first) first\n(@second) see (@first)';
        const element = document.createElement('div');
        element.innerHTML = '<p>(@first) first<br>(@second) see (@first)</p>';

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const second = element.querySelectorAll('ol.pem-example-list > li')[1];
        expect(second?.textContent).toBe('see (1)');
        expect(second?.querySelectorAll('.pem-example-reference')).toHaveLength(1);
        expect(element.textContent).not.toContain('(@first)');
    });

    it.each([
        ['b) second', 'a', '2', 'pem-list-lower-alpha'],
        ['B) second', 'A', '2', 'pem-list-upper-alpha'],
        ['ii) second', 'i', '2', 'pem-list-lower-roman'],
        ['II) second', 'I', '2', 'pem-list-upper-roman'],
        ['2) second', '1', '2', 'pem-list-decimal']
    ])('keeps the marker type and start value for %s', (markdown, type, start, className) => {
        const element = document.createElement('div');
        element.innerHTML = `<p>${markdown}</p>`;

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const list = element.querySelector('ol');
        expect(list?.getAttribute('type')).toBe(type);
        expect(list?.getAttribute('start')).toBe(start);
        expect(list?.classList.contains(className)).toBe(true);
        expect(list?.classList.contains('pem-list-paren')).toBe(true);
    });

    it('does not validate an interrupted extended list against an earlier duplicate line', () => {
        const markdown = [
            'A.  duplicate',
            '',
            'Paragraph',
            'A.  duplicate'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<p class="valid">A.  duplicate</p>',
            '<p class="interrupted">Paragraph<br>A.  duplicate</p>'
        ].join('');

        processReadingMode(
            element,
            createPostProcessorContext(markdown),
            createConfig({ enableListsWithoutPrecedingBlankline: false })
        );

        expect(element.querySelector('ol.pem-list-upper-alpha li')?.textContent)
            .toBe('duplicate');
        expect(element.querySelector('.interrupted ol')).toBeNull();
        expect(element.querySelector('.interrupted .pem-list-fancy-upper-alpha')).toBeNull();
        expect(element.querySelector('.interrupted')?.textContent)
            .toContain('A.  duplicate');
    });

    it('assigns duplicate standalone extended lists to their own source lines', () => {
        const markdown = [
            'A.  [ ] duplicate',
            '',
            'A.  [ ] duplicate'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>A.  [ ] duplicate</p>',
            '<p>A.  [ ] duplicate</p>'
        ].join('');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const sourceLines = Array.from(
            element.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox'),
            checkbox => checkbox.dataset.line
        );
        expect(sourceLines).toEqual(['0', '2']);
    });

    it('does not assign a rendered list to identical marker text inside a code fence', () => {
        const markdown = [
            '```',
            'A.  [ ] duplicate',
            '```',
            '',
            'A.  [ ] duplicate'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<pre><code>A.  [ ] duplicate</code></pre>',
            '<p>A.  [ ] duplicate</p>'
        ].join('');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        const checkbox = element.querySelector<HTMLInputElement>('.task-list-item-checkbox');
        expect(checkbox?.dataset.line).toBe('4');
        expect(element.querySelector('pre')?.textContent).toBe('A.  [ ] duplicate');
    });

    it('locates a list marker after host-rendered inline markup in the preceding line', () => {
        const markdown = 'Paragraph **with markup**\nA.  child';
        const element = document.createElement('div');
        element.innerHTML = '<p>Paragraph <strong>with markup</strong><br>A.  child</p>';

        processReadingMode(element, createPostProcessorContext(markdown), createConfig());

        expect(element.querySelector('ol[type="A"] > li')?.textContent).toBe('child');
        expect(element.querySelector('strong')?.textContent).toBe('with markup');
    });

    it.each([
        ['upper alpha', 'A.  ', 'ol[type="A"]'],
        ['default ordered', '#. ', 'ol:not([type])'],
        ['example', '(@example) ', 'ol.example[type="1"]']
    ])(
        'matches Pandoc paragraph interruption for a %s list in both extension modes',
        (_name, marker, listSelector) => {
            for (const enabled of [false, true]) {
                const markdown = `Paragraph\n${marker}CHILD_MUST_STAY`;
                const element = document.createElement('div');
                element.innerHTML = `<p>Paragraph<br>${marker}CHILD_MUST_STAY</p>`;

                processReadingMode(element, createPostProcessorContext(markdown), createConfig({
                    enableListsWithoutPrecedingBlankline: enabled
                }));

                const list = element.querySelector(listSelector);
                if (enabled) {
                    expect(Array.from(element.children).map(child => child.tagName))
                        .toEqual(['P', 'OL']);
                    expect(element.querySelector(':scope > p')?.textContent).toBe('Paragraph');
                    expect(list?.querySelector(':scope > li')?.textContent)
                        .toBe('CHILD_MUST_STAY');
                } else {
                    expect(list).toBeNull();
                    expect(element.querySelector(':scope > p')?.textContent)
                        .toContain(`${marker}CHILD_MUST_STAY`);
                }
            }
        }
    );

    it.each([false, true])(
        'renders an extended child as a nested list inside a native parent (extension=%s)',
        enabled => {
            const markdown = '- NATIVE_PARENT\n  A.  CHILD_MUST_STAY';
            const element = document.createElement('div');
            element.innerHTML = [
                '<ul><li><span class="list-bullet"></span>NATIVE_PARENT<br>',
                '\nA.  CHILD_MUST_STAY</li></ul>'
            ].join('');

            processReadingMode(element, createPostProcessorContext(markdown), createConfig({
                enableListsWithoutPrecedingBlankline: enabled
            }));

            const nativeItem = element.querySelector('ul > li');
            const nested = nativeItem?.querySelector(':scope > ol[type="A"]');
            expect(nativeItem?.textContent).toContain('NATIVE_PARENT');
            expect(nested?.querySelector(':scope > li')?.textContent).toBe('CHILD_MUST_STAY');
            expect(element.textContent?.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
        }
    );

    it('renders an extended child after a native parent interrupts a paragraph', () => {
        const markdown = [
            'Paragraph',
            '- NATIVE_PARENT',
            '  A.  CHILD_MUST_STAY'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>Paragraph</p>',
            '<ul><li data-line="0"><span class="list-bullet"></span>',
            'NATIVE_PARENT<br>\nA.  CHILD_MUST_STAY</li></ul>'
        ].join('');

        processReadingMode(element, createPostProcessorContext(markdown), createConfig({
            enableListsWithoutPrecedingBlankline: true
        }));

        const nativeItem = element.querySelector('ul > li');
        const nested = nativeItem?.querySelector(':scope > ol[type="A"]');
        expect(element.querySelector(':scope > p')?.textContent).toBe('Paragraph');
        expect(nativeItem?.textContent).toContain('NATIVE_PARENT');
        expect(nested?.querySelector(':scope > li')?.textContent).toBe('CHILD_MUST_STAY');
        expect(element.textContent?.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
    });

    it('uses absolute Obsidian section lines for a separately rendered native-list block', () => {
        const markdown = [
            'Paragraph',
            '- NATIVE_PARENT',
            '  A.  CHILD_MUST_STAY'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<ul><li><span class="list-bullet"></span>',
            'NATIVE_PARENT<br>\nA.  CHILD_MUST_STAY</li></ul>'
        ].join('');
        const context = createPostProcessorContext(markdown);
        (context.getSectionInfo as jest.Mock).mockReturnValue({
            text: markdown,
            lineStart: 1,
            lineEnd: 2
        });

        processReadingMode(element, context, createConfig({
            enableListsWithoutPrecedingBlankline: true
        }));

        const nativeItem = element.querySelector('ul > li');
        expect(nativeItem?.querySelector(':scope > ol[type="A"] > li')?.textContent)
            .toBe('CHILD_MUST_STAY');
        expect(element.textContent?.match(/CHILD_MUST_STAY/g)).toHaveLength(1);
    });

    it('keeps validation absolute but emits block-relative task source metadata', () => {
        const markdown = [
            'Paragraph',
            '',
            'A.  plain',
            '',
            '#. [x] HASH_TASK'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = '<p>#. [x] HASH_TASK</p>';
        const context = createPostProcessorContext(markdown);
        (context.getSectionInfo as jest.Mock).mockReturnValue({
            text: markdown,
            lineStart: 4,
            lineEnd: 4
        });

        processReadingMode(element, context, createConfig());

        const checkbox = element.querySelector<HTMLInputElement>('.task-list-item-checkbox');
        expect(checkbox?.dataset.line).toBe('0');
        expect(element.querySelector('ol > li')?.textContent).toContain('HASH_TASK');
    });
});

function createProcessor(
    name: string,
    priority: number,
    order: string[]
): ReadingModeProcessor {
    return {
        name,
        priority,
        phase: 'block',
        process: () => order.push(name)
    };
}

class LiteralInlineProcessor implements InlineTextProcessor {
    name = 'literal';
    phase = 'inline' as const;
    priority: number;

    constructor(
        private readonly literal: string,
        private readonly className: string,
        priority: number
    ) {
        this.priority = priority;
    }

    findMatches(text: string): InlineTextMatch[] {
        const start = text.indexOf(this.literal);
        return start >= 0
            ? [{ start, end: start + this.literal.length, type: this.name }]
            : [];
    }

    createReplacement(): Node {
        const span = document.createElement('span');
        span.className = this.className;
        span.textContent = this.literal;
        return span;
    }

    process(): void {
        return;
    }
}

class RangeInlineProcessor implements InlineTextProcessor {
    name: string;
    phase = 'inline' as const;
    priority: number;

    constructor(
        name: string,
        private readonly start: number,
        private readonly end: number,
        priority: number
    ) {
        this.name = name;
        this.priority = priority;
    }

    findMatches(): InlineTextMatch[] {
        return [{ start: this.start, end: this.end, type: this.name }];
    }

    createReplacement(): Node {
        return document.createTextNode(`[${this.name}]`);
    }

    process(): void {
        return;
    }
}
