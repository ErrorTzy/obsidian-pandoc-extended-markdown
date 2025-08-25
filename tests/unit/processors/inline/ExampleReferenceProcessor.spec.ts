import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ExampleReferenceProcessor } from '../../../../src/live-preview/pipeline/inline/ExampleReferenceProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('ExampleReferenceProcessor', () => {
    let processor: ExampleReferenceProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    
    beforeEach(() => {
        processor = new ExampleReferenceProcessor();
        
        const container = document.createElement('div');
        document.body.appendChild(container);
        
        view = new EditorView({
            state: EditorState.create({ doc: 'Text with (@example) reference' }),
            parent: container
        });
        
        context = {
            document: view.state.doc,
            view,
            settings: {
                strictPandocMode: false,
                autoRenumberLists: false,
                moreExtendedSyntax: false,
                panelOrder: [],
                useNewPipeline: true
            },
            exampleLabels: new Map([['example', 1]]),
            exampleContent: new Map([['example', 'Example content']]),
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
        };
    });
    
    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });
    
    describe('findMatches', () => {
        it('should find example references in text', () => {
            const text = 'Text with (@example) reference';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches.length).toBe(1);
            expect(matches[0].type).toBe('example-ref');
            expect(matches[0].data.label).toBe('example');
        });
        
        it('should find multiple references', () => {
            const text = 'First (@example) and second (@example) references';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches.length).toBe(2);
            expect(matches[0].from).toBeLessThan(matches[1].from);
        });
        
        it('should ignore references to non-existent labels', () => {
            const text = 'Reference to (@nonexistent) label';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches.length).toBe(0);
        });
        
        it('should handle references with underscores and hyphens', () => {
            context.exampleLabels.set('test_label-1', 2);
            const text = 'Reference to (@test_label-1)';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches.length).toBe(1);
            expect(matches[0].data.label).toBe('test_label-1');
        });
    });
    
    describe('createDecoration', () => {
        it('should create decoration with correct widget', () => {
            const match = {
                from: 10,
                to: 20,
                type: 'example-ref',
                data: { label: 'example', rawText: '(@example)' }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
            expect(decoration.spec?.widget?.constructor.name).toBe('ExampleReferenceWidget');
        });
        
        it('should pass correct number and content to widget', () => {
            const match = {
                from: 10,
                to: 20,
                type: 'example-ref',
                data: { label: 'example', rawText: '(@example)' }
            };
            
            const decoration = processor.createDecoration(match, context);
            const widget = decoration.spec?.widget;
            
            expect(widget).toBeDefined();
            // Widget should have the correct properties
            expect(widget.number).toBe(1);
            expect(widget.tooltipText).toBe('Example content');
        });
    });
    
    describe('supportedRegions', () => {
        it('should support correct region types', () => {
            expect(processor.supportedRegions.has('list-content')).toBe(true);
            expect(processor.supportedRegions.has('definition-content')).toBe(true);
            expect(processor.supportedRegions.has('paragraph')).toBe(true);
            expect(processor.supportedRegions.has('normal')).toBe(true);
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(10);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('example-reference');
        });
    });
});