import { EditorView } from '@codemirror/view';
import { EditorState, Text, EditorSelection } from '@codemirror/state';
import { ExampleListProcessor } from '../../../../src/live-preview/pipeline/structural/ExampleListProcessor';
import { ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('ExampleListProcessor', () => {
    let processor: ExampleListProcessor;
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
        processor = new ExampleListProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('(@example) Test item');
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
    
    describe('canProcess', () => {
        it('should identify example list syntax', () => {
            createView('(@label) Example item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should identify example list with single character label', () => {
            createView('(@a) Item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should identify example list with multi-character label', () => {
            createView('(@example123) Item with long label');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should reject non-example list syntax', () => {
            createView('Regular text');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should reject fancy lists', () => {
            createView('A. Not an example list');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should handle indented example lists', () => {
            createView('    (@indented) Indented example');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should reject malformed example list syntax', () => {
            createView('@ Missing parentheses');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
    });
    
    describe('process', () => {
        it('should create structural decorations for example list', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.decorations).toBeDefined();
            expect(result.decorations.length).toBeGreaterThan(0);
            expect(result.contentRegion).toBeDefined();
            expect(result.skipFurtherProcessing).toBe(true);
        });
        
        it('should mark content region correctly', () => {
            createView('(@label) Test content');
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.type).toBe('list-content');
            expect(result.contentRegion!.parentStructure).toBe('example-list');
            expect(result.contentRegion!.from).toBe(line.from + 9); // After "(@label) "
            expect(result.contentRegion!.to).toBe(line.to);
        });
        
        it('should include label metadata in content region', () => {
            createView('(@mylabel) Content');
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion?.metadata).toBeDefined();
            expect(result.contentRegion?.metadata.label).toBe('mylabel');
            expect(result.contentRegion?.metadata.isDuplicate).toBe(false);
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
            // Place cursor in the marker area
            if (view && view.dom?.parentNode) {
                view.dom.parentNode.removeChild(view.dom);
            }
            view = new EditorView({
                state: EditorState.create({ 
                    doc: '(@example) Test item',
                    selection: EditorSelection.cursor(3) // Inside "(@example)"
                }),
                parent: container
            });
            context.document = view.state.doc;
            context.view = view;
            context = createContext(); // Recreate context to get updated cursor position
            
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            // Should still create decorations but not replace when cursor is in marker
            expect(result.decorations.length).toBeGreaterThan(0);
            
            // Check for replace decoration
            const hasReplaceDecoration = result.decorations.some(d => 
                d.decoration.spec?.widget !== undefined
            );
            expect(hasReplaceDecoration).toBe(false);
        });
        
        it('should use example number from context when available', () => {
            createView('(@example) Test item');
            context = createContext();
            context.exampleLabels.set('example', 42);
            context.exampleLineNumbers.set(1, 42);
            
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            const replaceDecoration = result.decorations.find(d => 
                d.decoration.spec?.widget !== undefined
            );
            expect(replaceDecoration).toBeDefined();
        });
        
        it('should handle duplicate labels correctly', () => {
            createView('(@duplicate) Second occurrence');
            context = createContext();
            context.duplicateExampleLabels.set('duplicate', 5); // First occurred at line 5
            context.duplicateExampleContent.set('duplicate', 'First occurrence');
            context.duplicateExampleLineNumbers = new Set([1]); // Mark THIS line as duplicate
            
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            // Should use duplicate widget
            const replaceDecoration = result.decorations.find(d => 
                d.decoration.spec?.widget !== undefined
            );
            expect(replaceDecoration).toBeDefined();
            
            // Check metadata - isDuplicate should be true since line 1 is in duplicateExampleLineNumbers
            expect(result.contentRegion?.metadata.isDuplicate).toBe(true);
        });
        
        it('should create line decoration with correct CSS classes', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            const lineDecoration = result.decorations.find(d => 
                d.decoration.spec?.class?.includes('HyperMD-list-line')
            );
            expect(lineDecoration).toBeDefined();
            expect(lineDecoration!.decoration.spec?.class).toContain('HyperMD-list-line');
            expect(lineDecoration!.decoration.spec?.class).toContain('pem-list-line');
        });
        
        it('should wrap content area with mark decoration', () => {
            createView('(@label) Test content');
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            const markDecoration = result.decorations.find(d => 
                d.decoration.spec?.class === 'cm-list-1'
            );
            expect(markDecoration).toBeDefined();
            expect(markDecoration!.from).toBe(line.from + 9); // After "(@label) "
            expect(markDecoration!.to).toBe(line.to);
        });
        
        it('should handle different indentation levels', () => {
            createView('    (@indented) Indented content');
            context = createContext();
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.from).toBe(line.from + 16); // After "    (@indented) "
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(30);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('example-list');
        });
    });
});