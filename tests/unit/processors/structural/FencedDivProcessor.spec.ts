import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { FencedDivProcessor } from '../../../../src/live-preview/pipeline/structural/FencedDivProcessor';
import { ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('FencedDivProcessor', () => {
    let processor: FencedDivProcessor;
    let view: EditorView;
    let container: HTMLElement;

    const createContext = (
        doc: string,
        settings?: Partial<PandocExtendedMarkdownSettings>
    ): ProcessingContext => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }

        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });

        return {
            document: view.state.doc,
            view,
            settings: {
                strictPandocMode: false,
                enableFencedDivs: true,
                ...settings
            } as PandocExtendedMarkdownSettings,
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
            },
            fencedDivLabels: new Map([
                ['thm:label', {
                    label: 'thm:label',
                    displayName: 'Theorem',
                    number: 1,
                    lineNumber: 1,
                    classes: ['theorem'],
                    content: 'content'
                }]
            ]),
            fencedDivStack: []
        };
    };

    beforeEach(() => {
        processor = new FencedDivProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });

    describe('canProcess', () => {
        it('recognizes a Pandoc braced fenced div opening', () => {
            const context = createContext('::: {.theorem #thm:label}\ncontent\n:::');
            expect(processor.canProcess(context.document.line(1), context)).toBe(true);
        });

        it('recognizes a Pandoc unbraced class opening with trailing colons', () => {
            const context = createContext('::: Warning ::::::\ncontent\n:::');
            expect(processor.canProcess(context.document.line(1), context)).toBe(true);
        });

        it('does not recognize comma-separated attributes rejected by Pandoc', () => {
            const context = createContext('::: {.theorem, #thm:label}\ncontent\n:::');
            expect(processor.canProcess(context.document.line(1), context)).toBe(false);
        });

        it('does not recognize a colon fence without attributes as an opening', () => {
            const context = createContext('::::\ncontent\n::::');
            expect(processor.canProcess(context.document.line(1), context)).toBe(false);
        });

        it('recognizes closing fences only while inside a fenced div', () => {
            const context = createContext('::: {.note}\ncontent\n:::');
            context.fencedDivStack = [{ classes: ['note'], openingLine: 1 }];

            expect(processor.canProcess(context.document.line(3), context)).toBe(true);
        });
    });

    describe('process', () => {
        it('replaces an opening fence with a header widget', () => {
            const context = createContext('::: {.theorem #thm:label}\ncontent\n:::');
            const result = processor.process(context.document.line(1), context);
            const headerDom = result.decorations[1].decoration.spec?.widget?.toDOM();

            expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-fenced-div-open');
            expect(result.decorations[1].decoration.spec?.widget?.constructor.name).toBe('FencedDivHeaderWidget');
            expect(headerDom?.querySelector('.pem-fenced-div-title')?.textContent).toBe('Theorem 1:');
            expect(headerDom?.querySelector('.pem-fenced-div-source-handle')).toBeNull();
            expect(headerDom?.textContent).toBe('Theorem 1:');
            expect(context.fencedDivStack).toHaveLength(1);
            expect(context.fencedDivStack?.[0].label).toBe('thm:label');
        });

        it('does not replace an opening fence while the cursor is editing it', () => {
            const context = createContext('::: {.theorem #thm:label}\ncontent\n:::');
            view.dispatch({ selection: EditorSelection.cursor(2) });
            context.view = view;

            const result = processor.process(context.document.line(1), context);

            expect(result.decorations[1].decoration.spec?.class).toContain('cm-pem-fenced-div-marker-cursor');
        });

        it('marks content lines without blocking other processors', () => {
            const context = createContext('::: {.theorem #thm:label}\ncontent with ^sup^\n:::');
            context.fencedDivStack = [{
                label: 'thm:label',
                classes: ['theorem'],
                openingLine: 1
            }];

            const result = processor.process(context.document.line(2), context);

            expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-fenced-div-content');
            expect(result.contentRegion).toBeUndefined();
            expect(result.skipFurtherProcessing).toBe(false);
        });

        it('treats blank content lines as normal fenced div content', () => {
            const context = createContext('::: {.theorem #thm:label}\n\nEvery compact metric space is complete.\n\n:::');
            context.fencedDivStack = [{
                label: 'thm:label',
                classes: ['theorem'],
                openingLine: 1
            }];

            const afterOpening = processor.process(context.document.line(2), context);
            const beforeClosing = processor.process(context.document.line(4), context);

            expect(afterOpening.decorations[0].decoration.spec?.class).toContain('cm-pem-fenced-div-content');
            expect(beforeClosing.decorations[0].decoration.spec?.class).toContain('cm-pem-fenced-div-content');
            expect(afterOpening.decorations[0].decoration.spec?.class).not.toContain('cm-pem-fenced-div-blank');
            expect(beforeClosing.decorations[0].decoration.spec?.class).not.toContain('cm-pem-fenced-div-blank');
            expect(afterOpening.skipFurtherProcessing).toBe(false);
        });

        it('replaces a closing fence and pops the active fenced div', () => {
            const context = createContext('::: {.theorem #thm:label}\ncontent\n:::');
            context.fencedDivStack = [{
                label: 'thm:label',
                classes: ['theorem'],
                openingLine: 1
            }];

            const result = processor.process(context.document.line(3), context);

            expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-fenced-div-close');
            expect(result.decorations[1].decoration.spec?.widget?.constructor.name).toBe('FencedDivClosingWidget');
            expect(result.decorations[1].decoration.spec?.widget?.toDOM().textContent).toBe('');
            expect(context.fencedDivStack).toHaveLength(0);
        });
    });

    describe('metadata', () => {
        it('has the expected processor identity', () => {
            expect(processor.name).toBe('fenced-div');
            expect(processor.priority).toBe(18);
        });
    });
});
