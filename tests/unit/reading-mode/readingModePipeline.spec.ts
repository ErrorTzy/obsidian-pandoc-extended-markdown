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
        enforcePandocListSpacing: false,
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

    it('renders custom labels when Pandoc list spacing enforcement is enabled and custom label lists are enabled', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>{::P} Premise.</p><p>Therefore {::P}.</p>';
        const context = createPostProcessorContext('{::P} Premise.\n\nTherefore {::P}.');

        processReadingMode(element, context, createConfig({
            enforcePandocListSpacing: true,
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
            enforcePandocListSpacing: true,
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
