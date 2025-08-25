import { EditorView } from '@codemirror/view';
import { EditorState, Text, EditorSelection } from '@codemirror/state';
import { FancyListProcessor } from '../../../../src/live-preview/pipeline/structural/FancyListProcessor';
import { ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('FancyListProcessor', () => {
    let processor: FancyListProcessor;
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
        processor = new FancyListProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
        createView('A. Test item');
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
        it('should identify uppercase letters with period', () => {
            createView('A. First item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should identify lowercase letters with period', () => {
            createView('a. First item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should identify uppercase roman numerals', () => {
            createView('IV. Fourth item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should identify lowercase roman numerals with parenthesis', () => {
            createView('iii) Third item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should reject regular decimal numbers', () => {
            createView('1. Regular list');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should reject bullet lists', () => {
            createView('- Bullet list');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should handle indented fancy lists', () => {
            createView('    A. Indented item');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should handle multiple letter markers', () => {
            createView('ABC. Multiple letters');
            const line = view.state.doc.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
    });
    
    describe('process', () => {
        it('should create structural decorations for fancy list', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.decorations).toBeDefined();
            expect(result.decorations.length).toBeGreaterThan(0);
            expect(result.contentRegion).toBeDefined();
            expect(result.skipFurtherProcessing).toBe(true);
        });
        
        it('should mark content region correctly', () => {
            createView('A. Test content');
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.type).toBe('list-content');
            expect(result.contentRegion!.parentStructure).toBe('fancy-list');
            expect(result.contentRegion!.from).toBe(line.from + 3); // After "A. "
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
            // Place cursor in the marker area
            if (view && view.dom?.parentNode) {
                view.dom.parentNode.removeChild(view.dom);
            }
            view = new EditorView({
                state: EditorState.create({ 
                    doc: 'A. Test item',
                    selection: EditorSelection.cursor(1)
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
        
        it('should create line decoration with correct CSS classes', () => {
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            const lineDecoration = result.decorations.find(d => 
                d.decoration.spec?.class?.includes('HyperMD-list-line')
            );
            expect(lineDecoration).toBeDefined();
            expect(lineDecoration!.decoration.spec?.class).toContain('HyperMD-list-line');
            expect(lineDecoration!.decoration.spec?.class).toContain('pandoc-list-line');
        });
        
        it('should wrap content area with mark decoration', () => {
            createView('A. Test content');
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            const markDecoration = result.decorations.find(d => 
                d.decoration.spec?.class === 'cm-list-1'
            );
            expect(markDecoration).toBeDefined();
            expect(markDecoration!.from).toBe(line.from + 3); // After "A. "
            expect(markDecoration!.to).toBe(line.to);
        });
        
        it('should handle different delimiters correctly', () => {
            createView('a) Item with parenthesis');
            context = createContext();
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.from).toBe(line.from + 3); // After "a) "
        });
        
        it('should handle roman numerals correctly', () => {
            createView('IV. Roman numeral item');
            context = createContext();
            const line = view.state.doc.line(1);
            const result = processor.process(line, context);
            
            expect(result.contentRegion).toBeDefined();
            expect(result.contentRegion!.from).toBe(line.from + 4); // After "IV. "
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(20);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('fancy-list');
        });
    });
});