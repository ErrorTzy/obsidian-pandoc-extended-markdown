/**
 * Types and interfaces for custom label processing
 */

import { PlaceholderRange } from '../../../../shared/utils/placeholderProcessor';

/**
 * Represents parsed custom label components
 */
export interface ParsedCustomLabel {
    indent: string;
    fullMarker: string;
    rawLabel: string;
    space: string;
    processedLabel: string;
    markerStart: number;
    markerEnd: number;
    isDuplicate: boolean;
}

/**
 * Cursor position information relative to the custom label
 */
export interface CursorPosition {
    pos: number;
    isInMarker: boolean;
    isAtListMarker: boolean;
    cursorPlaceholder: PlaceholderRange | null;
}

/**
 * Display level for custom label rendering
 */
export type DisplayLevel = 'full' | 'semi-expanded' | 'collapsed';

export { PlaceholderRange };