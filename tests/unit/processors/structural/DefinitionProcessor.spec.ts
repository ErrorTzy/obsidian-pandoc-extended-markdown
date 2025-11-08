import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { DefinitionProcessor } from '../../../../src/live-preview/pipeline/structural/DefinitionProcessor';
import { ProcessingContext } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('DefinitionProcessor', () => {
    let processor: DefinitionProcessor;
    let view: EditorView;
    let context: ProcessingContext;
    let container: HTMLElement;
    
    const createContext = (doc: string, settings?: Partial<PandocExtendedMarkdownSettings>): ProcessingContext => {
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
            }
        };
    };
    
    beforeEach(() => {
        processor = new DefinitionProcessor();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    
    afterEach(() => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });
    
    describe('canProcess', () => {
        it('should return true for definition items with colon', () => {
            context = createContext(': Definition item');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should return true for definition items with tilde', () => {
            context = createContext('~ Another definition');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should return true for indented definition items', () => {
            context = createContext('  : Indented definition');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should return true for definition terms', () => {
            context = createContext('Term\n: Definition');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should return true for terms with blank line before definition', () => {
            context = createContext('Term\n\n: Definition');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(true);
        });
        
        it('should return false for regular text', () => {
            context = createContext('Regular text');
            const line = context.document.line(1);
            expect(processor.canProcess(line, context)).toBe(false);
        });
        
        it('should return true for indented content after definition', () => {
            context = createContext(': Definition\n    Indented content');
            context.definitionState.lastWasItem = true;
            const line = context.document.line(2);
            expect(processor.canProcess(line, context)).toBe(true);
        });
    });
    
    describe('process', () => {
        describe('definition items', () => {
            it('should create bullet widget for colon marker', () => {
                context = createContext(': Definition item');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.decorations[0].from).toBe(0);
                expect(result.decorations[0].to).toBe(2); // ": "
                expect(result.decorations[0].decoration.spec?.widget?.constructor.name).toBe('DefinitionBulletWidget');
            });
            
            it('should create bullet widget for tilde marker', () => {
                context = createContext('~ Definition item');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.decorations[0].decoration.spec?.widget?.constructor.name).toBe('DefinitionBulletWidget');
            });
            
            it('should create content region for inline processing', () => {
                context = createContext(': Definition with (@ref)');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.contentRegion).toBeDefined();
                expect(result.contentRegion?.from).toBe(2); // After ": "
                expect(result.contentRegion?.to).toBe(24); // End of line
                expect(result.contentRegion?.type).toBe('definition-content');
                expect(result.contentRegion?.parentStructure).toBe('definition');
            });
            
            it('should not replace marker when cursor is inside it', () => {
                context = createContext(': Definition');
                view.dispatch({ selection: EditorSelection.cursor(1) }); // Cursor in marker
                context.view = view; // Update context with new view state
                
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                // When cursor is in marker, we create a mark decoration instead of replace
                expect(result.decorations[0].decoration.spec?.class).toBe('cm-pem-definition-marker-cursor');
            });
            
            it('should update definition state', () => {
                context = createContext(': Definition');
                const line = context.document.line(1);
                processor.process(line, context);
                
                expect(context.definitionState.lastWasItem).toBe(true);
                expect(context.definitionState.pendingBlankLine).toBe(false);
            });
            
            it('should skip processing in strict mode for invalid lines', () => {
                context = createContext(': Definition', { strictPandocMode: true });
                context.invalidLines.add(0);
                
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(0);
                expect(result.contentRegion).toBeUndefined();
            });
        });
        
        describe('definition terms', () => {
            it('should mark term line with strong style', () => {
                context = createContext('Term\n: Definition');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.decorations[0].from).toBe(0);
                expect(result.decorations[0].to).toBe(4); // "Term"
                expect(result.decorations[0].decoration.spec?.class).toContain('cm-strong');
                expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-definition-term');
            });
            
            it('should handle terms with blank line before definition', () => {
                context = createContext('Term\n\n: Definition');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-definition-term');
            });
            
            it('should not mark as content region', () => {
                context = createContext('Term\n: Definition');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.contentRegion).toBeUndefined();
            });
            
            it('should set skipFurtherProcessing', () => {
                context = createContext('Term\n: Definition');
                const line = context.document.line(1);
                const result = processor.process(line, context);
                
                expect(result.skipFurtherProcessing).toBe(true);
            });
        });
        
        describe('indented content', () => {
            it('should mark indented content with paragraph style', () => {
                context = createContext(': Definition\n    Indented paragraph');
                context.definitionState.lastWasItem = true;
                
                const line = context.document.line(2);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.decorations[0].decoration.spec?.class).toContain('cm-pem-definition-paragraph');
            });
            
            it('should create content region for indented content', () => {
                context = createContext(': Definition\n    Indented with (@ref)');
                context.definitionState.lastWasItem = true;
                
                const line = context.document.line(2);
                const result = processor.process(line, context);
                
                expect(result.contentRegion).toBeDefined();
                expect(result.contentRegion?.type).toBe('definition-content');
                expect(result.contentRegion?.parentStructure).toBe('definition');
            });
            
            it('should handle pending blank line state', () => {
                context = createContext(': Definition\n\n    Indented content');
                context.definitionState.pendingBlankLine = true;
                
                const line = context.document.line(3);
                const result = processor.process(line, context);
                
                expect(result.decorations).toHaveLength(1);
                expect(result.contentRegion).toBeDefined();
            });
        });
    });
    
    describe('priority', () => {
        it('should have correct priority', () => {
            expect(processor.priority).toBe(20);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('definition-list');
        });
    });
});