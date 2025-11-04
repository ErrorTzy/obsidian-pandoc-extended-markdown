import { Line } from '@codemirror/state';
import { StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { FancyListMarkerWidget } from '../../widgets';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';

/**
 * Processes fancy lists (A., i., etc.) - only handles structural elements
 */
export class FancyListProcessor extends BaseStructuralProcessor {
    name = 'fancy-list';
    priority = 20;

    canProcess(line: Line, context: ProcessingContext): boolean {
        const lineText = line.text;
        return ListPatterns.isFancyList(lineText) !== null;
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const fancyMatch = ListPatterns.isFancyList(lineText);

        if (!fancyMatch) {
            return { decorations: [] };
        }

        // Check if this list item is in an invalid block
        if (this.isInvalidInStrictMode(line, context)) {
            return { decorations: [] };
        }

        const indent = fancyMatch[1];
        const marker = fancyMatch[3];                // e.g., "A"
        const delimiter = fancyMatch[4];             // e.g., "."
        const space = fancyMatch[5];

        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + delimiter.length + space.length;
        const contentStart = markerEnd;

        // Create the widget for the marker
        const widget = new FancyListMarkerWidget(marker, delimiter, context.view, markerStart);

        // Use the base class method for standard list processing
        return this.processStandardList(
            line,
            context,
            markerStart,
            markerEnd,
            contentStart,
            widget,
            'fancy-list',
            1 // Can be calculated based on indent depth
        );
    }
}
