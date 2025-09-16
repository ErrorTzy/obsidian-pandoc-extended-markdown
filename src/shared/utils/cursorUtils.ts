import { ProcessingContext, ContentRegion } from '../../live-preview/pipeline/types';

/**
 * Calculate cursor position relative to a content region
 * @param context The processing context containing view and cursor info
 * @param region The content region to calculate position within
 * @returns The relative cursor position within the region, or -1 if cursor is outside
 */
export function getRegionCursorPosition(context: ProcessingContext, region: ContentRegion): number {
    const cursorPos = context.view?.state?.selection?.main?.head;
    return cursorPos !== undefined ? cursorPos - region.from : -1;
}

/**
 * Check if cursor is within a specific range
 * @param context The processing context containing view and cursor info
 * @param from Start position of the range
 * @param to End position of the range
 * @returns True if cursor is within the range, false otherwise
 */
export function isCursorInRange(context: ProcessingContext, from: number, to: number): boolean {
    const cursorPos = context.view?.state?.selection?.main?.head;
    return cursorPos !== undefined && cursorPos >= from && cursorPos < to;
}