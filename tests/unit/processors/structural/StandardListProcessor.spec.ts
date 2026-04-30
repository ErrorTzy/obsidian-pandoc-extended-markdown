import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { StandardListProcessor } from '../../../../src/live-preview/pipeline/structural/StandardListProcessor';
import { ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('StandardListProcessor', () => {
    let processor: StandardListProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    let container: HTMLElement;

    const createView = (doc: string) => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }

        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });

        context.document = view.state.doc;
        context.view = view;
    };

    const createContext = (): ProcessingContext => ({
        document: view.state.doc,
        view,
        settings: {
            strictPandocMode: false,
            autoRenumberLists: false,
            enableCustomLabelLists: false,
            panelOrder: [],
            useNewPipeline: true
        },
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

    const getLineClass = (doc: string): string => {
        createView(doc);
        const line = view.state.doc.line(1);

        expect(processor.canProcess(line, context)).toBe(true);

        const result = processor.process(line, context);

        expect(result.decorations).toHaveLength(1);
        expect(result.contentRegion).toBeUndefined();
        expect(result.skipFurtherProcessing).toBeUndefined();

        return result.decorations[0].decoration.spec.class as string;
    };

    beforeEach(() => {
        processor = new StandardListProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);

        view = new EditorView({
            state: EditorState.create({ doc: '- item' }),
            parent: container
        });
        context = createContext();
    });

    afterEach(() => {
        if (view?.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('adds the dash marker class to dash unordered list lines', () => {
        expect(getLineClass('- item')).toContain('pem-unordered-list-marker-dash');
    });

    it('adds the plus marker class to plus unordered list lines', () => {
        expect(getLineClass('    + item')).toContain('pem-unordered-list-marker-plus');
    });

    it('adds the star marker class to star unordered list lines', () => {
        expect(getLineClass('        * item')).toContain('pem-unordered-list-marker-star');
    });

    it('does not replace or claim unordered list content', () => {
        const lineClass = getLineClass('- item');

        expect(lineClass).toContain('pem-unordered-list-marker');
        expect(lineClass).toContain('HyperMD-list-line');
    });

    it('skips marker classes when unordered marker rendering is disabled', () => {
        context.settings.enableUnorderedListMarkerStyles = false;
        createView('+ item');
        const line = view.state.doc.line(1);

        expect(processor.canProcess(line, context)).toBe(false);
        expect(processor.process(line, context).decorations).toHaveLength(0);
    });

    it('rejects ordered and regular lines', () => {
        createView('1. ordered item');
        expect(processor.canProcess(view.state.doc.line(1), context)).toBe(false);

        createView('regular text');
        expect(processor.canProcess(view.state.doc.line(1), context)).toBe(false);
    });
});
