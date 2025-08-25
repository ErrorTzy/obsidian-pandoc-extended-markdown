import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { SuperscriptProcessor } from '../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { SubscriptProcessor } from '../../../src/live-preview/pipeline/inline/SubscriptProcessor';
import { ProcessingContext, ContentRegion } from '../../../src/live-preview/pipeline/types';

describe('Superscript and Subscript Click Expansion', () => {
    let supProcessor: SuperscriptProcessor;
    let subProcessor: SubscriptProcessor;
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
    
    const createContext = (): ProcessingContext => ({
        document: view.state.doc,
        view,
        settings: {
            strictPandocMode: false,
            autoRenumberLists: false,
            moreExtendedSyntax: true,
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
        placeholderContext: undefined,
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
        supProcessor = new SuperscriptProcessor();
        subProcessor = new SubscriptProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('Test with ^super^ and ~sub~ text');
        context = createContext();
    });
    
    afterEach(() => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    describe('Superscript', () => {
        it('should create widget with correct position for click handler', () => {
            const text = 'Text with ^super^ here';
            createView(text);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = supProcessor.findMatches(text, region, context);
            expect(matches).toHaveLength(1);
            
            const decoration = supProcessor.createDecoration(matches[0], context);
            const widget = decoration.spec?.widget as any;
            
            // The widget should be created with the correct absolute position
            // ^super^ starts at position 10
            expect(widget).toBeDefined();
            expect(widget.pos).toBe(10);
            
            // Create DOM element and test click handler
            const dom = widget.toDOM();
            expect(dom).toBeDefined();
            expect(dom.tagName).toBe('SUP');
            expect(dom.textContent).toBe('super');
            
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
            expect(dispatchedPosition).toBe(10);
        });
        
        it('should NOT create widget when cursor is inside superscript', () => {
            const text = 'Text with ^super^ here';
            // Place cursor at position 12 (inside ^super^)
            createView(text, 12);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = supProcessor.findMatches(text, region, context);
            
            // Should not find any matches when cursor is inside
            expect(matches).toHaveLength(0);
        });
    });
    
    describe('Subscript', () => {
        it('should create widget with correct position for click handler', () => {
            const text = 'Text with ~sub~ here';
            createView(text);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = subProcessor.findMatches(text, region, context);
            expect(matches).toHaveLength(1);
            
            const decoration = subProcessor.createDecoration(matches[0], context);
            const widget = decoration.spec?.widget as any;
            
            // The widget should be created with the correct absolute position
            // ~sub~ starts at position 10
            expect(widget).toBeDefined();
            expect(widget.pos).toBe(10);
            
            // Create DOM element and test click handler
            const dom = widget.toDOM();
            expect(dom).toBeDefined();
            expect(dom.tagName).toBe('SUB');
            expect(dom.textContent).toBe('sub');
            
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
            expect(dispatchedPosition).toBe(10);
        });
        
        it('should NOT create widget when cursor is inside subscript', () => {
            const text = 'Text with ~sub~ here';
            // Place cursor at position 12 (inside ~sub~)
            createView(text, 12);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = subProcessor.findMatches(text, region, context);
            
            // Should not find any matches when cursor is inside
            expect(matches).toHaveLength(0);
        });
    });
    
    describe('Combined super and subscript', () => {
        it('should handle both when neither has cursor', () => {
            const text = 'Text with ^super^ and ~sub~ here';
            createView(text);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            expect(supMatches).toHaveLength(1);
            expect(subMatches).toHaveLength(1);
        });
        
        it('should hide superscript when cursor is in it but show subscript', () => {
            const text = 'Text with ^super^ and ~sub~ here';
            // Place cursor at position 12 (inside ^super^)
            createView(text, 12);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            expect(supMatches).toHaveLength(0); // Hidden because cursor is inside
            expect(subMatches).toHaveLength(1); // Still visible
        });
        
        it('should hide subscript when cursor is in it but show superscript', () => {
            const text = 'Text with ^super^ and ~sub~ here';
            // Place cursor at position 24 (inside ~sub~)
            createView(text, 24);
            context = createContext();
            
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            expect(supMatches).toHaveLength(1); // Still visible
            expect(subMatches).toHaveLength(0); // Hidden because cursor is inside
        });
    });
});