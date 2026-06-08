import { Line } from '@codemirror/state';
import { StructuralResult, ProcessingContext } from '../types';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import {
    isPluginOwnedOrderedListItem,
    resolveOrderedListItem
} from '../../../shared/utils/orderedListMarkers';
import { getListIndentColumns } from '../../../shared/utils/listContext';
import { FancyListMarkerWidget } from '../../widgets';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';

/**
 * Processes fancy lists (A., i., etc.) - only handles structural elements
 */
export class FancyListProcessor extends BaseStructuralProcessor {
    name = 'fancy-list';
    priority = 20;

    canProcess(line: Line, context: ProcessingContext): boolean {
        if (!isSyntaxFeatureEnabled(context.settings, 'enableFancyLists')) {
            return false;
        }

        const item = resolveOrderedListItem(
            getContextLines(line, context),
            line.number - 1,
            context.settings
        );

        return item !== null && isPluginOwnedOrderedListItem(item);
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        const item = resolveOrderedListItem(
            getContextLines(line, context),
            line.number - 1,
            context.settings
        );

        if (!item || !isPluginOwnedOrderedListItem(item)) {
            return { decorations: [] };
        }

        // Check if this list item is in an invalid block
        if (this.isInvalidInStrictMode(line, context)) {
            return { decorations: [] };
        }

        const markerMatch = line.text.match(/^(\s*)(\d+|[A-Za-z]+)([.)])(\s*)/);
        if (!markerMatch) {
            return { decorations: [] };
        }

        const indent = item.indent;
        const marker = markerMatch[2];               // e.g., "A"
        const delimiter = markerMatch[3];            // e.g., "."
        const space = item.spaces;

        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + delimiter.length + space.length;
        const contentStart = markerEnd;
        const listLevel = getListLevel(indent);

        // Create the widget for the marker
        const widget = new FancyListMarkerWidget(marker, delimiter, context.view, markerStart, listLevel);

        // Use the base class method for standard list processing
        return this.processStandardList(
            line,
            context,
            markerStart,
            markerEnd,
            contentStart,
            widget,
            'fancy-list',
            listLevel
        );
    }
}

function getListLevel(indent: string): number {
    return Math.floor(getListIndentColumns(indent) / 4) + 1;
}

function getContextLines(line: Line, context: ProcessingContext): string[] {
    const contextLine = line.number <= context.document.lines
        ? context.document.line(line.number).text
        : undefined;

    return contextLine === line.text
        ? context.document.toString().split('\n')
        : [line.text];
}
