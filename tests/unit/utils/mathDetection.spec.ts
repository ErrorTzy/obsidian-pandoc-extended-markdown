import { EditorState } from '@codemirror/state';
import type { Text } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { detectCodeRegions, isRangeInCodeRegion } from '../../../src/live-preview/pipeline/utils/codeDetection';

type MockNode = { name: string; from: number; to: number };
let mockNodes: MockNode[] = [];

const setMockSyntaxTreeNodes = (nodes: MockNode[]) => {
    mockNodes = nodes;
    syntaxTree.__setMockIterator?.((_state, config) => {
        mockNodes.forEach(node => config.enter?.({
            type: { name: node.name },
            from: node.from,
            to: node.to
        }));
    });
};

describe('Code region detection (syntax tree)', () => {
    it('detects fenced code blocks and inline code', () => {
        const content = [
            'Plain `code` inline',
            '',
            '```',
            'block',
            '```'
        ].join('\n');
        const state = new EditorState(content);
        const doc = state.doc as unknown as Text;
        const inlineFrom = content.indexOf('`');
        const inlineTo = content.indexOf('`', inlineFrom + 1) + 1;
        const blockStart = content.indexOf('```');
        const blockEndFence = content.indexOf('```', blockStart + 3);
        const blockEnd = blockEndFence + 3;
        
        setMockSyntaxTreeNodes([
            { name: 'inline-code', from: inlineFrom, to: inlineTo },
            { name: 'HyperMD-codeblock-begin', from: blockStart, to: blockStart + 3 },
            { name: 'HyperMD-codeblock-end', from: blockEndFence, to: blockEnd }
        ]);
        
        const regions = detectCodeRegions(doc, state);
        const inlineRegion = regions.find(region => region.type === 'inline-code');
        const codeBlockRegion = regions.find(region => region.type === 'codeblock');
        
        expect(inlineRegion).toBeDefined();
        expect(codeBlockRegion).toBeDefined();
        expect(inlineRegion?.from).toBe(inlineFrom);
        expect(inlineRegion?.to).toBe(inlineTo);
        expect(codeBlockRegion!.from).toBeLessThanOrEqual(blockStart);
        expect(codeBlockRegion!.to).toBeGreaterThanOrEqual(blockEnd);
    });

    it('detects math regions when math nodes exist', () => {
        const content = 'Math $x^2$ inline.';
        const state = new EditorState(content);
        const doc = state.doc as unknown as Text;
        const mathFrom = content.indexOf('$');
        const mathTo = content.lastIndexOf('$') + 1;
        
        setMockSyntaxTreeNodes([
            { name: 'math', from: mathFrom, to: mathTo }
        ]);
        
        const regions = detectCodeRegions(doc, state);
        const mathRegion = regions.find(region => region.type === 'math');
        
        expect(mathRegion).toBeDefined();
        expect(mathRegion?.from).toBe(mathFrom);
        expect(mathRegion?.to).toBe(mathTo);
    });

    it('marks ranges that overlap detected code regions', () => {
        const content = 'Plain `code` inline\n\n```\nblock\n```';
        const state = new EditorState(content);
        const doc = state.doc as unknown as Text;
        const inlineFrom = content.indexOf('`');
        const inlineTo = content.indexOf('`', inlineFrom + 1) + 1;
        const blockStart = content.indexOf('```');
        const blockEndFence = content.indexOf('```', blockStart + 3);
        const blockEnd = blockEndFence + 3;
        
        setMockSyntaxTreeNodes([
            { name: 'inline-code', from: inlineFrom, to: inlineTo },
            { name: 'HyperMD-codeblock-begin', from: blockStart, to: blockStart + 3 },
            { name: 'HyperMD-codeblock-end', from: blockEndFence, to: blockEnd }
        ]);
        
        const regions = detectCodeRegions(doc, state);
        const inlineIndex = content.indexOf('code');
        const blockIndex = content.indexOf('block');
        const plainIndex = content.indexOf('Plain');
        
        expect(isRangeInCodeRegion(inlineIndex, inlineIndex + 4, regions)).toBe(true);
        expect(isRangeInCodeRegion(blockIndex, blockIndex + 5, regions)).toBe(true);
        expect(isRangeInCodeRegion(plainIndex, plainIndex + 5, regions)).toBe(false);
    });
});
