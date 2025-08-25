import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../src/live-preview/pipeline/ProcessingPipeline';
import { HashListProcessor } from '../../src/live-preview/pipeline/structural/HashListProcessor';
import { FancyListProcessor } from '../../src/live-preview/pipeline/structural/FancyListProcessor';
import { ExampleListProcessor } from '../../src/live-preview/pipeline/structural/ExampleListProcessor';
import { ExampleReferenceProcessor } from '../../src/live-preview/pipeline/inline/ExampleReferenceProcessor';
import { SuperscriptProcessor } from '../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { SubscriptProcessor } from '../../src/live-preview/pipeline/inline/SubscriptProcessor';
import { PandocExtendedMarkdownSettings } from '../../src/core/settings';
import { PluginStateManager } from '../../src/core/state/pluginStateManager';

describe('ProcessingPipeline', () => {
    let view: EditorView;
    let pipeline: ProcessingPipeline;
    let stateManager: PluginStateManager;
    let settings: PandocExtendedMarkdownSettings;
    let container: HTMLElement;
    
    const updateView = (doc: string) => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
    };
    
    const hasDecorations = (decorationSet: any): boolean => {
        if (!decorationSet) return false;
        
        // Check if it's a proper DecorationSet with content
        if (decorationSet.iter) {
            try {
                const iter = decorationSet.iter();
                return iter && iter.value !== null;
            } catch (e) {
                // If iter fails, check if it has size
                return decorationSet.size > 0;
            }
        }
        
        // Fallback: check if it has size property
        return decorationSet.size > 0;
    };
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        view = new EditorView({
            state: EditorState.create({ doc: '' }),
            parent: container
        });
        
        stateManager = new PluginStateManager();
        pipeline = new ProcessingPipeline(stateManager);
        
        settings = {
            strictPandocMode: false,
            autoRenumberLists: false,
            moreExtendedSyntax: false,
            panelOrder: [],
            useNewPipeline: true
        };
        
        // Register processors
        pipeline.registerStructuralProcessor(new HashListProcessor());
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerInlineProcessor(new ExampleReferenceProcessor());
        pipeline.registerInlineProcessor(new SuperscriptProcessor());
        pipeline.registerInlineProcessor(new SubscriptProcessor());
    });
    
    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
    });
    
    describe('Basic functionality', () => {
        it('should initialize with correct processor counts', () => {
            const counts = pipeline.getProcessorCounts();
            expect(counts.structural).toBe(3);
            expect(counts.inline).toBe(3);
        });
        
        it('should clear all processors', () => {
            pipeline.clear();
            const counts = pipeline.getProcessorCounts();
            expect(counts.structural).toBe(0);
            expect(counts.inline).toBe(0);
        });
    });
    
    describe('Hash list processing', () => {
        it('should process basic hash list', () => {
            const doc = '#. First item\n#. Second item';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            console.log('Decorations:', decorations);
            console.log('Decorations type:', typeof decorations);
            console.log('Has iter?', decorations?.iter);
            console.log('Has size?', decorations?.size);
            
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should process hash list with inline content', () => {
            const doc = '#. Item with ^super^ and ~sub~ text';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Fancy list processing', () => {
        it('should process uppercase letter lists', () => {
            const doc = 'A. First item\nB. Second item';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should process roman numeral lists', () => {
            const doc = 'i. First item\nii. Second item\niii. Third item';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Example list processing', () => {
        it('should process example lists with labels', () => {
            const doc = '(@example) This is an example\n(@another) Another example';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should handle duplicate example labels', () => {
            const doc = '(@same) First occurrence\n(@same) Duplicate label';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Cross-references', () => {
        it('should process example references in text', () => {
            const doc = '(@test) Test example\n\nReference to (@test) here';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should process references in list content', () => {
            const doc = '(@a) Example A\n#. Hash list with (@a) reference';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Inline formatting', () => {
        it('should process superscript', () => {
            const doc = 'Text with ^superscript^ formatting';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should process subscript', () => {
            const doc = 'Text with ~subscript~ formatting';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should process multiple inline formats', () => {
            const doc = 'Text with ^super^ and ~sub~ and (@ref) formats';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Complex scenarios', () => {
        it('should handle mixed list types with cross-references', () => {
            const doc = `(@example) Example list item
#. Hash list with (@example) reference
A. Fancy list with ^super^ text
i. Roman with ~sub~ text`;
            
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
        
        it('should handle empty lines between lists', () => {
            const doc = `#. First hash

#. Second hash after empty line

A. Fancy list item`;
            
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(true);
        });
    });
    
    describe('Edge cases', () => {
        it('should handle empty document', () => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(hasDecorations(decorations)).toBe(false);
        });
        
        it('should handle document with no lists', () => {
            const doc = 'Just regular text\nAnother line of text';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            // May have inline decorations even without lists
        });
        
        it('should handle malformed lists', () => {
            const doc = '#.NoSpace\nA.NoSpace\n(@nospace)Content';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            // Should not crash on malformed input
        });
    });
});