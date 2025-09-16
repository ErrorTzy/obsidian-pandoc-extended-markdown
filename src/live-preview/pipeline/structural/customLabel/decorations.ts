/**
 * Decoration creation utilities for custom label processing
 */

import { Line } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

import { ProcessingContext, ContentRegion } from '../../types';
import { DecorationInfo } from '../../../../shared/types/decorationTypes';
import { ParsedCustomLabel, PlaceholderRange, CursorPosition, DisplayLevel } from './types';

import { CSS_CLASSES, DECORATION_STYLES } from '../../../../core/constants';
import { ListPatterns } from '../../../../shared/patterns';

import {
    CustomLabelMarkerWidget,
    CustomLabelPartialWidget,
    CustomLabelPlaceholderWidget,
    CustomLabelProcessedWidget,
    CustomLabelInlineNumberWidget,
    DuplicateCustomLabelWidget
} from '../../../widgets/customLabelWidget';

/**
 * Determine the display level based on cursor position and placeholder presence
 */
export function determineDisplayLevel(
    line: Line,
    parsedLabel: ParsedCustomLabel,
    placeholderRanges: PlaceholderRange[],
    cursorInfo: CursorPosition
): DisplayLevel {
    if (cursorInfo.isAtListMarker) {
        return 'full';
    }

    if (placeholderRanges.length > 0 && !cursorInfo.isInMarker) {
        // Check if cursor is anywhere in the line
        const isCursorInLine = cursorInfo.pos !== -1 &&
            cursorInfo.pos >= line.from &&
            cursorInfo.pos <= line.to;
        return isCursorInLine ? 'semi-expanded' : 'collapsed';
    }

    return 'collapsed';
}

/**
 * Create decorations for collapsed display mode (fully processed marker widget)
 */
export function createCollapsedDecorations(
    parsedLabel: ParsedCustomLabel,
    context: ProcessingContext
): DecorationInfo[] {
    const decorations: DecorationInfo[] = [];

    decorations.push({
        from: parsedLabel.markerStart,
        to: parsedLabel.markerEnd,
        decoration: Decoration.replace({
            widget: new CustomLabelMarkerWidget(
                parsedLabel.processedLabel,
                context.view,
                parsedLabel.markerStart
            ),
            inclusive: false
        })
    });

    return decorations;
}

/**
 * Create decorations for semi-expanded display mode (brackets and processed label)
 */
export function createSemiExpandedDecorations(
    parsedLabel: ParsedCustomLabel,
    context: ProcessingContext
): DecorationInfo[] {
    const decorations: DecorationInfo[] = [];

    // Opening bracket {::
    decorations.push({
        from: parsedLabel.markerStart,
        to: parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
        decoration: Decoration.replace({
            widget: new CustomLabelPartialWidget('{::', context.view, parsedLabel.markerStart),
            inclusive: false
        })
    });

    // Processed label
    const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
    const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1; // Exclude closing bracket and space

    decorations.push({
        from: labelStart,
        to: labelEnd,
        decoration: Decoration.replace({
            widget: new CustomLabelProcessedWidget(
                parsedLabel.processedLabel,
                context.view,
                labelStart
            ),
            inclusive: false
        })
    });

    // Closing bracket
    decorations.push({
        from: labelEnd,
        to: labelEnd + 1,
        decoration: Decoration.replace({
            widget: new CustomLabelPartialWidget('}', context.view, labelEnd),
            inclusive: false
        })
    });

    return decorations;
}

/**
 * Process placeholders within full display mode
 */
export function processPlaceholders(
    line: Line,
    parsedLabel: ParsedCustomLabel,
    placeholderRanges: PlaceholderRange[],
    cursorInfo: CursorPosition,
    context: ProcessingContext
): DecorationInfo[] {
    const decorations: DecorationInfo[] = [];

    const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
    const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1;

    let lastEnd = labelStart;

    for (const range of placeholderRanges) {
        // Add text before placeholder (if any)
        if (range.start > lastEnd) {
            decorations.push({
                from: lastEnd,
                to: range.start,
                decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
            });
        }

        // Add placeholder widget or mark
        if (cursorInfo.cursorPlaceholder && cursorInfo.cursorPlaceholder === range) {
            // Cursor is in this placeholder - don't replace it
            decorations.push({
                from: range.start,
                to: range.end,
                decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_PLACEHOLDER })
            });
        } else {
            // Replace placeholder with number widget
            const placeholderKey = `${parsedLabel.rawLabel.substring(
                0,
                parsedLabel.rawLabel.indexOf('(')
            )}(#${range.name})`;
            const processedKey = context.rawToProcessed?.get(placeholderKey);
            const number = processedKey
                ? parseInt(processedKey.match(ListPatterns.TRAILING_DIGITS)?.[0] || '0')
                : context.placeholderContext?.getPlaceholderNumber(range.name) || 0;

            decorations.push({
                from: range.start,
                to: range.end,
                decoration: Decoration.replace({
                    widget: new CustomLabelInlineNumberWidget(String(number), context.view),
                    inclusive: false
                })
            });
        }

        lastEnd = range.end;
    }

    // Add text after last placeholder (if any)
    if (lastEnd < labelEnd) {
        decorations.push({
            from: lastEnd,
            to: labelEnd,
            decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
        });
    }

    return decorations;
}

/**
 * Create decorations for full display mode (complete syntax with selective placeholder expansion)
 */
export function createFullDisplayDecorations(
    line: Line,
    parsedLabel: ParsedCustomLabel,
    placeholderRanges: PlaceholderRange[],
    cursorInfo: CursorPosition,
    context: ProcessingContext
): DecorationInfo[] {
    const decorations: DecorationInfo[] = [];
    const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
    const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1;

    // Opening bracket {::
    decorations.push({
        from: parsedLabel.markerStart,
        to: parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
        decoration: Decoration.replace({
            widget: new CustomLabelPartialWidget('{::', context.view, parsedLabel.markerStart),
            inclusive: false
        })
    });

    // Process label content with selective placeholder expansion
    if (parsedLabel.isDuplicate) {
        // Show duplicate warning widget
        const firstOccurrence = context.duplicateCustomLineInfo?.get(parsedLabel.processedLabel);
        decorations.push({
            from: labelStart,
            to: labelEnd,
            decoration: Decoration.replace({
                widget: new DuplicateCustomLabelWidget(
                    parsedLabel.rawLabel,
                    firstOccurrence?.firstLine ?? undefined,
                    firstOccurrence?.firstContent ?? undefined
                ),
                inclusive: false
            })
        });
    } else if (placeholderRanges.length > 0) {
        // Process placeholders
        const placeholderDecorations = processPlaceholders(
            line,
            parsedLabel,
            placeholderRanges,
            cursorInfo,
            context
        );
        decorations.push(...placeholderDecorations);
    } else {
        // No placeholders, just mark the label text
        decorations.push({
            from: labelStart,
            to: labelEnd,
            decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
        });
    }

    // Closing bracket
    decorations.push({
        from: labelEnd,
        to: labelEnd + 1,
        decoration: Decoration.replace({
            widget: new CustomLabelPartialWidget('}', context.view, labelEnd),
            inclusive: false
        })
    });

    return decorations;
}

/**
 * Build the content region for inline processing
 */
export function buildStructuralResult(
    parsedLabel: ParsedCustomLabel,
    line: Line,
    decorations: DecorationInfo[],
    context: ProcessingContext
): ContentRegion {
    const contentRegion: ContentRegion = {
        from: parsedLabel.markerEnd,
        to: line.to,
        type: 'list-content',
        parentStructure: 'custom-label-list',
        metadata: {
            rawLabel: parsedLabel.rawLabel,
            processedLabel: parsedLabel.processedLabel,
            isDuplicate: parsedLabel.isDuplicate
        }
    };

    // Set list context for continuation line detection
    context.listContext = {
        isInList: true,
        contentStartColumn: parsedLabel.markerEnd - line.from,
        listLevel: 1,
        parentStructure: 'custom-label-list'
    };

    return contentRegion;
}