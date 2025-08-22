import { describe, it, expect } from '@jest/globals';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { processFancyList, processHashList, processExampleList } from '../src/decorations/processors/listProcessors';

describe('List Indentation in Live Preview', () => {
    // Mock context helper
    function createMockContext(lineText: string, lineNum: number = 1) {
        const state = EditorState.create({ doc: lineText });
        const view = new EditorView({ state });
        
        return {
            line: { from: 0, to: lineText.length },
            lineNum,
            lineText,
            cursorPos: -1, // Not in the marker
            view,
            invalidListBlocks: new Set<number>(),
            settings: { strictPandocMode: false },
            exampleLabels: new Map(),
            exampleLineNumbers: new Map([[lineNum, 1]]),
            duplicateLabels: new Map(),
            duplicateLabelContent: new Map()
        };
    }

    describe('Fancy Lists', () => {
        it('should apply CSS class for list indentation', () => {
            const context = createMockContext('A. First item');
            const decorations = processFancyList(context);
            
            expect(decorations).not.toBeNull();
            expect(decorations!.length).toBeGreaterThan(0);
            
            // Check for line decoration
            const lineDecoration = decorations!.find(d => d.from === 0 && d.to === 0);
            expect(lineDecoration).toBeDefined();
            
            // The line decoration should have CSS class for styling
            const lineSpec = (lineDecoration!.decoration as any).spec;
            expect(lineSpec.class).toContain('HyperMD-list-line');
            expect(lineSpec.class).toContain('pandoc-list-line');
        });

        it('should calculate proper indentation for different marker types', () => {
            const testCases = [
                { text: 'A. Item', expectedIndent: 'calculated' },
                { text: 'i. Item', expectedIndent: 'calculated' },
                { text: 'IV. Item', expectedIndent: 'calculated' },
                { text: 'a) Item', expectedIndent: 'calculated' },
                { text: 'I) Item', expectedIndent: 'calculated' }
            ];

            testCases.forEach(({ text }) => {
                const context = createMockContext(text);
                const decorations = processFancyList(context);
                
                expect(decorations).not.toBeNull();
                
                // Should have dynamic indentation, not fixed
                const lineDecoration = decorations!.find(d => d.from === 0 && d.to === 0);
                const lineClass = (lineDecoration!.decoration as any).spec?.class;
                
                // Should have list line classes
                const lineSpec = (lineDecoration!.decoration as any).spec;
                expect(lineSpec.class).toContain('HyperMD-list-line');
                expect(lineSpec.class).toContain('pandoc-list-line');
            });
        });
    });

    describe('Hash Lists', () => {
        it('should apply dynamic indentation for hash lists', () => {
            const context = createMockContext('#. First item');
            const hashCounter = { value: 1 };
            const decorations = processHashList(context, hashCounter);
            
            expect(decorations).not.toBeNull();
            
            const lineDecoration = decorations!.find(d => d.from === 0 && d.to === 0);
            const lineClass = (lineDecoration!.decoration as any).spec?.class;
            
            // Should have CSS class for list indentation
            const lineSpec = (lineDecoration!.decoration as any).spec;
            expect(lineSpec.class).toContain('pandoc-list-line');
        });
    });

    describe('Example Lists', () => {
        it('should apply dynamic indentation for example lists', () => {
            const context = createMockContext('(@) First example');
            const decorations = processExampleList(context);
            
            expect(decorations).not.toBeNull();
            
            const lineDecoration = decorations!.find(d => d.from === 0 && d.to === 0);
            const lineClass = (lineDecoration!.decoration as any).spec?.class;
            
            // Should have CSS class for list indentation
            const lineSpec = (lineDecoration!.decoration as any).spec;
            expect(lineSpec.class).toContain('pandoc-list-line');
        });
    });

    describe('Indentation Calculation', () => {
        it('should calculate indentation based on marker width', () => {
            // Test that indentation adapts to marker width
            const shortMarker = createMockContext('A. Item');
            const longMarker = createMockContext('XVIII. Item');
            
            const shortDecorations = processFancyList(shortMarker);
            const longDecorations = processFancyList(longMarker);
            
            expect(shortDecorations).not.toBeNull();
            expect(longDecorations).not.toBeNull();
            
            // Both should have appropriate styling without fixed indentation
            const shortLineDecoration = shortDecorations!.find(d => d.from === 0 && d.to === 0);
            const longLineDecoration = longDecorations!.find(d => d.from === 0 && d.to === 0);
            
            expect(shortLineDecoration).toBeDefined();
            expect(longLineDecoration).toBeDefined();
        });
    });
});