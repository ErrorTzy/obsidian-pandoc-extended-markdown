import { EditorView } from '@codemirror/view';
import { EditorState, Text, EditorSelection } from '@codemirror/state';
import { HashListProcessor } from '../../../src/live-preview/pipeline/structural/HashListProcessor';
import { ProcessingContext } from '../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PlaceholderContext } from '../../../src/shared/utils/placeholderProcessor';

describe('HashListProcessor', () => {
    let processor: HashListProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    let container: HTMLElement;
    
    beforeEach(() => {
        processor = new HashListProcessor();
        
        container = document.createElement('div');
        document.body.appendChild(container);
        
        view = new EditorView({
            state: EditorState.create({ doc: '#. Test item' }),
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
        };
    });
    
    afterEach(() => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    const updateView = (doc: string) => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
        context.document = view.state.doc;
        context.view = view;
    };
    
    describe('canProcess', () => {
        it('should identify hash list syntax', () => {
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should reject non-hash list syntax', () => {
            updateView('Regular text');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should handle indented hash lists', () => {
            updateView('    #. Indented item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
    });
    
    describe('process', () => {
        it('should create structural decorations for hash list', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.decorations).toBeDefined();
            expect(result.decorations.length).toBeGreaterThan(0);
            expect(result.contentRegion).toBeDefined();
            expect(result.skipFurtherProcessing).toBe(true);
        });
        
        it('should increment hash counter', () => {
            const line = view.state.doc.line(1);
            const initialValue = context.hashCounter.value;
            processor.process(line, context);
            expect(context.hashCounter.value).toBe(initialValue + 1);
        });
        
        it('should mark content region correctly', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.type).toBe('list-content');
            expect(result.contentRegion!.parentStructure).toBe('hash-list');
            expect(result.contentRegion!.from).toBeGreaterThan(line.from);
            expect(result.contentRegion!.to).toBe(line.to);
        });
        
        it('should skip invalid lines in strict mode', () => {
            context.settings.strictPandocMode = true;
            context.invalidLines.add(1); // Line 1 is invalid
            
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.decorations.length).toBe(0);
            expect(result.contentRegion).toBeUndefined();
        });
        
        it('should handle cursor position correctly', () => {
            // Create a new view with selection in the marker area
            if (view && view.dom?.parentNode) {
                view.dom.parentNode.removeChild(view.dom);
            }
            view = new EditorView({
                state: EditorState.create({ 
                    doc: '#. Test item',
                    selection: EditorSelection.cursor(1)
                }),
                parent: container
            });
            context.document = view.state.doc;
            context.view = view;
            
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            // Should still create decorations but not replace when cursor is in marker
            expect(result.decorations.length).toBeGreaterThan(0);
            const hasReplaceDecoration = result.decorations.some(d => 
                d.decoration.spec?.widget !== undefined
            );
            // When cursor is in marker, we should not have replacement widget
            expect(hasReplaceDecoration).toBe(false);
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(10);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('hash-list');
        });
    });
});