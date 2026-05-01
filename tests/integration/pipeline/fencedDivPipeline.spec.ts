import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { FencedDivProcessor } from '../../../src/live-preview/pipeline/structural/FencedDivProcessor';
import { FencedDivReferenceProcessor } from '../../../src/live-preview/pipeline/inline/FencedDivReferenceProcessor';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('fenced div live-preview pipeline', () => {
    let view: EditorView;
    let container: HTMLElement;
    let pipeline: ProcessingPipeline;
    let settings: PandocExtendedMarkdownSettings;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        view = new EditorView({
            state: EditorState.create({ doc: '' }),
            parent: container
        });
        pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerStructuralProcessor(new FencedDivProcessor());
        pipeline.registerInlineProcessor(new FencedDivReferenceProcessor());
        settings = {
            strictPandocMode: false,
            autoRenumberLists: false,
            enableFencedDivs: true,
            enableListPanel: true,
            panelOrder: [],
            unorderedListMarkerOrder: ['-', '+', '*'],
            orderedListMarkerOrder: ['decimal-dot']
        } as PandocExtendedMarkdownSettings;
    });

    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });

    const updateView = (doc: string): void => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
    };

    const getWidgetNames = (): string[] => {
        const decorations = pipeline.process(view, settings) as unknown as {
            decorations: Array<{ decoration: { spec: Record<string, unknown> } }>;
        };

        return decorations.decorations
            .map(entry => entry.decoration.spec.widget)
            .filter(Boolean)
            .map(widget => (widget as { constructor: { name: string } }).constructor.name);
    };

    it('renders Pandoc fenced div blocks and @id references', () => {
        updateView('::: {.theorem #thm:label}\ncontent\n:::\n\nsee @thm:label.');

        const widgetNames = getWidgetNames();

        expect(widgetNames).toContain('FencedDivHeaderWidget');
        expect(widgetNames).toContain('FencedDivClosingWidget');
        expect(widgetNames).toContain('FencedDivReferenceWidget');
    });

    it('does not render invalid comma-separated attributes that Pandoc treats as text', () => {
        updateView('::: {.theorem, #thm:label}\ncontent\n:::\n\nsee @thm:label.');

        const widgetNames = getWidgetNames();

        expect(widgetNames).not.toContain('FencedDivHeaderWidget');
        expect(widgetNames).not.toContain('FencedDivReferenceWidget');
    });

    it('renders adjacent fenced divs without requiring a blank line between them', () => {
        updateView('::: {.first}\none\n:::\n::: {.second}\ntwo\n:::');

        const headerCount = getWidgetNames()
            .filter(name => name === 'FencedDivHeaderWidget')
            .length;

        expect(headerCount).toBe(2);
    });

    it('renders a nested fenced div immediately after the parent opening fence', () => {
        updateView('::: {.outer}\n::: {.inner}\ncontent\n:::\n:::');

        const headerCount = getWidgetNames()
            .filter(name => name === 'FencedDivHeaderWidget')
            .length;

        expect(headerCount).toBe(2);
    });

    it('does not render a nested fenced div after paragraph text without a blank line', () => {
        updateView('::: {.outer}\nparagraph\n::: {.inner}\ncontent\n:::\n:::');

        const headerCount = getWidgetNames()
            .filter(name => name === 'FencedDivHeaderWidget')
            .length;

        expect(headerCount).toBe(1);
    });

    it('renders a nested fenced div after paragraph text when separated by a blank line', () => {
        updateView('::: {.outer}\nparagraph\n\n::: {.inner}\ncontent\n:::\n:::');

        const headerCount = getWidgetNames()
            .filter(name => name === 'FencedDivHeaderWidget')
            .length;

        expect(headerCount).toBe(2);
    });

    it('renders a fenced div immediately after an ATX heading', () => {
        updateView('# Heading\n::: {.note}\ncontent\n:::');

        expect(getWidgetNames()).toContain('FencedDivHeaderWidget');
    });

    it('renders a fenced div immediately after a fenced code block', () => {
        updateView('```\ncode\n```\n::: {.note}\ncontent\n:::');

        expect(getWidgetNames()).toContain('FencedDivHeaderWidget');
    });

    it('does not render a fenced div immediately after inline HTML span text', () => {
        updateView('<span>x</span>\n::: {.note}\ncontent\n:::');

        expect(getWidgetNames()).not.toContain('FencedDivHeaderWidget');
    });

    it('does not render indented openings that Pandoc treats as text', () => {
        updateView(' ::: {.note}\ncontent\n:::');

        expect(getWidgetNames()).not.toContain('FencedDivHeaderWidget');
    });
});
