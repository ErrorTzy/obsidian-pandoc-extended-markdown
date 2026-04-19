import { Line } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';

import { CSS_CLASSES } from '../../../core/constants';

import { ListPatterns } from '../../../shared/patterns';

import { getUnorderedMarkerClass } from '../../../shared/utils/unorderedListMarkers';

/**
 * Adds source-marker classes to standard unordered lists while preserving
 * Obsidian's native list rendering and content processing.
 */
export class StandardListProcessor implements StructuralProcessor {
    name = 'standard-list';
    priority = 25; // Process after fancy lists but before definition lists
    
    canProcess(line: Line, _context: ProcessingContext): boolean {
        return ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE.test(line.text);
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        if (context.settings.strictPandocMode && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }

        const marker = line.text.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE)?.[2];
        const markerClass = marker ? getUnorderedMarkerClass(marker) : null;

        if (!markerClass) {
            return { decorations: [] };
        }

        return {
            decorations: [{
                from: line.from,
                to: line.from,
                decoration: Decoration.line({
                    class: [
                        CSS_CLASSES.LIST_LINE,
                        CSS_CLASSES.UNORDERED_LIST_MARKER,
                        markerClass
                    ].join(' ')
                })
            }]
        };
    }
}
