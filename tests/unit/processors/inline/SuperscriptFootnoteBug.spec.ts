import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { SuperscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('SuperscriptProcessor - Footnote Bug', () => {
    let processor: SuperscriptProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    let container: HTMLElement;

    const createView = (doc: string) => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
    };

    const createContext = (): ProcessingContext => ({
        document: view.state.doc,
        view,
        settings: {
            strictPandocMode: false,
            autoRenumberLists: false,
            moreExtendedSyntax: false,
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

    beforeEach(() => {
        processor = new SuperscriptProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('Test text');
        context = createContext();
    });

    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('should not match footnotes', () => {
        it('should not match footnote references', () => {
            const text = 'Some text with footnote [^1] reference';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            expect(matches).toHaveLength(0);
        });

        it('should not match multiple footnotes on the same line', () => {
            const text = 'aaa [^1] aaa [^2] aaa';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            expect(matches).toHaveLength(0);
        });

        it('should not match footnote with longer labels', () => {
            const text = 'Text with [^note] and [^longerlabel] footnotes';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            expect(matches).toHaveLength(0);
        });

        it('should correctly match superscripts even with footnotes present', () => {
            const text = 'Text with ^superscript^ and footnote [^1]';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            // Should only match the superscript, not the footnote
            expect(matches).toHaveLength(1);
            expect(matches[0].data.content).toBe('superscript');
            expect(matches[0].from).toBe(10);
            expect(matches[0].to).toBe(23);
        });

        it('should handle mixed superscripts and footnotes', () => {
            const text = '2^2^=4 and see [^1] and [^2] for details';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            // Should only match the superscript 2^2^
            expect(matches).toHaveLength(1);
            expect(matches[0].data.content).toBe('2');
            expect(matches[0].from).toBe(1);
            expect(matches[0].to).toBe(4);
        });

        it('should not create false matches between square brackets', () => {
            const text = 'Array access like arr[^index] should not match';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };

            const matches = processor.findMatches(text, region, context);

            expect(matches).toHaveLength(0);
        });
    });
});