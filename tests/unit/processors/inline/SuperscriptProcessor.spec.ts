import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { SuperscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('SuperscriptProcessor', () => {
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
        createView('Text with ^superscript^ content');
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
        it('should find basic superscript', () => {
            const text = 'Text with ^super^ content';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].from).toBe(10);
            expect(matches[0].to).toBe(17);
            expect(matches[0].data.content).toBe('super');
        });
        
        it('should find multiple superscripts', () => {
            const text = '^first^ and ^second^ superscripts';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(2);
            expect(matches[0].data.content).toBe('first');
            expect(matches[1].data.content).toBe('second');
        });
        
        it('should handle superscript with spaces', () => {
            const text = 'Text with ^multi word^ superscript';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].data.content).toBe('multi word');
        });
        
        it('should not match subscripts', () => {
            const text = 'Text with ~subscript~ not superscript';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(0);
        });
        
        it('should not match incomplete superscripts', () => {
            const text = 'Text with ^incomplete or unclosed^';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].data.content).toBe('incomplete or unclosed');
        });
        
        it('should not match nested markers', () => {
            const text = 'Text with ^nested^inside^ markers';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches).toHaveLength(1);
            expect(matches[0].data.content).toBe('nested');
            // The "inside^" is not matched because it would start within the first match
        });
        
        it('should store raw text in match data', () => {
            const text = 'Text with ^super^ content';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches[0].data.rawText).toBe('^super^');
        });
    });
    
    describe('createDecoration', () => {
        it('should create a replace decoration with SuperscriptWidget', () => {
            const match: InlineMatch = {
                from: 10,
                to: 17,
                type: 'superscript',
                data: {
                    content: 'super',
                    rawText: '^super^'
                }
            };
            
            const decoration = processor.createDecoration(match, context);
            
            expect(decoration).toBeDefined();
            expect(decoration.spec?.widget).toBeDefined();
            expect(decoration.spec?.widget?.constructor.name).toBe('SuperscriptWidget');
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
            expect(processor.priority).toBe(20);
        });
    });
    
    describe('name', () => {
        it('should have correct name', () => {
            expect(processor.name).toBe('superscript');
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