import { Line } from '@codemirror/state';
import { StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { HashListMarkerWidget } from '../../widgets';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';

/**
 * Processes hash lists (#.) - only handles structural elements
 */
export class HashListProcessor extends BaseStructuralProcessor {
    name = 'hash-list';
    priority = 10;

    canProcess(line: Line, context: ProcessingContext): boolean {
        const lineText = line.text;
        return ListPatterns.isHashList(lineText) !== null;
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const hashMatch = ListPatterns.isHashList(lineText);

        if (!hashMatch) {
            return { decorations: [] };
        }

        // Check if this list item is in an invalid block
        if (this.isInvalidInStrictMode(line, context)) {
            return { decorations: [] };
        }

        const indent = hashMatch[1];
        const marker = hashMatch[2];
        const space = hashMatch[3];

        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + space.length;
        const contentStart = markerEnd;

        // Create the widget for the marker
        const widget = new HashListMarkerWidget(context.hashCounter.value, context.view, markerStart);

        // Increment counter for next hash list
        context.hashCounter.value++;

        // Use the base class method for standard list processing
        return this.processStandardList(
            line,
            context,
            markerStart,
            markerEnd,
            contentStart,
            widget,
            'hash-list',
            1
        );
    }
}