import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { FencedDivProcessor } from '../../../src/live-preview/pipeline/structural/FencedDivProcessor';
import { FencedDivReferenceProcessor } from '../../../src/live-preview/pipeline/inline/FencedDivReferenceProcessor';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';

const pandocRejectedShortcutOpenings: Array<[string, string]> = [
    ['example_1', '::: example_1 {.attr}'],
    ['example_2', ':::example_2 {.attr}'],
    ['example_3', '::: example_3 {#id3}'],
    ['example_4', ':::example_4 {#id4}'],
    ['example_5', '::: {.attr} example_5'],
    ['example_6', ':::{.attr} example_6'],
    ['example_7', '::: {example_7, .attr}']
];

const pandocRejectedShortcutDocuments: Array<[string, string]> = pandocRejectedShortcutOpenings.flatMap(
    ([name, opening]) => [
        [`${name} block`, `${opening}\n${name} content\n:::`],
        [`${name} text on opener`, `${opening} ${name} content\n:::`],
        [`${name} one-line div`, `${opening} ${name} content :::`]
    ]
);

const pandocValidFencedDivDocuments: Array<[string, string, boolean]> = [
    ['braced class and id', '::: {.attr #valid_attr}\ncontent\n:::\n\nsee @valid_attr.', true],
    ['unspaced braced class and id', ':::{.attr #valid_unspaced}\ncontent\n:::\n\nsee @valid_unspaced.', true],
    ['unbraced shortcut class', '::: validShortcut\ncontent\n:::', false],
    ['unspaced unbraced shortcut class', ':::validShortcut\ncontent\n:::', false],
    ['id-only braced attributes', '::: {#valid_id}\ncontent\n:::\n\nsee @valid_id.', true],
    ['visual trailing colons', '::: {.attr #valid_visual} ::::::\ncontent\n:::\n\nsee @valid_visual.', true]
];

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

    it('renders readable shorthand blocks and @id references in non-strict mode', () => {
        updateView('::: Theorem #thm data=1\ncontent\n:::\n\nsee @thm.');

        const widgetNames = getWidgetNames();

        expect(widgetNames).toContain('FencedDivHeaderWidget');
        expect(widgetNames).toContain('FencedDivClosingWidget');
        expect(widgetNames).toContain('FencedDivReferenceWidget');
    });

    it('leaves readable shorthand unrendered in strict mode', () => {
        settings.strictPandocMode = true;
        updateView('::: Theorem #thm data=1\ncontent\n:::\n\nsee @thm.');

        const widgetNames = getWidgetNames();

        expect(widgetNames).not.toContain('FencedDivHeaderWidget');
        expect(widgetNames).not.toContain('FencedDivClosingWidget');
        expect(widgetNames).not.toContain('FencedDivReferenceWidget');
    });

    it('does not render invalid comma-separated attributes that Pandoc treats as text', () => {
        updateView('::: {.theorem, #thm:label}\ncontent\n:::\n\nsee @thm:label.');

        const widgetNames = getWidgetNames();

        expect(widgetNames).not.toContain('FencedDivHeaderWidget');
        expect(widgetNames).not.toContain('FencedDivReferenceWidget');
    });

    it.each(pandocValidFencedDivDocuments)('renders documented valid fenced div form: %s', (_name, doc, hasReference) => {
        updateView(doc);

        const widgetNames = getWidgetNames();
        const countWidgets = (widgetName: string): number =>
            widgetNames.filter(name => name === widgetName).length;

        expect(countWidgets('FencedDivHeaderWidget')).toBe(1);
        expect(countWidgets('FencedDivClosingWidget')).toBe(1);
        expect(countWidgets('FencedDivReferenceWidget')).toBe(hasReference ? 1 : 0);
    });

    it.each(pandocRejectedShortcutDocuments)('does not render Pandoc-rejected %s', (_name, doc) => {
        updateView(`${doc}\n\nReferences @id3 and @id4.`);

        const widgetNames = getWidgetNames();

        expect(widgetNames).not.toContain('FencedDivHeaderWidget');
        expect(widgetNames).not.toContain('FencedDivClosingWidget');
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
