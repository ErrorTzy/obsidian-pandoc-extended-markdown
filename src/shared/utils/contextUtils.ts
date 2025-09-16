import { ProcessingContext } from '../../live-preview/pipeline/types';

/**
 * Build a reference context object from the processing context
 * This is commonly used by inline processors that need reference information
 * @param context The processing context containing reference maps
 * @returns An object containing all reference context data
 */
export function buildReferenceContext(context: ProcessingContext) {
    return {
        exampleLabels: context.exampleLabels,
        exampleContent: context.exampleContent,
        customLabels: context.customLabels,
        rawToProcessed: context.rawToProcessed
    };
}

/**
 * Check if a reference context has valid data
 * @param referenceContext The reference context to check
 * @returns True if the context has at least some reference data
 */
export function hasReferenceData(referenceContext: ReturnType<typeof buildReferenceContext>): boolean {
    return !!(
        (referenceContext.exampleLabels && referenceContext.exampleLabels.size > 0) ||
        (referenceContext.exampleContent && referenceContext.exampleContent.size > 0) ||
        (referenceContext.customLabels && referenceContext.customLabels.size > 0) ||
        (referenceContext.rawToProcessed && referenceContext.rawToProcessed.size > 0)
    );
}