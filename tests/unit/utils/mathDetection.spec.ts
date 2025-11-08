import { detectCodeRegions } from '../../../src/live-preview/pipeline/utils/codeDetection';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

type SyntaxTreeIterator = (state: EditorState, config: { enter?: (node: SyntaxNodeMock) => boolean | void }) => void;

interface SyntaxNodeMock {
    from: number;
    to: number;
    type: { name: string };
}

type SyntaxTreeMock = typeof syntaxTree & {
    __setMockIterator?: (fn: SyntaxTreeIterator) => void;
};

const syntaxTreeMock = syntaxTree as SyntaxTreeMock;

const createState = (content: string) => EditorState.create({ doc: content });

function mockTreeNodes(nodes: SyntaxNodeMock[]): void {
    syntaxTreeMock.__setMockIterator?.((_state, config) => {
        nodes.forEach(node => {
            const shouldDescend = config.enter?.(node);
            if (shouldDescend === false) {
                return;
            }
        });
    });
}

describe('Code region detection', () => {
    beforeEach(() => {
        mockTreeNodes([]);
    });
    
    describe('syntax tree sources', () => {
        it('detects fenced code blocks', () => {
            mockTreeNodes([{ from: 0, to: 10, type: { name: 'FencedCode' } }]);
            const regions = detectCodeRegions(createState('```code```'));
            expect(regions).toEqual([{ from: 0, to: 10, type: 'codeblock' }]);
        });
        
        it('detects inline code segments', () => {
            mockTreeNodes([{ from: 5, to: 11, type: { name: 'InlineCode' } }]);
            const regions = detectCodeRegions(createState('text `code` text'));
            expect(regions).toEqual([{ from: 5, to: 11, type: 'inline-code' }]);
        });
        
        it('detects math nodes when exposed by the parser', () => {
            mockTreeNodes([{ from: 6, to: 18, type: { name: 'InlineMath' } }]);
            const regions = detectCodeRegions(createState('Given $x^2$ in math'));
            expect(regions).toEqual([{ from: 6, to: 18, type: 'math' }]);
        });

        it('supports multiple math regions in a single document', () => {
            const text = 'Given $R^{+}_{xy}$ and $R^{+}_{yz}$, we have $R^{+}_{xz}$';
            const matchIndexes = [...text.matchAll(/\$R\^\+_\{[a-z]{2}\}\$/g)];
            const nodes: SyntaxNodeMock[] = matchIndexes.map(match => ({
                from: match.index ?? 0,
                to: (match.index ?? 0) + match[0].length,
                type: { name: 'InlineMath' }
            }));
            mockTreeNodes(nodes);
            const regions = detectCodeRegions(createState(text));
            expect(regions).toEqual(nodes.map(node => ({ from: node.from, to: node.to, type: 'math' })));
        });

        it('sorts regions deterministically when nodes overlap', () => {
            mockTreeNodes([
                { from: 0, to: 10, type: { name: 'InlineCode' } },
                { from: 0, to: 5, type: { name: 'InlineMath' } },
                { from: 10, to: 20, type: { name: 'FencedCode' } }
            ]);
            const regions = detectCodeRegions(createState('dummy'));
            expect(regions).toEqual([
                { from: 0, to: 5, type: 'math' },
                { from: 0, to: 10, type: 'inline-code' },
                { from: 10, to: 20, type: 'codeblock' }
            ]);
        });
    });
});
