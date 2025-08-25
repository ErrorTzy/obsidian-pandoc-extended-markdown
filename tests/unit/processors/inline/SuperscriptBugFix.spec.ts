import { SuperscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { SubscriptProcessor } from '../../../../src/live-preview/pipeline/inline/SubscriptProcessor';
import { ProcessingContext, ContentRegion } from '../../../../src/live-preview/pipeline/types';
import { PlaceholderContext } from '../../../../src/shared/utils/placeholderProcessor';

describe('Superscript and Subscript Bug Fix', () => {
    let supProcessor: SuperscriptProcessor;
    let subProcessor: SubscriptProcessor;
    
    beforeEach(() => {
        supProcessor = new SuperscriptProcessor();
        subProcessor = new SubscriptProcessor();
    });
    
    function createMockContext(): ProcessingContext {
        return {
            document: null as any,
            view: null as any,
            settings: {} as any,
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
    
    describe('Bug: P~a~^b^ should render both subscript and superscript', () => {
        test('should find superscript after subscript in P~a~^b^', () => {
            const text = 'P~a~^b^';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            const context = createMockContext();
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            // Subscript should find ~a~ at position 1-4
            expect(subMatches).toHaveLength(1);
            expect(subMatches[0].from).toBe(1);
            expect(subMatches[0].to).toBe(4);
            expect(subMatches[0].data.content).toBe('a');
            
            // Superscript should find ^b^ at position 4-7
            expect(supMatches).toHaveLength(1);
            expect(supMatches[0].from).toBe(4);
            expect(supMatches[0].to).toBe(7);
            expect(supMatches[0].data.content).toBe('b');
        });
        
        test('should find subscript after superscript in P^b^~a~', () => {
            const text = 'P^b^~a~';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            const context = createMockContext();
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            // Superscript should find ^b^ at position 1-4
            expect(supMatches).toHaveLength(1);
            expect(supMatches[0].from).toBe(1);
            expect(supMatches[0].to).toBe(4);
            expect(supMatches[0].data.content).toBe('b');
            
            // Subscript should find ~a~ at position 4-7
            expect(subMatches).toHaveLength(1);
            expect(subMatches[0].from).toBe(4);
            expect(subMatches[0].to).toBe(7);
            expect(subMatches[0].data.content).toBe('a');
        });
        
        test('should handle multiple adjacent pairs', () => {
            const text = 'Test~sub1~^sup1^~sub2~^sup2^';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            const context = createMockContext();
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            // Should find 2 subscripts
            expect(subMatches).toHaveLength(2);
            expect(subMatches[0].data.content).toBe('sub1');
            expect(subMatches[1].data.content).toBe('sub2');
            
            // Should find 2 superscripts
            expect(supMatches).toHaveLength(2);
            expect(supMatches[0].data.content).toBe('sup1');
            expect(supMatches[1].data.content).toBe('sup2');
        });
        
        test('should handle space-separated pairs', () => {
            const text = 'P~a~ ^b^';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            const context = createMockContext();
            
            const supMatches = supProcessor.findMatches(text, region, context);
            const subMatches = subProcessor.findMatches(text, region, context);
            
            expect(subMatches).toHaveLength(1);
            expect(subMatches[0].data.content).toBe('a');
            
            expect(supMatches).toHaveLength(1);
            expect(supMatches[0].data.content).toBe('b');
        });
    });
});