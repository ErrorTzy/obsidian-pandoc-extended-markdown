import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ProcessingPipeline } from '../../src/live-preview/pipeline/ProcessingPipeline';
import { FancyListProcessor } from '../../src/live-preview/pipeline/structural/FancyListProcessor';
import { HashListProcessor } from '../../src/live-preview/pipeline/structural/HashListProcessor';
import { CustomLabelProcessor } from '../../src/live-preview/pipeline/structural/CustomLabelProcessor';
import { DefinitionProcessor } from '../../src/live-preview/pipeline/structural/DefinitionProcessor';
import { ExampleListProcessor } from '../../src/live-preview/pipeline/structural/ExampleListProcessor';

describe('Widget Editability', () => {
    let pipeline: ProcessingPipeline;
    let view: EditorView;
    
    beforeEach(() => {
        // Create a mock view
        const state = EditorState.create({
            doc: ''
        });
        
        view = new EditorView({
            state,
            parent: document.createElement('div')
        });
        
        pipeline = new ProcessingPipeline();
        
        // Register structural processors
        pipeline.registerStructuralProcessor(new HashListProcessor());
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerStructuralProcessor(new CustomLabelProcessor());
        pipeline.registerStructuralProcessor(new DefinitionProcessor());
    });
    
    afterEach(() => {
        view.destroy();
    });
    
    it('should not set contenteditable="false" on widget elements', () => {
        const testCases = [
            'A. First item',
            '#. Hash list item',
            '(@example) Example list',
            '{::LABEL} Custom label list',
            ': Definition item'
        ];
        
        testCases.forEach(text => {
            // Update view with test content
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: text }
            });
            
            // Process the content
            const decorations = pipeline.process(view, {
                moreExtendedSyntax: true,
                strictPandocMode: false
            });
            
            // Check that decorations don't explicitly set contentEditable
            decorations.iter({
                from: 0,
                to: view.state.doc.length
            }, (from: number, to: number, decoration: any) => {
                if (decoration.spec?.widget) {
                    const widget = decoration.spec.widget;
                    const domEl = widget.toDOM(view);
                    
                    // Check that contentEditable is not explicitly set to 'false'
                    expect(domEl.contentEditable).not.toBe('false');
                    
                    // Check that ignoreEvent returns false
                    if (widget.ignoreEvent) {
                        expect(widget.ignoreEvent()).toBe(false);
                    }
                }
            });
        });
    });
    
    it('should use inclusive: false for all Decoration.replace calls', () => {
        const testCases = [
            'A. First item',
            '#. Hash list item',
            '(@example) Example list',
            '{::LABEL} Custom label list',
            ': Definition item'
        ];
        
        testCases.forEach(text => {
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: text }
            });
            
            const decorations = pipeline.process(view, {
                moreExtendedSyntax: true,
                strictPandocMode: false
            });
            
            decorations.iter({
                from: 0,
                to: view.state.doc.length
            }, (from: number, to: number, decoration: any) => {
                if (decoration.spec?.widget) {
                    // Check that inclusive is set to false for replace decorations
                    expect(decoration.spec.inclusive).toBe(false);
                }
            });
        });
    });
});