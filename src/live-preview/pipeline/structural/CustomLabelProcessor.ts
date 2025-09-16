/**
 * Processor for custom label list markers {::LABEL}
 * Handles the structural part of custom label lists, leaving inline content for phase 2
 *
 * REFACTORED: This processor was split from a single 513-line file into multiple modules:
 * - types.ts: Type definitions (35 lines)
 * - parser.ts: Parsing utilities (112 lines)
 * - decorations.ts: Decoration creation utilities (275 lines)
 * - CustomLabelProcessorRefactored.ts: Main processor logic (91 lines)
 *
 * Total refactored size: ~513 lines split across 4 files (all under 400 lines)
 *
 * The complex three-level display logic (collapsed/semi-expanded/full) is preserved
 * while being much more maintainable and testable.
 */

// External libraries
import { Line } from '@codemirror/state';

// Types
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';

// Patterns
import { ListPatterns } from '../../../shared/patterns';

// Utils - Import from extracted modules
import { parseCustomLabel, parsePlaceholders, handleCursorPosition } from './customLabel/parser';
import {
    determineDisplayLevel,
    createCollapsedDecorations,
    createSemiExpandedDecorations,
    createFullDisplayDecorations,
    buildStructuralResult
} from './customLabel/decorations';

export class CustomLabelProcessor implements StructuralProcessor {
    name = 'custom-label-list';
    priority = 15; // Process after basic lists

    canProcess(line: Line, context: ProcessingContext): boolean {
        // Only process if More Extended Syntax is enabled
        if (!context.settings.moreExtendedSyntax) {
            return false;
        }

        const lineText = context.document.sliceString(line.from, line.to);
        return ListPatterns.isCustomLabelList(lineText) !== null;
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        // Parse the custom label from the line
        const parsedLabel = parseCustomLabel(line, context);
        if (!parsedLabel) {
            return { decorations: [] };
        }

        // Parse placeholder ranges within the label
        const placeholderRanges = parsePlaceholders(parsedLabel);

        // Analyze cursor position
        const cursorInfo = handleCursorPosition(parsedLabel, placeholderRanges, context);

        // Determine display level based on cursor position and placeholder presence
        const displayLevel = determineDisplayLevel(line, parsedLabel, placeholderRanges, cursorInfo);

        // Create appropriate decorations based on display level
        let decorations;

        if (displayLevel === 'collapsed' && !parsedLabel.isDuplicate) {
            decorations = createCollapsedDecorations(parsedLabel, context);
        } else if (displayLevel === 'semi-expanded') {
            decorations = createSemiExpandedDecorations(parsedLabel, context);
        } else { // displayLevel === 'full' || isDuplicate
            decorations = createFullDisplayDecorations(
                line,
                parsedLabel,
                placeholderRanges,
                cursorInfo,
                context
            );
        }

        // Build content region and set list context
        const contentRegion = buildStructuralResult(parsedLabel, line, decorations, context);

        // Return the structural result
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}