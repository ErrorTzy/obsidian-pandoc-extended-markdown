import { JSDOM } from 'jsdom';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { HashListProcessor, FancyListProcessor, ExampleListProcessor, CustomLabelProcessor, DefinitionProcessor, StandardListProcessor } from '../../../src/live-preview/pipeline/structural';
import { ExampleReferenceProcessor, SuperscriptProcessor, SubscriptProcessor, CustomLabelReferenceProcessor } from '../../../src/live-preview/pipeline/inline';

// Mock CodeMirror
const createMockView = (text: string) => {
    const lines = text.split('\n');
    const doc = {
        toString: () => text,
        lines: lines.length,
        line: (n: number) => {
            const lineIndex = n - 1;
            const from = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
            const to = from + lines[lineIndex].length;
            return {
                from,
                to,
                text: lines[lineIndex],
                number: n
            };
        },
        lineAt: (pos: number) => {
            let currentPos = 0;
            for (let i = 0; i < lines.length; i++) {
                const lineLength = lines[i].length;
                if (currentPos <= pos && pos <= currentPos + lineLength) {
                    const from = currentPos;
                    const to = currentPos + lineLength;
                    return {
                        from,
                        to,
                        text: lines[i],
                        number: i + 1
                    };
                }
                currentPos += lineLength + 1; // +1 for newline
            }
            return doc.line(lines.length);
        },
        sliceString: (from: number, to: number) => text.slice(from, to),
        length: text.length
    };
    
    return {
        state: {
            doc,
            selection: { main: { head: 0 } }
        },
        visibleRanges: []
    };
};

describe('Nested Standard Lists', () => {
    let pipeline: ProcessingPipeline;
    let stateManager: PluginStateManager;
    let settings: PandocExtendedMarkdownSettings;

    beforeEach(() => {
        stateManager = new PluginStateManager();
        pipeline = new ProcessingPipeline(stateManager);
        
        // Register processors
        pipeline.registerStructuralProcessor(new HashListProcessor());
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new StandardListProcessor());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerStructuralProcessor(new CustomLabelProcessor());
        pipeline.registerStructuralProcessor(new DefinitionProcessor());
        
        pipeline.registerInlineProcessor(new ExampleReferenceProcessor());
        pipeline.registerInlineProcessor(new SuperscriptProcessor());
        pipeline.registerInlineProcessor(new SubscriptProcessor());
        pipeline.registerInlineProcessor(new CustomLabelReferenceProcessor());
        
        settings = {
            strictPandocMode: false,
            moreExtendedSyntax: false
        } as PandocExtendedMarkdownSettings;
    });

    test('should handle standard unordered lists nested with fancy lists', () => {
        const text = `A. First fancy list item
   * Nested standard list item
   * Another nested item
B. Second fancy list item`;

        const view = createMockView(text) as any;
        const decorationSet = pipeline.process(view, settings);
        
        // Check that line 2 and 3 (nested items) are processed
        const context = (pipeline as any).createContext(view, settings);
        (pipeline as any).processStructural(context);
        
        // The content regions should include all lines
        expect(context.contentRegions).toHaveLength(4);
        
        // Check what type of regions were created for standard list lines
        // Find regions for lines 2 and 3 which have the standard list markers
        const line2 = view.state.doc.line(2);
        const line3 = view.state.doc.line(3);
        
        const standardListRegions = context.contentRegions.filter((r: any) => {
            return (r.from >= line2.from && r.to <= line2.to) || 
                   (r.from >= line3.from && r.to <= line3.to);
        });
        
        // Standard list items should be marked as 'normal' since the processor is disabled
        expect(standardListRegions.length).toBe(2);
        expect(standardListRegions[0].type).toBe('normal');
        expect(standardListRegions[1].type).toBe('normal');
        
        // Check that only fancy list items get proper decorations
        const listContentRegions = context.contentRegions.filter((r: any) => r.type === 'list-content');
        expect(listContentRegions.length).toBe(2); // Only A. and B. should be list-content
    });

    test('should handle standard unordered lists with + marker', () => {
        const text = `A. First fancy list item
   + Plus marker item
   + Another plus item
B. Second fancy list item`;

        const view = createMockView(text) as any;
        const decorationSet = pipeline.process(view, settings);
        
        // Check that + markers are handled
        const context = (pipeline as any).createContext(view, settings);
        (pipeline as any).processStructural(context);
        
        expect(context.contentRegions).toHaveLength(4);
    });

    test('should handle deeply nested standard lists', () => {
        const text = `A. First level fancy
   * Second level standard
     + Third level standard
       - Fourth level standard
B. Back to first level`;

        const view = createMockView(text) as any;
        const decorationSet = pipeline.process(view, settings);
        
        const context = (pipeline as any).createContext(view, settings);
        (pipeline as any).processStructural(context);
        
        // All 5 lines should be processed
        expect(context.contentRegions).toHaveLength(5);
    });

    test('should preserve indentation for nested standard lists', () => {
        const text = `A. Parent item
    * Child with 4 spaces
        * Grandchild with 8 spaces`;

        const view = createMockView(text) as any;
        const decorationSet = pipeline.process(view, settings);
        
        const context = (pipeline as any).createContext(view, settings);
        (pipeline as any).processStructural(context);
        
        // Check indentation is preserved
        const line2 = view.state.doc.line(2);
        const line3 = view.state.doc.line(3);
        
        expect(line2.text).toMatch(/^    \*/);
        expect(line3.text).toMatch(/^        \*/);
    });
});