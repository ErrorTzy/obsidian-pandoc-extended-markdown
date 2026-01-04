import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
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
        setSyntaxTreeNodesForContent(content);
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

    function setSyntaxTreeNodesForContent(content: string): void {
        const nodes: Array<{ name: string; from: number; to: number }> = [];
        const codeBlocks = collectCodeBlockRanges(content);
        
        for (const block of codeBlocks) {
            nodes.push({
                name: 'HyperMD-codeblock-begin',
                from: block.from,
                to: Math.min(block.from + 3, block.to)
            });
            if (block.hasEnd) {
                nodes.push({
                    name: 'HyperMD-codeblock-end',
                    from: Math.max(block.to - 3, block.from),
                    to: block.to
                });
            }
        }
        
        const inlineNodes = collectInlineCodeNodes(content, codeBlocks);
        nodes.push(...inlineNodes);
        
        syntaxTree.__setMockIterator?.((_state, config) => {
            nodes.forEach(node => config.enter?.({
                type: { name: node.name },
                from: node.from,
                to: node.to
            }));
        });
    }

    function collectCodeBlockRanges(content: string): Array<{ from: number; to: number; hasEnd: boolean }> {
        const ranges: Array<{ from: number; to: number; hasEnd: boolean }> = [];
        const fenceRegex = /```|~~~/g;
        const fencePositions: number[] = [];
        let match;
        
        while ((match = fenceRegex.exec(content)) !== null) {
            fencePositions.push(match.index);
        }
        
        for (let i = 0; i < fencePositions.length; i += 2) {
            const start = fencePositions[i];
            const endFence = fencePositions[i + 1];
            if (endFence !== undefined) {
                ranges.push({
                    from: start,
                    to: endFence + 3,
                    hasEnd: true
                });
            } else {
                ranges.push({
                    from: start,
                    to: content.length,
                    hasEnd: false
                });
            }
        }
        
        return ranges;
    }

    function collectInlineCodeNodes(
        content: string,
        codeBlocks: Array<{ from: number; to: number }>
    ): Array<{ name: string; from: number; to: number }> {
        const nodes: Array<{ name: string; from: number; to: number }> = [];
        let i = 0;
        
        while (i < content.length) {
            if (isInCodeBlock(i, codeBlocks)) {
                i++;
                continue;
            }
            
            if (content[i] === '`' && (i === 0 || content[i - 1] !== '\\')) {
                let j = i + 1;
                while (j < content.length) {
                    if (content[j] === '`' && content[j - 1] !== '\\') {
                        nodes.push({
                            name: 'inline-code',
                            from: i,
                            to: j + 1
                        });
                        i = j + 1;
                        break;
                    }
                    j++;
                }
                
                if (j >= content.length) {
                    i++;
                }
            } else {
                i++;
            }
        }
        
        return nodes;
    }

    function isInCodeBlock(pos: number, codeBlocks: Array<{ from: number; to: number }>): boolean {
        return codeBlocks.some(block => pos >= block.from && pos < block.to);
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

    test('should process superscript after inline code spans', () => {
        const view = createView('`X^2` is x^2^');
        const widgets = getWidgetTexts(view, pipeline, settings);

        const superOccurences = widgets.filter(content => content === '2');
        expect(superOccurences.length).toBe(1);
    });

    test('processor still detects superscript outside inline code', () => {
        const result = testProcessors('`X^2` is x^2^');
        expect(result.superscripts).toContain('2');
    });

    test('should process superscript after fenced code blocks and inline code', () => {
        const content = [
            '```',
            'H~2~O',
            '```',
            '',
            '`X^2` is x^2^'
        ].join('\n');
        const view = createView(content);
        const widgets = getWidgetTexts(view, pipeline, settings);

        expect(widgets).toContain('2');
        expect(widgets.filter(text => text === '2').length).toBe(1);
    });
});
