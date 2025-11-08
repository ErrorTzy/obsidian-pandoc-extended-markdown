import { detectCodeRegions, isRangeInCodeRegion } from '../../../src/live-preview/pipeline/utils/codeDetection';
import { Text } from '@codemirror/state';

const createDoc = (content: string) => Text.of(content.split('\n'));

describe('Code region detection (regex fallback)', () => {
    it('detects fenced code blocks', () => {
        const doc = createDoc('```\ncode\n```');
        const regions = detectCodeRegions(doc);
        expect(regions).toEqual([
            { from: 0, to: 12, type: 'codeblock' }
        ]);
    });

    it('detects inline code spans', () => {
        const doc = createDoc('Plain `code` inline');
        const regions = detectCodeRegions(doc);
        expect(regions).toEqual([
            { from: 6, to: 12, type: 'inline-code' }
        ]);
    });

    it('detects math expressions', () => {
        const doc = createDoc('Math $x^2$ and $$y^2$$');
        const regions = detectCodeRegions(doc);
        expect(regions).toEqual([
            { from: 5, to: 10, type: 'math' },
            { from: 15, to: 22, type: 'math' }
        ]);
    });

    it('marks overlapping ranges when any code region intersects', () => {
        const doc = createDoc('`code` and text');
        const regions = detectCodeRegions(doc);
        expect(isRangeInCodeRegion(1, 7, regions)).toBe(true);
        expect(isRangeInCodeRegion(7, 11, regions)).toBe(false);
    });
});
