import {
    FencedDivTypeCounters,
    createFencedDivReferenceMetadata
} from '../../../src/shared/utils/fencedDivReferenceMetadata';

describe('createFencedDivReferenceMetadata', () => {
    const metadata = (
        title: string | undefined,
        classes: string[],
        counters: FencedDivTypeCounters = new Map()
    ) => createFencedDivReferenceMetadata(title, classes, counters);

    it('renders titles without placeholders without numbering', () => {
        const result = metadata('Warning', ['warning']);

        expect(result).toMatchObject({
            title: 'Warning',
            typeLabel: 'Warning',
            number: 0,
            numberParts: [],
            numberingEnabled: false,
            referenceText: 'Warning',
            blockTitleText: 'Warning'
        });
    });

    it('replaces placeholders at the front and back of titles', () => {
        const counters: FencedDivTypeCounters = new Map();

        expect(metadata('Theorem &', ['theorem'], counters).referenceText).toBe('Theorem 1');
        expect(metadata('& Theorem', ['theorem'], counters).referenceText).toBe('2 Theorem');
    });

    it('advances and resets hierarchical placeholder counters by title stem', () => {
        const counters: FencedDivTypeCounters = new Map();

        expect(metadata('Case &', ['case'], counters).referenceText).toBe('Case 1');
        expect(metadata('Case &.&', ['case'], counters).referenceText).toBe('Case 1.1');
        expect(metadata('Case &.&', ['case'], counters).referenceText).toBe('Case 1.2');
        expect(metadata('Case &', ['case'], counters).referenceText).toBe('Case 2');
        const deepCase = metadata('Case &.&.&', ['case'], counters);

        expect(deepCase.typeLabel).toBe('Case');
        expect(deepCase.referenceText).toBe('Case 2.1.1');
    });

    it('uses only the first unescaped placeholder group', () => {
        const counters: FencedDivTypeCounters = new Map();

        expect(metadata('AT\\&T-&.&', ['case'], counters).referenceText).toBe('AT&T-1.1');
        expect(metadata('&-&', ['case'], counters).referenceText).toBe('1-&');
    });

    it('synthesizes title templates from readable shorthand classes', () => {
        expect(metadata('Case &.&', ['Case', '&.&']).referenceText).toBe('Case 1.1');
        expect(metadata('& Note', ['&', 'Note']).referenceText).toBe('1 Note');
        expect(metadata('Case &.&', ['Case_&.&']).referenceText).toBe('Case 1.1');
    });

    it('keeps ampersands literal when no-num is present', () => {
        const result = metadata('AT&T Warning', ['warning', 'no-num']);

        expect(result).toMatchObject({
            number: 0,
            numberingEnabled: false,
            referenceText: 'AT&T Warning',
            blockTitleText: 'AT&T Warning'
        });
    });

    it('keeps placeholder text literal when no-num is present', () => {
        const result = metadata('Case &.&', ['Case', '&.&', 'no-num']);

        expect(result).toMatchObject({
            numberingEnabled: false,
            referenceText: 'Case &.&',
            blockTitleText: 'Case &.&'
        });
    });

    it('does not invent numbering or a block title for id-only divs', () => {
        const result = metadata('', []);

        expect(result).toMatchObject({
            typeLabel: 'Div',
            number: 0,
            referenceText: 'Div',
            blockTitleText: ''
        });
    });
});
