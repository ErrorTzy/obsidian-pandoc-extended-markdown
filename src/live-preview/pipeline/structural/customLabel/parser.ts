/**
 * Parsing utilities for custom label processing
 */

import { Line } from '@codemirror/state';

import { ProcessingContext } from '../../types';
import { ParsedCustomLabel, PlaceholderRange, CursorPosition } from './types';

import { DECORATION_STYLES } from '../../../../core/constants';
import { ListPatterns } from '../../../../shared/patterns';

/**
 * Parse the custom label syntax from a line of text
 */
export function parseCustomLabel(line: Line, context: ProcessingContext): ParsedCustomLabel | null {
    const lineText = context.document.sliceString(line.from, line.to);
    const lineNum = context.document.lineAt(line.from).number;

    const customLabelMatch = ListPatterns.isCustomLabelList(lineText);
    if (!customLabelMatch) {
        return null;
    }

    // Check strict mode requirements
    if (context.settings.strictPandocMode && context.invalidLines.has(lineNum - 1)) {
        return null;
    }

    const indent = customLabelMatch[1];
    const fullMarker = customLabelMatch[2];
    const rawLabel = customLabelMatch[3];
    const space = customLabelMatch[4];

    // Get processed label (with placeholders replaced)
    const processedLabel = context.rawToProcessed?.get(rawLabel) || rawLabel;

    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + fullMarker.length + space.length;

    // Check if this is a duplicate label
    const isDuplicate = context.duplicateCustomLabels?.has(processedLabel) || false;

    return {
        indent,
        fullMarker,
        rawLabel,
        space,
        processedLabel,
        markerStart,
        markerEnd,
        isDuplicate
    };
}

/**
 * Parse placeholder ranges within the custom label
 */
export function parsePlaceholders(parsedLabel: ParsedCustomLabel): PlaceholderRange[] {
    const placeholderMatches = Array.from(parsedLabel.rawLabel.matchAll(ListPatterns.PLACEHOLDER_PATTERN));
    const placeholderRanges: PlaceholderRange[] = [];

    for (const match of placeholderMatches) {
        if (match.index !== undefined) {
            const placeholderStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH + match.index;
            const placeholderEnd = placeholderStart + match[0].length;
            placeholderRanges.push({
                start: placeholderStart,
                end: placeholderEnd,
                name: match[1]
            });
        }
    }

    return placeholderRanges;
}

/**
 * Analyze cursor position relative to the custom label
 */
export function handleCursorPosition(
    parsedLabel: ParsedCustomLabel,
    placeholderRanges: PlaceholderRange[],
    context: ProcessingContext
): CursorPosition {
    const selection = context.view.state.selection;
    const cursorPos = selection?.main?.from;

    if (cursorPos === undefined) {
        return {
            pos: -1,
            isInMarker: false,
            isAtListMarker: false,
            cursorPlaceholder: null
        };
    }

    const isInMarker = cursorPos >= parsedLabel.markerStart && cursorPos <= parsedLabel.markerEnd;
    const isAtListMarker = cursorPos >= parsedLabel.markerStart && cursorPos < parsedLabel.markerEnd;

    // Find which placeholder the cursor is in (if any)
    let cursorPlaceholder: PlaceholderRange | null = null;
    if (isInMarker) {
        for (const range of placeholderRanges) {
            if (cursorPos >= range.start && cursorPos <= range.end) {
                cursorPlaceholder = range;
                break;
            }
        }
    }

    return {
        pos: cursorPos,
        isInMarker,
        isAtListMarker,
        cursorPlaceholder
    };
}