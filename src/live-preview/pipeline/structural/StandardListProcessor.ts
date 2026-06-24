import { Line } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

import { ContentRegion, StructuralProcessor, StructuralResult, ProcessingContext } from '../types';

import { CSS_CLASSES } from '../../../core/constants';

import { ListPatterns } from '../../../shared/patterns';

import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import {
    isPluginOwnedOrderedListItem,
    resolveOrderedListItem
} from '../../../shared/utils/orderedListMarkers';
import { getUnorderedMarkerClass } from '../../../shared/utils/unorderedListMarkers';
import { getListIndentColumns, parseStandardListItem } from '../../../shared/utils/listContext';
import { UnorderedListMarkerWidget } from '../../widgets';

/**
 * Adds source-marker classes to standard unordered lists while preserving
 * Obsidian's native list rendering and content processing.
 */
export class StandardListProcessor implements StructuralProcessor {
    name = 'standard-list';
    priority = 25; // Process after fancy lists but before definition lists
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        return isSyntaxFeatureEnabled(context.settings, 'enableUnorderedListMarkerStyles') &&
            ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE.test(line.text);
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        if (!isSyntaxFeatureEnabled(context.settings, 'enableUnorderedListMarkerStyles')) {
            return { decorations: [] };
        }

        if (context.settings.enforcePandocListSpacing && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }

        const match = line.text.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE);
        const marker = match?.[2];
        const markerClass = marker ? getUnorderedMarkerClass(marker) : null;

        if (!markerClass) {
            return { decorations: [] };
        }

        const indent = match?.[1] ?? '';
        const listLevel = getListLevel(indent);
        const listLevelClass = getListLevelClass(listLevel);
        const decorations = [{
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: [
                    CSS_CLASSES.LIST_LINE,
                    listLevelClass,
                    CSS_CLASSES.UNORDERED_LIST_MARKER,
                    markerClass
                ].join(' ')
            })
        }];

        if (match && isNestedUnderPluginOwnedOrderedList(line, context, indent)) {
            const markerStart = line.from + match[1].length;
            const markerEnd = markerStart + marker.length + match[3].length;
            const cursorPos = context.view.state.selection?.main?.head;
            const cursorInMarker = cursorPos !== undefined &&
                cursorPos >= markerStart &&
                cursorPos < markerEnd;

            if (!cursorInMarker) {
                decorations.push({
                    from: markerStart,
                    to: markerEnd,
                    decoration: Decoration.replace({
                        widget: new UnorderedListMarkerWidget(marker, context.view, markerStart),
                        inclusive: false
                    })
                });
            }
        }

        if (match) {
            const contentStartColumn = getListIndentColumns(indent) +
                marker.length +
                getListIndentColumns(match[3]);
            const contentStart = line.from + indent.length + marker.length + match[3].length;
            const contentRegion: ContentRegion = {
                from: contentStart,
                to: line.to,
                type: 'list-content',
                parentStructure: 'standard-list'
            };

            context.listContext = {
                isInList: true,
                contentStartColumn,
                listLevel,
                parentStructure: 'standard-list'
            };

            return {
                decorations,
                contentRegion,
                skipFurtherProcessing: true
            };
        }

        return {
            decorations
        };
    }
}

function getListLevel(indent: string): number {
    return Math.floor(getListIndentColumns(indent) / 4) + 1;
}

function getListLevelClass(level: number): string {
    switch (level) {
        case 1:
            return CSS_CLASSES.LIST_LINE_1;
        case 2:
            return CSS_CLASSES.LIST_LINE_2;
        case 3:
            return CSS_CLASSES.LIST_LINE_3;
        default:
            return CSS_CLASSES.LIST_LINE_4;
    }
}

function isNestedUnderPluginOwnedOrderedList(
    line: Line,
    context: ProcessingContext,
    indent: string
): boolean {
    let childIndentColumns = getListIndentColumns(indent);
    if (childIndentColumns === 0) {
        return false;
    }

    const lines = context.documentLines || context.document.toString().split('\n');

    for (let index = line.number - 2; index >= 0; index--) {
        const previousLine = lines[index];
        if (!previousLine.trim()) {
            return false;
        }

        const previousIndent = previousLine.match(ListPatterns.INDENT_ONLY)?.[1] ?? '';
        const previousIndentColumns = getListIndentColumns(previousIndent);
        if (previousIndentColumns >= childIndentColumns) {
            continue;
        }

        const item = context.orderedListItemsByLine?.get(index + 1) ??
            resolveOrderedListItem(lines, index, context.settings);
        if (item && isPluginOwnedOrderedListItem(item)) {
            return true;
        }

        if (!parseStandardListItem(previousLine)) {
            return false;
        }

        childIndentColumns = previousIndentColumns;
    }

    return false;
}
