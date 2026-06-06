import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { FencedDivReferenceProcessor } from '../../../../src/live-preview/pipeline/inline/FencedDivReferenceProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('FencedDivReferenceProcessor', () => {
    let processor: FencedDivReferenceProcessor;
    let view: EditorView;
    let context: ProcessingContext;

    beforeEach(() => {
        processor = new FencedDivReferenceProcessor();
        const container = document.createElement('div');
        document.body.appendChild(container);

        view = new EditorView({
            state: EditorState.create({ doc: 'see @thm:label.' }),
            parent: container
        });

        context = {
            document: view.state.doc,
            view,
            settings: {
                enforcePandocListSpacing: false,
                enableFencedDivs: true,
                enableFencedDivExtras: true
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
            },
            fencedDivLabels: new Map([
                ['thm:label', {
                    label: 'thm:label',
                    title: '',
                    displayName: 'Theorem 1',
                    typeLabel: 'Theorem',
                    typeKey: 'theorem',
                    number: 1,
                    referenceText: 'Theorem 1',
                    blockTitleText: 'Theorem 1',
                    lineNumber: 1,
                    classes: ['theorem'],
                    content: 'content'
                }]
            ])
        } as ProcessingContext;
    });

    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });

    it('finds Pandoc citation syntax for known fenced div labels', () => {
        const region: ContentRegion = {
            from: 0,
            to: view.state.doc.length,
            type: 'normal'
        };

        const matches = processor.findMatches('see @thm:label.', region, context);

        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            from: 4,
            to: 14,
            type: 'fenced-div-ref',
            data: { label: 'thm:label' }
        });
    });

    it('ignores unknown citation labels', () => {
        const region: ContentRegion = {
            from: 0,
            to: view.state.doc.length,
            type: 'normal'
        };

        const matches = processor.findMatches('see @missing.', region, context);

        expect(matches).toHaveLength(0);
    });

    it('finds references when Pandoc list spacing enforcement and fenced div extras are enabled', () => {
        context.settings.enforcePandocListSpacing = true;
        const region: ContentRegion = {
            from: 0,
            to: view.state.doc.length,
            type: 'normal'
        };

        const matches = processor.findMatches('see @thm:label.', region, context);

        expect(matches).toHaveLength(1);
    });

    it('does not find references when fenced div extras are disabled', () => {
        context.settings.enableFencedDivExtras = false;
        const region: ContentRegion = {
            from: 0,
            to: view.state.doc.length,
            type: 'normal'
        };

        const matches = processor.findMatches('see @thm:label.', region, context);

        expect(matches).toHaveLength(0);
    });

    it('creates a reference widget with the resolved fenced div reference text', () => {
        const decoration = processor.createDecoration({
            from: 4,
            to: 14,
            type: 'fenced-div-ref',
            data: { label: 'thm:label', region: { from: 0 } }
        }, context);

        const widget = decoration.spec?.widget;
        expect(widget?.constructor.name).toBe('FencedDivReferenceWidget');
        expect(widget?.displayName).toBe('Theorem 1');
    });

    it('supports normal and fenced-div content regions', () => {
        expect(processor.supportedRegions.has('normal')).toBe(true);
        expect(processor.supportedRegions.has('fenced-div-content')).toBe(true);
    });
});
