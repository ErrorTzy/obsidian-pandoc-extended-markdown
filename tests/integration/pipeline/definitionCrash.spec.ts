import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { DefinitionProcessor } from '../../../src/live-preview/pipeline/structural/DefinitionProcessor';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Definition List Crash Bug', () => {
    let pipeline: ProcessingPipeline;
    let view: EditorView;
    let container: HTMLElement;
    let stateManager: PluginStateManager;
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        stateManager = new PluginStateManager();
        pipeline = new ProcessingPipeline(stateManager);
        pipeline.registerStructuralProcessor(new DefinitionProcessor());
    });
    
    afterEach(() => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    const createView = (doc: string): EditorView => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
        
        return view;
    };
    
    it('should not crash when processing simple definition list', () => {
        const doc = 'Term\n: Definition';
        const view = createView(doc);
        const settings: PandocExtendedMarkdownSettings = {
            strictPandocMode: false,
            strictLineBreaks: false,
            moreExtendedSyntax: false,
            panelOrder: []
        } as PandocExtendedMarkdownSettings;
        
        expect(() => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
        }).not.toThrow();
    });
    
    it('should not crash when processing definition list with multiple items', () => {
        const doc = 'Term\n: First definition\n: Second definition\n~ Third definition';
        const view = createView(doc);
        const settings: PandocExtendedMarkdownSettings = {
            strictPandocMode: false,
            strictLineBreaks: false,
            moreExtendedSyntax: false,
            panelOrder: []
        } as PandocExtendedMarkdownSettings;
        
        expect(() => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
        }).not.toThrow();
    });
    
    it('should handle definition list with indented content', () => {
        const doc = 'Term\n: Definition\n    Indented paragraph\n    More content';
        const view = createView(doc);
        const settings: PandocExtendedMarkdownSettings = {
            strictPandocMode: false,
            strictLineBreaks: false,
            moreExtendedSyntax: false,
            panelOrder: []
        } as PandocExtendedMarkdownSettings;
        
        expect(() => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
        }).not.toThrow();
    });
    
    it('should handle empty document', () => {
        const doc = '';
        const view = createView(doc);
        const settings: PandocExtendedMarkdownSettings = {
            strictPandocMode: false,
            strictLineBreaks: false,
            moreExtendedSyntax: false,
            panelOrder: []
        } as PandocExtendedMarkdownSettings;
        
        expect(() => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
        }).not.toThrow();
    });
    
    it('should handle single line definition', () => {
        const doc = ': Definition without term';
        const view = createView(doc);
        const settings: PandocExtendedMarkdownSettings = {
            strictPandocMode: false,
            strictLineBreaks: false,
            moreExtendedSyntax: false,
            panelOrder: []
        } as PandocExtendedMarkdownSettings;
        
        expect(() => {
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
        }).not.toThrow();
    });
});