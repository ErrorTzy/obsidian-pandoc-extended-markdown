import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { CustomLabelReferenceProcessor } from '../../../../src/live-preview/pipeline/inline/CustomLabelReferenceProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('CustomLabelReferenceProcessor', () => {
    let processor: CustomLabelReferenceProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    let container: HTMLElement;
    
    const createView = (doc: string, cursorPos?: number) => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        const state = EditorState.create({ 
            doc,
            selection: cursorPos !== undefined ? EditorSelection.cursor(cursorPos) : undefined
        });
        view = new EditorView({
            state,
            parent: container
        });
    };
    
    const createContext = (moreExtendedSyntax: boolean = true): ProcessingContext => ({
        document: view.state.doc,
        view,
        settings: {
            strictPandocMode: false,
            autoRenumberLists: false,
            moreExtendedSyntax,
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
        processor = new CustomLabelReferenceProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('Text with {::label} reference');
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
    
    describe('findMatches', () => {
        it('should find basic custom label reference when cursor is outside', () => {
            // Add the label to customLabels to make it valid
            context.customLabels.set('mylabel', 'Label content');
            
            const text = 'Text with {::mylabel} reference';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].from).toBe(10);
            expect(matches[0].to).toBe(21);
            expect(matches[0].data.rawLabel).toBe('mylabel');
        });
        
        it('should NOT find matches when cursor is inside the reference', () => {
            const text = 'Text with {::mylabel} reference';
            // Place cursor at position 15 (inside {::mylabel})
            createView(text, 15);
            context = createContext();
            context.customLabels.set('mylabel', 'Label content');
            
            // Verify cursor position is set correctly
            expect(context.view.state.selection.main.head).toBe(15);
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            // Should not find any matches when cursor is inside
            expect(matches).toHaveLength(0);
        });
        
        it('should find multiple custom label references', () => {
            // Add the labels to customLabels to make them valid
            context.customLabels.set('first', 'First content');
            context.customLabels.set('second', 'Second content');
            
            const text = '{::first} and {::second} references';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(2);
            expect(matches[0].data.rawLabel).toBe('first');
            expect(matches[1].data.rawLabel).toBe('second');
        });
        
        it('should find references with placeholders', () => {
            // Set up placeholder context and labels to make them valid
            context.placeholderContext.processLabel('P(#a)');
            context.placeholderContext.processLabel('Q(#b)');
            context.placeholderContext.processLabel('R(#c)');
            context.rawToProcessed.set('P(#a)', 'P1');
            context.customLabels.set('P1', 'P1 content');
            
            const text = 'References {::P(#a)} and {::Q(#b),(#c)}';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(2);
            expect(matches[0].data.rawLabel).toBe('P(#a)');
            expect(matches[1].data.rawLabel).toBe('Q(#b),(#c)');
        });
        
        it('should not find matches when moreExtendedSyntax is disabled', () => {
            context = createContext(false); // Disable moreExtendedSyntax
            const text = 'Text with {::label} reference';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(0);
        });
        
        it('should handle references with underscores and hyphens', () => {
            // Add the label to customLabels to make it valid
            context.customLabels.set('label_with-dash', 'Content');
            
            const text = 'References {::label_with-dash} here';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].data.rawLabel).toBe('label_with-dash');
        });
        
        it('should store full match in data', () => {
            // Add the label to customLabels to make it valid
            context.customLabels.set('label', 'Content');
            
            const text = 'Text with {::label} reference';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches[0].data.fullMatch).toBe('{::label}');
        });
    });
    
    describe('createDecoration', () => {
        it('should create a replace decoration with CustomLabelReferenceWidget', () => {
            context.customLabels.set('mylabel', 'Label content');
            
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'mylabel',
                    fullMatch: '{::mylabel}',
                    absoluteFrom: 10
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
            expect(decoration.spec?.widget?.constructor.name).toBe('CustomLabelReferenceWidget');
        });
        
        it('should use processed label from rawToProcessed map', () => {
            context.rawToProcessed.set('P(#a)', 'P(1)');
            context.customLabels.set('P(1)', 'Processed content');
            
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'P(#a)',
                    fullMatch: '{::P(#a)}',
                    absoluteFrom: 10
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
        });
        
        it('should process placeholders when not in rawToProcessed map', () => {
            const placeholderContext = new PlaceholderContext();
            placeholderContext.getPlaceholderValue = (letter: string) => {
                if (letter === 'a') return 1;
                if (letter === 'b') return 2;
                return undefined;
            };
            context.placeholderContext = placeholderContext;
            context.customLabels.set('P(1)', 'Content for P(1)');
            
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'P(#a)',
                    fullMatch: '{::P(#a)}',
                    absoluteFrom: 10
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
        });
        
        it('should create DuplicateCustomLabelWidget for duplicate labels', () => {
            context.duplicateCustomLabels.add('duplicate');
            context.duplicateCustomLineInfo = new Map([
                ['duplicate', { firstLine: 5, firstContent: 'First occurrence' }]
            ]);
            
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'duplicate',
                    fullMatch: '{::duplicate}',
                    absoluteFrom: 10
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
            expect(decoration.spec?.widget?.constructor.name).toBe('DuplicateCustomLabelWidget');
        });
        
        it('should fall back to raw label when no processing is available', () => {
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'unknown',
                    fullMatch: '{::unknown}',
                    absoluteFrom: 10
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
        });
    });
    
    describe('supportedRegions', () => {
        it('should support list-content regions', () => {
            expect(processor.supportedRegions.has('list-content')).toBe(true);
        });
        
        it('should support definition-content regions', () => {
            expect(processor.supportedRegions.has('definition-content')).toBe(true);
        });
        
        it('should support paragraph regions', () => {
            expect(processor.supportedRegions.has('paragraph')).toBe(true);
        });
        
        it('should support normal regions', () => {
            expect(processor.supportedRegions.has('normal')).toBe(true);
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(40);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('custom-label-reference');
        });
    });
    
    describe('widget click handler', () => {
        it('should create widget with correct position for click handler', () => {
            context.customLabels.set('mylabel', 'Label content');
            
            const match: InlineMatch = {
                from: 10,
                to: 21,
                type: 'custom-label-ref',
                data: {
                    rawLabel: 'mylabel',
                    fullMatch: '{::mylabel}',
                    absoluteFrom: 15  // This is the absolute position in the document
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            const widget = decoration.spec?.widget as any;
            
            // The widget should be created with the correct absolute position
            expect(widget).toBeDefined();
            expect(widget.position).toBe(15);
            
            // Create DOM element and test click handler
            const dom = widget.toDOM();
            expect(dom).toBeDefined();
            expect(dom.tagName).toBe('SPAN');
            
            // Simulate click event
            const clickEvent = new MouseEvent('mousedown');
            let dispatchCalled = false;
            let dispatchedPosition: number | undefined;
            
            // Mock the view dispatch
            widget.view = {
                dispatch: (action: any) => {
                    dispatchCalled = true;
                    dispatchedPosition = action.selection?.anchor;
                },
                focus: () => {}
            };
            
            dom.dispatchEvent(clickEvent);
            
            // Check that dispatch was called with correct position
            expect(dispatchCalled).toBe(true);
            expect(dispatchedPosition).toBe(15);
        });
    });
});

// Type declaration for InlineMatch to match the implementation
interface InlineMatch {
    from: number;
    to: number;
    type: string;
    data: any;
}