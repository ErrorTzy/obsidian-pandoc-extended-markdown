import { Line } from '@codemirror/state';
import { StructuralResult, ProcessingContext } from '../types';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { ListPatterns } from '../../../shared/patterns';
import { parseTaskCheckboxPrefix } from '../../../shared/utils/listContext';
import { HashListMarkerWidget } from '../../widgets';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';

/**
 * Processes hash lists (#.) - only handles structural elements
 */
export class HashListProcessor extends BaseStructuralProcessor {
    name = 'hash-list';
    priority = 10;

    canProcess(line: Line, context: ProcessingContext): boolean {
        if (!isSyntaxFeatureEnabled(context.settings, 'enableHashAutoNumber')) {
            return false;
        }

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
        const markerSpaces = hashMatch[3];
        const markerContent = lineText.slice(hashMatch[0].length);
        const taskPrefix = parseTaskCheckboxPrefix(markerSpaces, markerContent);
        const renderedSpaces = taskPrefix?.leadingSpaces ?? markerSpaces;

        const markerStart = line.from + indent.length;
        const markerEnd = markerStart + marker.length + renderedSpaces.length;
        const checkboxStart = markerStart + marker.length + (taskPrefix?.checkboxOffset ?? 0);
        const contentStart = taskPrefix
            ? checkboxStart + 3 + taskPrefix.trailingSpaces.length
            : markerEnd;

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
            1,
            taskPrefix ? {
                checkboxStart,
                sourceCharacter: taskPrefix.sourceCharacter
            } : undefined
        );
    }
}
