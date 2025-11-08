import { isRangeInCodeRegion } from '../../../src/live-preview/pipeline/utils/codeDetection';
import { CodeRegion } from '../../../src/shared/types/codeTypes';

describe('Code region overlap detection', () => {
    const regions: CodeRegion[] = [
        { from: 0, to: 5, type: 'inline-code' },
        { from: 10, to: 20, type: 'codeblock' }
    ];

    it('detects ranges fully inside a region', () => {
        expect(isRangeInCodeRegion(1, 4, regions)).toBe(true);
    });

    it('detects ranges that partially overlap a region', () => {
        expect(isRangeInCodeRegion(2, 8, regions)).toBe(true);
        expect(isRangeInCodeRegion(8, 12, regions)).toBe(true);
        expect(isRangeInCodeRegion(1, 4, regions)).toBe(true);
    });

    it('ignores ranges entirely outside code regions', () => {
        expect(isRangeInCodeRegion(5, 9, regions)).toBe(false);
        expect(isRangeInCodeRegion(21, 25, regions)).toBe(false);
    });
});
