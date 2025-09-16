import { buildReferenceContext, hasReferenceData } from '../../../src/shared/utils/contextUtils';
import { ProcessingContext } from '../../../src/live-preview/pipeline/types';

describe('Context Utilities', () => {
    describe('buildReferenceContext', () => {
        it('should extract reference context from processing context', () => {
            const exampleLabels = new Map([['label1', 1], ['label2', 2]]);
            const exampleContent = new Map([['label1', 'content1'], ['label2', 'content2']]);
            const customLabels = new Map([['custom1', 'value1'], ['custom2', 'value2']]);
            const rawToProcessed = new Map([['raw1', 'processed1'], ['raw2', 'processed2']]);

            const context: ProcessingContext = {
                exampleLabels,
                exampleContent,
                customLabels,
                rawToProcessed
            } as ProcessingContext;

            const referenceContext = buildReferenceContext(context);

            expect(referenceContext.exampleLabels).toBe(exampleLabels);
            expect(referenceContext.exampleContent).toBe(exampleContent);
            expect(referenceContext.customLabels).toBe(customLabels);
            expect(referenceContext.rawToProcessed).toBe(rawToProcessed);
        });

        it('should handle undefined properties in context', () => {
            const context: ProcessingContext = {} as ProcessingContext;

            const referenceContext = buildReferenceContext(context);

            expect(referenceContext.exampleLabels).toBeUndefined();
            expect(referenceContext.exampleContent).toBeUndefined();
            expect(referenceContext.customLabels).toBeUndefined();
            expect(referenceContext.rawToProcessed).toBeUndefined();
        });

        it('should handle partially defined context', () => {
            const exampleLabels = new Map([['label1', 1]]);

            const context: ProcessingContext = {
                exampleLabels
            } as ProcessingContext;

            const referenceContext = buildReferenceContext(context);

            expect(referenceContext.exampleLabels).toBe(exampleLabels);
            expect(referenceContext.exampleContent).toBeUndefined();
            expect(referenceContext.customLabels).toBeUndefined();
            expect(referenceContext.rawToProcessed).toBeUndefined();
        });
    });

    describe('hasReferenceData', () => {
        it('should return true when any map has data', () => {
            const referenceContext = {
                exampleLabels: new Map([['label1', 1]]),
                exampleContent: new Map(),
                customLabels: undefined,
                rawToProcessed: undefined
            };

            expect(hasReferenceData(referenceContext)).toBe(true);
        });

        it('should return false when all maps are empty or undefined', () => {
            const referenceContext = {
                exampleLabels: new Map(),
                exampleContent: new Map(),
                customLabels: new Map(),
                rawToProcessed: undefined
            };

            expect(hasReferenceData(referenceContext)).toBe(false);
        });

        it('should return false when all properties are undefined', () => {
            const referenceContext = {
                exampleLabels: undefined,
                exampleContent: undefined,
                customLabels: undefined,
                rawToProcessed: undefined
            };

            expect(hasReferenceData(referenceContext)).toBe(false);
        });

        it('should return true when customLabels has data', () => {
            const referenceContext = {
                exampleLabels: undefined,
                exampleContent: undefined,
                customLabels: new Map([['custom1', 'value1']]),
                rawToProcessed: undefined
            };

            expect(hasReferenceData(referenceContext)).toBe(true);
        });

        it('should return true when rawToProcessed has data', () => {
            const referenceContext = {
                exampleLabels: undefined,
                exampleContent: undefined,
                customLabels: undefined,
                rawToProcessed: new Map([['raw', 'processed']])
            };

            expect(hasReferenceData(referenceContext)).toBe(true);
        });
    });
});