import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ProcessingPipeline } from '../../../../src/live-preview/pipeline/ProcessingPipeline';
import {
    SmartDashProcessor,
    renderPandocDashRun
} from '../../../../src/live-preview/pipeline/inline/SmartDashProcessor';
import { ContentRegion, ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { DEFAULT_SETTINGS, PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PluginStateManager } from '../../../../src/core/state/pluginStateManager';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('SmartDashProcessor', () => {
    let processor: SmartDashProcessor;
    let view: EditorView;
    let container: HTMLElement;

    const createView = (doc: string, cursorPos?: number): void => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({
                doc,
                selection: cursorPos !== undefined ? EditorSelection.cursor(cursorPos) : undefined
            }),
            parent: container
        });
    };

    const createContext = (): ProcessingContext => ({
        document: view.state.doc,
        view,
        settings: { ...DEFAULT_SETTINGS },
        exampleLabels: new Map(),
        exampleContent: new Map(),
        exampleLineNumbers: new Map(),
        duplicateExampleLabels: new Map(),
        duplicateExampleContent: new Map(),
        customLabels: new Map(),
        rawToProcessed: new Map(),
        duplicateCustomLabels: new Set(),
        placeholderContext: new PlaceholderContext(),
        invalidLines: new Set(),
        contentRegions: [],
        structuralDecorations: [],
        inlineDecorations: [],
        hashCounter: { value: 1 },
        definitionState: {
            lastWasItem: false,
            pendingBlankLine: false
        }
    });

    const createRegion = (text: string): ContentRegion => ({
        from: 0,
        to: text.length,
        type: 'normal'
    });

    beforeEach(() => {
        processor = new SmartDashProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('');
    });

    afterEach(() => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        container.remove();
    });

    it('renders Pandoc dash runs greedily', () => {
        expect(renderPandocDashRun('--')).toBe('\u2013');
        expect(renderPandocDashRun('---')).toBe('\u2014');
        expect(renderPandocDashRun('----')).toBe('\u2014-');
        expect(renderPandocDashRun('-----')).toBe('\u2014\u2013');
        expect(renderPandocDashRun('------')).toBe('\u2014\u2014');
    });

    it('finds double and triple dash runs as whole replacements', () => {
        const text = 'double -- and triple ---';
        createView(text);

        const matches = processor.findMatches(text, createRegion(text), createContext());

        expect(matches).toHaveLength(2);
        expect(matches[0]).toMatchObject({
            from: 7,
            to: 9,
            type: 'smart-dash',
            data: {
                renderedText: '\u2013',
                rawText: '--'
            }
        });
        expect(matches[1]).toMatchObject({
            from: 21,
            to: 24,
            data: {
                renderedText: '\u2014',
                rawText: '---'
            }
        });
    });

    it('does not replace escaped dash runs', () => {
        const text = 'escaped \\-- but double backslash \\\\-- renders';
        createView(text);

        const matches = processor.findMatches(text, createRegion(text), createContext());

        expect(matches).toHaveLength(1);
        expect(matches[0].from).toBe(text.indexOf('\\\\--') + 2);
        expect(matches[0].data.renderedText).toBe('\u2013');
    });

    it('does not create a match while the cursor is inside the source dash run', () => {
        const text = 'expand -- here';
        createView(text, text.indexOf('--') + 1);

        const matches = processor.findMatches(text, createRegion(text), createContext());

        expect(matches).toHaveLength(0);
    });

    it('does not create matches when smart dash rendering is disabled', () => {
        const text = 'double -- and triple ---';
        createView(text);
        const context = createContext();
        context.settings.enableSmartDashes = false;

        const matches = processor.findMatches(text, createRegion(text), context);

        expect(matches).toHaveLength(0);
    });

    it('creates a SmartDashWidget decoration with rendered text', () => {
        const text = 'triple ---';
        createView(text);
        const match = processor.findMatches(text, createRegion(text), createContext())[0];

        const decoration = processor.createDecoration(match, createContext());
        const widget = decoration.spec?.widget as { constructor: { name: string }; toDOM: () => HTMLElement };

        expect(widget.constructor.name).toBe('SmartDashWidget');
        expect(widget.toDOM().textContent).toBe('\u2014');
    });
});

describe('SmartDashProcessor pipeline integration', () => {
    let container: HTMLElement;
    let view: EditorView;
    let pipeline: ProcessingPipeline;
    let settings: PandocExtendedMarkdownSettings;

    const updateView = (doc: string): void => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
    };

    const getSmartDashWidgets = (): Array<{ toDOM: () => HTMLElement }> => {
        const decorations = pipeline.process(view, settings) as unknown as {
            decorations: Array<{ decoration: { spec: { widget?: unknown } } }>;
        };

        return decorations.decorations
            .map(entry => entry.decoration.spec.widget)
            .filter(widget => (widget as { constructor?: { name?: string } } | undefined)?.constructor?.name === 'SmartDashWidget') as Array<{ toDOM: () => HTMLElement }>;
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        view = new EditorView({
            state: EditorState.create({ doc: '' }),
            parent: container
        });
        pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerInlineProcessor(new SmartDashProcessor());
        settings = { ...DEFAULT_SETTINGS };
    });

    afterEach(() => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        container.remove();
    });

    it('skips fenced code blocks, inline code, and math blocks', () => {
        updateView([
            'normal --',
            '`code --`',
            '$$',
            'math --',
            '$$',
            '```',
            'code --',
            '```',
            'after ---'
        ].join('\n'));

        const renderedTexts = getSmartDashWidgets().map(widget => widget.toDOM().textContent);

        expect(renderedTexts).toEqual(['\u2013', '\u2014']);
    });
});
