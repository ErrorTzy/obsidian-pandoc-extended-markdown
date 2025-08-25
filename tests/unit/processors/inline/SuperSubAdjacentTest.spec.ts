import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../../../src/live-preview/pipeline/ProcessingPipeline';
import { SuperscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { SubscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SubscriptProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PandocExtendedMarkdownSettings } from '../../../../src/core/settings';
import { PluginStateManager } from '../../../../src/core/state/pluginStateManager';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('Adjacent Superscript and Subscript Processing', () => {
    let pipeline: ProcessingPipeline;
    let stateManager: PluginStateManager;
    let settings: PandocExtendedMarkdownSettings;
    let supProcessor: SuperscriptProcessor;
    let subProcessor: SubscriptProcessor;
    let container: HTMLElement;
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        stateManager = new PluginStateManager();
        pipeline = new ProcessingPipeline(stateManager);
        
        // Create processors
        supProcessor = new SuperscriptProcessor();
        subProcessor = new SubscriptProcessor();
        
        // Register processors
        pipeline.registerInlineProcessor(supProcessor);
        pipeline.registerInlineProcessor(subProcessor);
        
        // Default settings
        settings = {
            fancyLists: true,
            hashLists: true,
            definitionLists: true,
            exampleLists: true,
            strictLineBreaks: false,
            strictPandocMode: false,
            moreExtendedSyntax: false,
            useNewPipeline: true
        } as PandocExtendedMarkdownSettings;
    });
    
    afterEach(() => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    function createView(content: string): EditorView {
        const state = EditorState.create({
            doc: content
        });
        return new EditorView({
            state,
            parent: container
        });
    }
    
    function createContext(view: EditorView): ProcessingContext {
        return {
            document: view.state.doc,
            view,
            settings,
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
    }
    
    function testProcessors(text: string): { superscripts: string[], subscripts: string[], debug?: any } {
        const view = createView(text);
        const context = createContext(view);
        const region: ContentRegion = {
            from: 0,
            to: text.length,
            type: 'normal'
        };
        
        const supMatches = supProcessor.findMatches(text, region, context);
        const subMatches = subProcessor.findMatches(text, region, context);
        
        return {
            superscripts: supMatches.map(m => m.data.content),
            subscripts: subMatches.map(m => m.data.content),
            debug: {
                supMatches: supMatches.map(m => ({ from: m.from, to: m.to, content: m.data.content })),
                subMatches: subMatches.map(m => ({ from: m.from, to: m.to, content: m.data.content }))
            }
        };
    }
    
    function getWidgetTexts(view: EditorView, pipeline: ProcessingPipeline, settings: PandocExtendedMarkdownSettings): string[] {
        const decorations = pipeline.process(view, settings);
        // console.log('decorations', decorations);
        const widgets: string[] = [];
        
        // DecorationSet uses iter method
        const iter = decorations.iter();
        // console.log('iter', iter);
        let count = 0;
        while (iter.value) {
            count++;
            // console.log('Decoration', count, ':', {
            //    value: iter.value,
            //    spec: (iter.value as any).decoration?.spec,
            //    widget: (iter.value as any).decoration?.spec?.widget
            //});
            const widget = (iter.value as any).decoration?.spec?.widget;
            // console.log('widget', widget);
            if (widget) {
                // Access the private content field
                const content = (widget as any).content;
                // console.log('Widget content:', content);
                if (content) {
                    widgets.push(content);
                }
            }
            iter.next();
        }
        
        // console.log('Total decorations:', count, 'Widgets extracted:', widgets.length);
        return widgets;
    }
    
    test('processors should find adjacent subscript and superscript', () => {
        const result = testProcessors('P~a~^b^');
        
        // console.log('Debug info for P~a~^b^:', JSON.stringify(result.debug, null, 2));
        
        expect(result.subscripts).toEqual(['a']);
        expect(result.superscripts).toEqual(['b']);
    });
    
    test('processors should find adjacent superscript and subscript', () => {
        const result = testProcessors('P^b^~a~');
        
        expect(result.superscripts).toEqual(['b']);
        expect(result.subscripts).toEqual(['a']);
    });
    
    test('pipeline should process subscript followed by superscript', () => {
        const view = createView('P~a~^b^');
        const widgets = getWidgetTexts(view, pipeline, settings);
        
        expect(widgets).toContain('a'); // subscript
        expect(widgets).toContain('b'); // superscript
        expect(widgets.length).toBe(2);
    });
    
    test('pipeline should process superscript followed by subscript', () => {
        const view = createView('P^b^~a~');
        const widgets = getWidgetTexts(view, pipeline, settings);
        
        expect(widgets).toContain('b'); // superscript
        expect(widgets).toContain('a'); // subscript
        expect(widgets.length).toBe(2);
    });
    
    test('should process multiple adjacent pairs', () => {
        const view = createView('Test~sub1~^sup1^~sub2~^sup2^');
        const widgets = getWidgetTexts(view, pipeline, settings);
        
        expect(widgets).toContain('sub1');
        expect(widgets).toContain('sup1');
        expect(widgets).toContain('sub2');
        expect(widgets).toContain('sup2');
        expect(widgets.length).toBe(4);
    });
    
    test('should process with spaces between', () => {
        const view = createView('P~a~ ^b^');
        const widgets = getWidgetTexts(view, pipeline, settings);
        
        expect(widgets).toContain('a'); // subscript
        expect(widgets).toContain('b'); // superscript
        expect(widgets.length).toBe(2);
    });
    
    test('should process overlapping correctly', () => {
        // Even when they share the same character position (end of one is start of next)
        const view = createView('X~subscript~^superscript^Y');
        const widgets = getWidgetTexts(view, pipeline, settings);
        
        expect(widgets).toContain('subscript');
        expect(widgets).toContain('superscript');
        expect(widgets.length).toBe(2);
    });
});